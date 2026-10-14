import { readFileSync } from 'node:fs'
import { bench, describe } from 'vitest'

import * as branch1 from '../esm_branch1/index.js'
import * as branch2 from '../esm_branch2/index.js'

// Two refs built by scripts/build-both-branches.sh, timed on every path that
// runs per line or per sample. Only the public API is used, so any two refs
// can be compared however their internals are laid out.
//
// Reading the results:
// - The refs take turns going first, so a first-listed penalty can't favour
//   one side throughout. To be sure a result follows the code, swap the
//   esm_branch1 and esm_branch2 directories and rerun.
// - A path neither ref changed (usually "GT only") still differs by up to
//   ~10%, which is the noise floor. Run on an idle machine; a loaded one
//   swings far more.
// - vitest transforms both builds, so a call into another module becomes a
//   property load on every call. A per-sample loop that calls across modules
//   shows up here, while a plain node script hides it.

type Branch = typeof branch2
type Variant = ReturnType<InstanceType<Branch['default']>['parseLine']>

const branches = [
  {
    name: readFileSync('esm_branch1/branchname.txt', 'utf8').trim(),
    lib: branch1 as Branch,
  },
  {
    name: readFileSync('esm_branch2/branchname.txt', 'utf8').trim(),
    lib: branch2,
  },
]

const SAMPLE_COUNTS = [10, 1000, 5000] as const
const opts = { time: 1000, warmupTime: 200 }

const HEADER_META = `##fileformat=VCFv4.5
##INFO=<ID=AC,Number=A,Type=Integer,Description="Allele count">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele frequency">
##INFO=<ID=AN,Number=1,Type=Integer,Description="Allele number">
##INFO=<ID=VT,Number=1,Type=String,Description="Variant type">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Allelic depths">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Depth">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype quality">
##FORMAT=<ID=PL,Number=G,Type=Integer,Description="Likelihoods">`
const INFO =
  'AC=12,3;AF=0.25,0.01;AN=5008;DP=20000;NS=2504;AA=G|||;VT=SNP;DB;H2;MQ=59.8'

const SHAPES = {
  'GT only': ['GT', '0/1'],
  'GT first': ['GT:AD:DP:GQ:PL', '0/1:10,12,0:22:99:255,0,255,10,20,30'],
  'GT middle': ['AD:DP:GT:GQ:PL', '10,12,0:22:0/1:99:255,0,255,10,20,30'],
  'GT last': ['AD:DP:GQ:PL:GT', '10,12,0:22:99:255,0,255,10,20,30:0/1'],
  local: ['GT:LAA:LAD:LPL', '0/1:2:5,6:0,10,100'],
} as const

function parsers(numSamples: number) {
  const names = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  const header = `${HEADER_META}\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${names.join('\t')}`
  return branches.map(({ name, lib }) => ({
    name,
    lib,
    parser: new lib.default({ header }),
  }))
}

function line(shape: keyof typeof SHAPES, numSamples: number) {
  const [format, cell] = SHAPES[shape]
  return `20\t14370\trs6054257\tG\tA,T\t29\tPASS\t${INFO}\t${format}\t${Array(numSamples).fill(cell).join('\t')}`
}

let group = 0
function compare(
  name: string,
  numSamples: number,
  shape: keyof typeof SHAPES,
  run: (variant: Variant, lib: Branch) => unknown,
) {
  const sides = parsers(numSamples).map(({ name, lib, parser }) => {
    const variant = parser.parseLine(line(shape, numSamples))
    return { name, fn: () => run(variant, lib) }
  })
  const ordered = group++ % 2 ? sides.toReversed() : sides
  describe(`${numSamples} samples - ${name}`, () => {
    for (const { name, fn } of ordered) {
      bench(name, fn, opts)
    }
  })
}

const noop = () => {}

for (const numSamples of SAMPLE_COUNTS) {
  for (const shape of [
    'GT only',
    'GT first',
    'GT middle',
    'GT last',
  ] as const) {
    compare(`processGenotypes, ${shape}`, numSamples, shape, v => {
      v.processGenotypes(noop)
    })
  }
  compare('GENOTYPES, GT first', numSamples, 'GT first', v => v.GENOTYPES())
  compare('processFormatFields GT,DP', numSamples, 'GT first', v => {
    v.processFormatFields(['GT', 'DP'], noop)
  })
  compare('SAMPLES', numSamples, 'GT first', v => v.SAMPLES())
  compare('readLocalAlleles over LAA', numSamples, 'local', (v, lib) => {
    const out = new Int32Array(3)
    v.processFormatFields(['LAA'], (str, ranges) => {
      lib.readLocalAlleles(str, ranges[0]!, ranges[1]!, out)
    })
  })
}

// parseLine reads only the fixed columns and INFO, so its cost does not grow
// with the sample count
const lineParsers = parsers(10)
const infoLine = line('GT first', 10)
describe('parseLine', () => {
  for (const { name, parser } of lineParsers) {
    bench(name, () => parser.parseLine(infoLine), opts)
  }
})

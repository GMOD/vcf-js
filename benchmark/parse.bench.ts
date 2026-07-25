import { bench, describe } from 'vitest'

import VCF from '../src/index.ts'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly.ts'
import { processGenotypes } from '../src/processGenotypes.ts'

// Self-contained benchmarks against src/, so a change can be measured without
// the two-branch build in master-vs-current.bench.ts.
//
// Reading these: the first bench listed in a group is measurably penalised
// relative to later ones, enough to invent a 10-30% difference between two
// functions running identical code. Before believing a small delta, swap the
// declaration order and re-run - and note that whole runs drift by ~40% when
// the machine is otherwise busy, so compare within a run, not across runs.
//
// The FORMAT shapes matter more than they look: GT-first and GT-not-first take
// different paths through processGenotypes. GT must come first per the VCF
// spec, but out-of-spec files exist and used to be ~2x slower to scan.
const FORMATS = {
  'GT only': { format: 'GT', cell: '0/1' },
  'GT first': { format: 'GT:AD:DP:GQ:PL', cell: '0/1:10,12:22:99:255,0,255' },
  'GT last': { format: 'AD:DP:GQ:PL:GT', cell: '10,12:22:99:255,0,255:0/1' },
} as const

const SAMPLE_COUNTS = [100, 1000, 5000] as const

const opts = { iterations: 500, warmupIterations: 50 }

function makeCase(numSamples: number, format: string, cell: string) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  const prerest = Array.from({ length: numSamples }, () => cell).join('\t')
  const header = `##fileformat=VCFv4.3
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}
`
  const line = `20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\t${format}\t${prerest}`
  return { samples, prerest, line, parser: new VCF({ header }) }
}

for (const [name, { format, cell }] of Object.entries(FORMATS)) {
  for (const numSamples of SAMPLE_COUNTS) {
    const { samples, prerest, line, parser } = makeCase(
      numSamples,
      format,
      cell,
    )
    const noop = () => {}

    describe(`${numSamples} samples - ${name}`, () => {
      // allocation-free iteration: what the jbrowse genotype matrices use
      bench(
        'processGenotypes',
        () => {
          processGenotypes(format, prerest, samples.length, noop)
        },
        opts,
      )
      // same scan, but building the genotypes Record
      bench(
        'parseGenotypesOnly',
        () => {
          parseGenotypesOnly(format, prerest, samples)
        },
        opts,
      )
      // full per-field parse of every sample, used by toJSON()/get('samples')
      bench(
        'parseLine + SAMPLES',
        () => {
          parser.parseLine(line).SAMPLES()
        },
        opts,
      )
    })

    // parseLine on its own is deliberately lazy - it never touches the sample
    // columns - so it is kept out of the group above, where the summary would
    // be comparing it against work it does not do.
    describe(`${numSamples} samples - ${name} - lazy parseLine`, () => {
      bench(
        'parseLine',
        () => {
          parser.parseLine(line)
        },
        opts,
      )
    })
  }
}

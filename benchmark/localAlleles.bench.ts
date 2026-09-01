import { bench, describe } from 'vitest'

import VCF, {
  LocalAlleleGenotypeMaps,
  decodeLocalAlleles,
  readLocalAlleles,
} from '../src/index.ts'

// What a local-allele record costs a many-sample consumer, per the two shapes
// available: the convenience decode over SAMPLES(), and the allocation-free
// scan the jbrowse genotype matrices are built on. See parse.bench.ts for how
// to read these - first-listed benches are penalised, so compare within a run.
//
// The point of local alleles is that a sample carries a handful of values
// however many ALTs the site has, so the interesting axis is ALT count: the
// global PL a decode reconstructs is quadratic in it, while the local scan is
// flat.
const ALT_COUNTS = [4, 20, 60] as const
const SAMPLE_COUNTS = [1000, 5000] as const

const opts = { iterations: 100, warmupIterations: 20 }

function makeCase(numSamples: number, altCount: number) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  const alt = Array.from(
    { length: altCount },
    (_, i) => `A${'T'.repeat(i + 1)}`,
  )
  // two local alts per sample, walking the ALT list so the memo sees real turnover
  const cells = Array.from({ length: numSamples }, (_, i) => {
    const a = (i % altCount) + 1
    const b = ((i + 1) % altCount) + 1
    return `0/${a}:${a},${b}:30,10,5:250,0,300,90,40,120`
  })
  const header = `##fileformat=VCFv4.5
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}
`
  const line = `1\t100\t.\tA\t${alt.join(',')}\t.\t.\t.\tGT:LAA:LAD:LPL\t${cells.join('\t')}`
  return { altCount, variant: new VCF({ header }).parseLine(line) }
}

for (const altCount of ALT_COUNTS) {
  for (const numSamples of SAMPLE_COUNTS) {
    const { variant } = makeCase(numSamples, altCount)
    const alleles = new Int32Array(altCount + 1)
    const maps = new LocalAlleleGenotypeMaps()

    describe(`${numSamples} samples - ${altCount} ALTs`, () => {
      // reads every sample's LAA and LAD into flat buffers, allocating nothing
      bench(
        'processFormatFields + readLocalAlleles',
        () => {
          variant.processFormatFields(['LAA', 'LAD'], (str, ranges) => {
            readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
          })
        },
        opts,
      )
      // the same LAA scan, plus the cached local->global genotype permutation
      bench(
        'readLocalAlleles + cached genotype map',
        () => {
          variant.processFormatFields(['LAA', 'LAD'], (str, ranges) => {
            const n = readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
            maps.get(alleles, n, 2)
          })
        },
        opts,
      )
      // the convenience path: SAMPLES() plus a full expansion per sample
      bench(
        'SAMPLES + decodeLocalAlleles',
        () => {
          const all = variant.SAMPLES()
          for (const name of variant.sampleNames) {
            decodeLocalAlleles(all[name]!, altCount)
          }
        },
        opts,
      )
    })
  }
}

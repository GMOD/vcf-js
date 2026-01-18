import { readFileSync } from 'node:fs'
import { bench, describe } from 'vitest'

import { parseGenotypesOnly as branch1Fn } from '../esm_branch1/parseGenotypesOnly.js'
import { parseGenotypesOnly as branch2Fn } from '../esm_branch2/parseGenotypesOnly.js'

const branch1Name = readFileSync('esm_branch1/branchname.txt', 'utf8').trim()
const branch2Name = readFileSync('esm_branch2/branchname.txt', 'utf8').trim()

function generateTestData(numSamples: number, format: string) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  let genotypeData: string
  if (format === 'GT') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  } else if (format === 'GT:DP:GQ') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1:23:99').join(
      '\t',
    )
  } else if (format === 'DP:GQ:GT') {
    genotypeData = Array.from({ length: numSamples }, () => '23:99:0/1').join(
      '\t',
    )
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }
  return { samples, genotypeData, format }
}

function benchParseGenotypes(
  name: string,
  numSamples: number,
  format: string,
  opts?: { iterations?: number; warmupIterations?: number },
) {
  const { samples, genotypeData } = generateTestData(numSamples, format)

  describe(name, () => {
    bench(
      branch1Name,
      () => {
        branch1Fn(format, genotypeData, samples)
      },
      opts,
    )
    bench(
      branch2Name,
      () => {
        branch2Fn(format, genotypeData, samples)
      },
      opts,
    )
  })
}

const formats = ['GT', 'GT:DP:GQ', 'DP:GQ:GT'] as const
const sampleCounts = [10, 100, 1000, 5000] as const
const opts = { iterations: 1000, warmupIterations: 100 }

for (const format of formats) {
  for (const numSamples of sampleCounts) {
    benchParseGenotypes(
      `${numSamples} samples - ${format}`,
      numSamples,
      format,
      opts,
    )
  }
}

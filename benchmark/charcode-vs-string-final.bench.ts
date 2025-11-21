import { bench, describe } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Version with string character comparisons (previous)
function parseGenotypesStringComparison(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return genotypes
  }

  const samplesLen = samples.length
  const prerestLen = prerest.length
  let pos = 0

  if (format.length === 2) {
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 < prerestLen && prerest[pos + 3] === '\t' && prerest[pos] !== '\t' && prerest[pos + 1] !== '\t' && prerest[pos + 2] !== '\t') {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4
      } else if (pos + 3 === prerestLen && prerest[pos] !== '\t' && prerest[pos + 1] !== '\t' && prerest[pos + 2] !== '\t') {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos = prerestLen
      } else {
        const start = pos
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        genotypes[samples[idx]!] = prerest.slice(start, pos)
        pos++
      }
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 < prerestLen && (prerest[pos + 3] === ':' || prerest[pos + 3] === '\t') && prerest[pos] !== ':' && prerest[pos] !== '\t' && prerest[pos + 1] !== ':' && prerest[pos + 1] !== '\t' && prerest[pos + 2] !== ':' && prerest[pos + 2] !== '\t') {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        if (prerest[pos + 3] === ':') {
          pos += 4
          while (pos < prerestLen && prerest[pos] !== '\t') pos++
          pos++
        } else {
          pos += 4
        }
      } else if (pos + 3 === prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t' && prerest[pos + 1] !== ':' && prerest[pos + 1] !== '\t' && prerest[pos + 2] !== ':' && prerest[pos + 2] !== '\t') {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos = prerestLen
      } else {
        const start = pos
        while (pos < prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t')
          pos++
        genotypes[samples[idx]!] = prerest.slice(start, pos)
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        pos++
      }
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const sampleStart = pos
      let tabIdx = pos
      while (tabIdx < prerestLen && prerest[tabIdx] !== '\t') tabIdx++
      const val = prerest.slice(sampleStart, tabIdx)
      const valLen = val.length
      let colons = 0
      let fieldStart = 0
      for (let j = 0; j <= valLen; j++) {
        if (j === valLen || val[j] === ':') {
          if (colons === colonCount) {
            genotypes[samples[idx]!] = val.slice(fieldStart, j)
            break
          }
          colons++
          fieldStart = j + 1
        }
      }
      pos = tabIdx + 1
    }
  }

  return genotypes
}

function generateTestData(numSamples: number, format: string) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)

  let genotypeData: string
  if (format === 'GT') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  } else if (format === 'GT:DP:GQ') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1:23:99').join('\t')
  } else if (format === 'DP:GQ:GT') {
    genotypeData = Array.from({ length: numSamples }, () => '23:99:0/1').join('\t')
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }

  return { samples, genotypeData, format }
}

describe('1000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT')

  bench('string comparison', () => {
    parseGenotypesStringComparison(format, genotypeData, samples)
  }, { time: 4000 })

  bench('charCodeAt (current)', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('5000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT')

  bench('string comparison', () => {
    parseGenotypesStringComparison(format, genotypeData, samples)
  }, { time: 4000 })

  bench('charCodeAt (current)', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('5000 samples - GT:DP:GQ', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ')

  bench('string comparison', () => {
    parseGenotypesStringComparison(format, genotypeData, samples)
  }, { time: 4000 })

  bench('charCodeAt (current)', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('5000 samples - DP:GQ:GT', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'DP:GQ:GT')

  bench('string comparison', () => {
    parseGenotypesStringComparison(format, genotypeData, samples)
  }, { time: 4000 })

  bench('charCodeAt (current)', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })
})

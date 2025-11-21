import { bench, describe } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Current implementation
function parseGenotypesCurrentGTNotFirst(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1 || gtIdx === 0) {
    return genotypes
  }

  const samplesLen = samples.length
  const prerestLen = prerest.length
  let pos = 0

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

  return genotypes
}

// Optimized: parse directly from prerest without creating val
function parseGenotypesOptimizedNoVal(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1 || gtIdx === 0) {
    return genotypes
  }

  const samplesLen = samples.length
  const prerestLen = prerest.length
  const COLON = 58
  const TAB = 9
  let pos = 0

  let colonCount = 0
  for (let j = 0; j < gtIdx; j++) {
    if (format.charCodeAt(j) === COLON) {
      colonCount++
    }
  }
  for (let idx = 0; idx < samplesLen; idx++) {
    const sampleStart = pos
    let tabIdx = pos
    while (tabIdx < prerestLen && prerest.charCodeAt(tabIdx) !== TAB) tabIdx++

    // Parse GT directly from prerest without creating intermediate string
    let colons = 0
    let fieldStart = sampleStart
    for (let j = sampleStart; j <= tabIdx; j++) {
      if (j === tabIdx || prerest.charCodeAt(j) === COLON) {
        if (colons === colonCount) {
          genotypes[samples[idx]!] = prerest.slice(fieldStart, j)
          break
        }
        colons++
        fieldStart = j + 1
      }
    }
    pos = tabIdx + 1
  }

  return genotypes
}

function generateTestData(numSamples: number) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  const genotypeData = Array.from({ length: numSamples }, () => '23:99:0/1').join('\t')
  return { samples, genotypeData }
}

describe('1000 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData } = generateTestData(1000)

  bench('current (with val)', () => {
    parseGenotypesCurrentGTNotFirst('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })

  bench('optimized (no val)', () => {
    parseGenotypesOptimizedNoVal('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })

  bench('actual implementation', () => {
    parseGenotypesOnly('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })
})

describe('5000 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData } = generateTestData(5000)

  bench('current (with val)', () => {
    parseGenotypesCurrentGTNotFirst('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })

  bench('optimized (no val)', () => {
    parseGenotypesOptimizedNoVal('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })

  bench('actual implementation', () => {
    parseGenotypesOnly('DP:GQ:GT', genotypeData, samples)
  }, { time: 4000 })
})

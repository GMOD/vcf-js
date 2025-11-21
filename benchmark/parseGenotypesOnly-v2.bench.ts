import { bench, describe } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Further optimized: eliminate intermediate val string in GT-not-first case
function parseGenotypesOnlyOptV4(
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
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t')
        pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      pos++
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

      // Parse GT directly from prerest without creating intermediate val
      let colons = 0
      let fieldStart = sampleStart
      for (let j = sampleStart; j <= tabIdx; j++) {
        if (j === tabIdx || prerest[j] === ':') {
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
  }

  return genotypes
}

// Try using charCodeAt for character comparisons
function parseGenotypesOnlyOptV5(
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
  const TAB = 9
  const COLON = 58
  let pos = 0

  if (format.length === 2) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (
        pos < prerestLen &&
        prerest.charCodeAt(pos) !== COLON &&
        prerest.charCodeAt(pos) !== TAB
      )
        pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) pos++
      pos++
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format.charCodeAt(j) === COLON) {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const sampleStart = pos
      let tabIdx = pos
      while (tabIdx < prerestLen && prerest.charCodeAt(tabIdx) !== TAB)
        tabIdx++

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
  }

  return genotypes
}

// Cache sample names to avoid repeated array access
function parseGenotypesOnlyOptV6(
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
      const sample = samples[idx]!
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[sample] = prerest.slice(start, pos)
      pos++
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const sample = samples[idx]!
      const start = pos
      while (pos < prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t')
        pos++
      genotypes[sample] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      pos++
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const sample = samples[idx]!
      const sampleStart = pos
      let tabIdx = pos
      while (tabIdx < prerestLen && prerest[tabIdx] !== '\t') tabIdx++

      let colons = 0
      let fieldStart = sampleStart
      for (let j = sampleStart; j <= tabIdx; j++) {
        if (j === tabIdx || prerest[j] === ':') {
          if (colons === colonCount) {
            genotypes[sample] = prerest.slice(fieldStart, j)
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

describe('1000 samples - DP:GQ:GT (GT not first) - additional opts', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'DP:GQ:GT')

  bench('current optimized', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('v4: no intermediate val', () => {
    parseGenotypesOnlyOptV4(format, genotypeData, samples)
  })

  bench('v5: charCodeAt', () => {
    parseGenotypesOnlyOptV5(format, genotypeData, samples)
  })

  bench('v6: cache sample names', () => {
    parseGenotypesOnlyOptV6(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only - additional opts', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT')

  bench('current optimized', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('v4: no intermediate val', () => {
    parseGenotypesOnlyOptV4(format, genotypeData, samples)
  })

  bench('v5: charCodeAt', () => {
    parseGenotypesOnlyOptV5(format, genotypeData, samples)
  })

  bench('v6: cache sample names', () => {
    parseGenotypesOnlyOptV6(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ (GT first) - additional opts', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ')

  bench('current optimized', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('v4: no intermediate val', () => {
    parseGenotypesOnlyOptV4(format, genotypeData, samples)
  })

  bench('v5: charCodeAt', () => {
    parseGenotypesOnlyOptV5(format, genotypeData, samples)
  })

  bench('v6: cache sample names', () => {
    parseGenotypesOnlyOptV6(format, genotypeData, samples)
  })
})

describe('5000 samples - DP:GQ:GT (GT not first) - additional opts', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'DP:GQ:GT')

  bench('current optimized', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('v4: no intermediate val', () => {
    parseGenotypesOnlyOptV4(format, genotypeData, samples)
  })

  bench('v5: charCodeAt', () => {
    parseGenotypesOnlyOptV5(format, genotypeData, samples)
  })

  bench('v6: cache sample names', () => {
    parseGenotypesOnlyOptV6(format, genotypeData, samples)
  })
})

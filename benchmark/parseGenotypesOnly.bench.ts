import { bench, describe } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Optimized version 1: Avoid split, parse string directly
function parseGenotypesOnlyOptV1(
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
  let i = 0
  let start = 0

  if (format.length === 2) {
    // GT is the only field
    for (let idx = 0; idx < samplesLen; idx++) {
      const tabIdx = prerest.indexOf('\t', start)
      const val =
        tabIdx === -1 ? prerest.slice(start) : prerest.slice(start, tabIdx)
      genotypes[samples[idx]!] = val
      start = tabIdx + 1
      if (tabIdx === -1) break
    }
  } else if (gtIdx === 0) {
    // GT is first field
    for (let idx = 0; idx < samplesLen; idx++) {
      const tabIdx = prerest.indexOf('\t', start)
      const val =
        tabIdx === -1 ? prerest.slice(start) : prerest.slice(start, tabIdx)
      const colonIdx = val.indexOf(':')
      genotypes[samples[idx]!] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
      start = tabIdx + 1
      if (tabIdx === -1) break
    }
  } else {
    // GT is not first field - need to skip fields
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const tabIdx = prerest.indexOf('\t', start)
      const val =
        tabIdx === -1 ? prerest.slice(start) : prerest.slice(start, tabIdx)
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
      start = tabIdx + 1
      if (tabIdx === -1) break
    }
  }

  return genotypes
}

// Optimized version 2: Manual char iteration for tab finding
function parseGenotypesOnlyOptV2(
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
    // GT is the only field
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++ // skip tab
    }
  } else if (gtIdx === 0) {
    // GT is first field
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      const val = prerest.slice(start, pos)
      const colonIdx = val.indexOf(':')
      genotypes[samples[idx]!] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
      pos++ // skip tab
    }
  } else {
    // GT is not first field - need to skip fields
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const sampleStart = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      const val = prerest.slice(sampleStart, pos)
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
      pos++ // skip tab
    }
  }

  return genotypes
}

// Optimized version 3: Combine manual iteration with inline GT extraction
function parseGenotypesOnlyOptV3(
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
    // GT is the only field
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++ // skip tab
    }
  } else if (gtIdx === 0) {
    // GT is first field - extract inline without creating intermediate val
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      // Find first colon or tab
      while (pos < prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t')
        pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      // Skip to next tab
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      pos++ // skip tab
    }
  } else {
    // GT is not first field - need to skip fields
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const sampleStart = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      const val = prerest.slice(sampleStart, pos)
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
      pos++ // skip tab
    }
  }

  return genotypes
}

// Generate test data
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

// Benchmark suite for 100 samples
describe('100 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

describe('100 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT:DP:GQ')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

describe('100 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'DP:GQ:GT')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

// Benchmark suite for 1000 samples
describe('1000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

describe('1000 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT:DP:GQ')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

describe('1000 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'DP:GQ:GT')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

// Benchmark suite for 5000 samples (very large)
describe('5000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ')

  bench('original', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  })

  bench('opt-v1: avoid split', () => {
    parseGenotypesOnlyOptV1(format, genotypeData, samples)
  })

  bench('opt-v2: manual char iteration', () => {
    parseGenotypesOnlyOptV2(format, genotypeData, samples)
  })

  bench('opt-v3: inline extraction', () => {
    parseGenotypesOnlyOptV3(format, genotypeData, samples)
  })
})

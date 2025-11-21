import { bench, describe } from 'vitest'

// Version without charCodeAt (string comparison)
function parseGenotypesOnlyStringComparison(
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

// Version with charCodeAt (numeric comparison)
function parseGenotypesOnlyCharCodeAt(
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
      const val = prerest.slice(sampleStart, tabIdx)
      const valLen = val.length
      let colons = 0
      let fieldStart = 0
      for (let j = 0; j <= valLen; j++) {
        if (j === valLen || val.charCodeAt(j) === COLON) {
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

describe('100 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('100 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT:DP:GQ')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('100 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'DP:GQ:GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('1000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('1000 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT:DP:GQ')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('1000 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'DP:GQ:GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ (GT first)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

describe('5000 samples - DP:GQ:GT (GT not first)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'DP:GQ:GT')

  bench('string comparison', () => {
    parseGenotypesOnlyStringComparison(format, genotypeData, samples)
  })

  bench('charCodeAt', () => {
    parseGenotypesOnlyCharCodeAt(format, genotypeData, samples)
  })
})

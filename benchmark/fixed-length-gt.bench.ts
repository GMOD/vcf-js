import { bench, describe } from 'vitest'

// Current implementation
function parseGenotypesOnlyCurrent(
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

// Optimized: fast path for 3-character GT when GT is only field
function parseGenotypesOnlyFixedLengthOpt(
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
    // Fast path: check if all GTs are exactly 3 characters
    // Common pattern: "0/1\t0/0\t1/1\t..." where each GT is 3 chars + tab
    const expectedLen = samplesLen * 4 - 1 // 3 chars per GT + tab, minus last tab
    if (prerestLen === expectedLen) {
      // All GTs are exactly 3 characters - use fast path
      for (let idx = 0; idx < samplesLen; idx++) {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4 // 3 chars + tab
      }
    } else {
      // Variable length GTs - use standard path
      for (let idx = 0; idx < samplesLen; idx++) {
        const start = pos
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        genotypes[samples[idx]!] = prerest.slice(start, pos)
        pos++
      }
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

// More aggressive: assume 3-char GT and verify inline
function parseGenotypesOnlyFixedLengthOpt2(
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
    // Assume 3-char GT, verify and fallback if wrong
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 <= prerestLen && (pos + 3 === prerestLen || prerest[pos + 3] === '\t')) {
        // Fast path: GT is exactly 3 characters
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4 // 3 chars + tab
      } else {
        // Slow path: variable length GT
        const start = pos
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        genotypes[samples[idx]!] = prerest.slice(start, pos)
        pos++
      }
    }
  } else if (gtIdx === 0) {
    // Assume 3-char GT followed by colon, verify inline
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 <= prerestLen && prerest[pos + 3] === ':') {
        // Fast path: GT is exactly 3 characters followed by colon
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4 // move past "GT:"
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        pos++
      } else {
        // Slow path: variable length GT
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

function generateTestData(numSamples: number, format: string, fixedLength: boolean) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)

  let genotypeData: string
  if (format === 'GT') {
    if (fixedLength) {
      // All 3-character GTs
      genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
    } else {
      // Mix of 1, 2, and 3 character GTs
      const gts = ['.', '0', '1', '0/1', '0|1', '1/1', './.', '.|.']
      genotypeData = Array.from({ length: numSamples }, (_, i) => gts[i % gts.length]!).join('\t')
    }
  } else if (format === 'GT:DP:GQ') {
    if (fixedLength) {
      genotypeData = Array.from({ length: numSamples }, () => '0/1:23:99').join('\t')
    } else {
      const gts = ['.:23:99', '0:23:99', '0/1:23:99', '1/1:23:99', './.:23:99']
      genotypeData = Array.from({ length: numSamples }, (_, i) => gts[i % gts.length]!).join('\t')
    }
  } else if (format === 'DP:GQ:GT') {
    if (fixedLength) {
      genotypeData = Array.from({ length: numSamples }, () => '23:99:0/1').join('\t')
    } else {
      const gts = ['23:99:.', '23:99:0', '23:99:0/1', '23:99:1/1', '23:99:./.']
      genotypeData = Array.from({ length: numSamples }, (_, i) => gts[i % gts.length]!).join('\t')
    }
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }

  return { samples, genotypeData, format }
}

describe('1000 samples - GT only - FIXED 3-char (best case)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', true)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

describe('1000 samples - GT only - VARIABLE length (worst case)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', false)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only - FIXED 3-char (best case)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT', true)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only - VARIABLE length (worst case)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT', false)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ - FIXED 3-char GT (best case)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ', true)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ - VARIABLE length GT (worst case)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ', false)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('opt1: pre-check length', () => {
    parseGenotypesOnlyFixedLengthOpt(format, genotypeData, samples)
  })

  bench('opt2: inline check', () => {
    parseGenotypesOnlyFixedLengthOpt2(format, genotypeData, samples)
  })
})

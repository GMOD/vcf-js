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

// Optimized: Check if next char after 3 is tab/colon, if so use fast path
function parseGenotypesOnlyThreeCharOpt(
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
    // GT is the only field - check if char at pos+3 is tab (or end)
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 <= prerestLen && (pos + 3 === prerestLen || prerest[pos + 3] === '\t')) {
        // Fast path: GT is exactly 3 characters
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4
      } else {
        // Slow path: scan for tab
        const start = pos
        while (pos < prerestLen && prerest[pos] !== '\t') pos++
        genotypes[samples[idx]!] = prerest.slice(start, pos)
        pos++
      }
    }
  } else if (gtIdx === 0) {
    // GT is first - check if char at pos+3 is colon (or tab/end)
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 <= prerestLen && (prerest[pos + 3] === ':' || prerest[pos + 3] === '\t' || pos + 3 === prerestLen)) {
        // Fast path: GT is exactly 3 characters
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        if (prerest[pos + 3] === ':') {
          pos += 4
          while (pos < prerestLen && prerest[pos] !== '\t') pos++
          pos++
        } else {
          pos += 4
        }
      } else {
        // Slow path: scan for colon/tab
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

// Even more aggressive: check position 3 FIRST before bounds check
function parseGenotypesOnlyThreeCharOpt2(
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
      const pos3 = pos + 3
      if (pos3 < prerestLen) {
        if (prerest[pos3] === '\t') {
          // Fast path: exactly 3 chars
          genotypes[samples[idx]!] = prerest.slice(pos, pos3)
          pos = pos3 + 1
          continue
        }
      } else if (pos3 === prerestLen) {
        // Last sample, exactly 3 chars
        genotypes[samples[idx]!] = prerest.slice(pos, pos3)
        pos = pos3
        continue
      }
      // Slow path
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const pos3 = pos + 3
      if (pos3 < prerestLen) {
        const char3 = prerest[pos3]
        if (char3 === ':' || char3 === '\t') {
          // Fast path: exactly 3 chars
          genotypes[samples[idx]!] = prerest.slice(pos, pos3)
          pos = pos3 + 1
          if (char3 === ':') {
            while (pos < prerestLen && prerest[pos] !== '\t') pos++
            pos++
          }
          continue
        }
      } else if (pos3 === prerestLen) {
        // Last sample, exactly 3 chars
        genotypes[samples[idx]!] = prerest.slice(pos, pos3)
        pos = pos3
        continue
      }
      // Slow path
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

function generateTestData(numSamples: number, format: string, threeCharPercent: number) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)

  let genotypeData: string
  if (format === 'GT') {
    const threeChar = ['0/1', '0|1', '1/1', '0/0', '1/0']
    const other = ['.', '0', '1', './.', '.|.', '10/11', '2/3']
    genotypeData = Array.from({ length: numSamples }, (_, i) => {
      const useThreeChar = (i % 100) < threeCharPercent
      const arr = useThreeChar ? threeChar : other
      return arr[i % arr.length]!
    }).join('\t')
  } else if (format === 'GT:DP:GQ') {
    const threeChar = ['0/1:23:99', '0|1:23:99', '1/1:23:99', '0/0:23:99']
    const other = ['.:23:99', '0:23:99', '1:23:99', './.:23:99', '10/11:23:99']
    genotypeData = Array.from({ length: numSamples }, (_, i) => {
      const useThreeChar = (i % 100) < threeCharPercent
      const arr = useThreeChar ? threeChar : other
      return arr[i % arr.length]!
    }).join('\t')
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }

  return { samples, genotypeData, format }
}

describe('1000 samples - GT only - 100% three-char', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', 100)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('1000 samples - GT only - 90% three-char', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', 90)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('1000 samples - GT only - 50% three-char', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', 50)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only - 100% three-char', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT', 100)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT only - 90% three-char', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT', 90)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ - 100% three-char GT', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ', 100)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

describe('5000 samples - GT:DP:GQ - 90% three-char GT', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ', 90)

  bench('current', () => {
    parseGenotypesOnlyCurrent(format, genotypeData, samples)
  })

  bench('three-char opt v1', () => {
    parseGenotypesOnlyThreeCharOpt(format, genotypeData, samples)
  })

  bench('three-char opt v2', () => {
    parseGenotypesOnlyThreeCharOpt2(format, genotypeData, samples)
  })
})

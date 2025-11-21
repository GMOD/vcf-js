import { bench, describe } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Optimized v2: Check total length first (no scanning)
function parseGenotypesConsistentPloidyV2(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>

  const samplesLen = samples.length
  const prerestLen = prerest.length
  const TAB = 9
  const COLON = 58
  let pos = 0

  // Fast path: format is exactly "GT"
  if (format === 'GT') {
    // Check if total length matches all-3-char-GTs pattern
    const expectedLen = samplesLen * 4 - 1 // (3 chars + tab) * samples - last tab
    if (prerestLen === expectedLen && samplesLen > 10) {
      // Ultra-fast path: all GTs are exactly 3 characters (no checking needed!)
      for (let idx = 0; idx < samplesLen; idx++) {
        genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
        pos += 4
      }
      return genotypes
    }

    // Standard fast path with 3-char checking
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 < prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        const c3 = prerest.charCodeAt(pos + 3)
        if (c3 === TAB && c0 !== TAB && c1 !== TAB && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos += 4
          continue
        }
      } else if (pos + 3 === prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        if (c0 !== TAB && c1 !== TAB && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos = prerestLen
          continue
        }
      }
      const start = pos
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
    return genotypes
  }

  // Check if GT field exists
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return genotypes
  }

  // GT is first field but not only field
  if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 < prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        const c3 = prerest.charCodeAt(pos + 3)
        if ((c3 === COLON || c3 === TAB) && c0 !== COLON && c0 !== TAB && c1 !== COLON && c1 !== TAB && c2 !== COLON && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          if (c3 === COLON) {
            pos += 4
            while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) pos++
            pos++
          } else {
            pos += 4
          }
          continue
        }
      } else if (pos + 3 === prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        if (c0 !== COLON && c0 !== TAB && c1 !== COLON && c1 !== TAB && c2 !== COLON && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos = prerestLen
          continue
        }
      }
      const start = pos
      while (pos < prerestLen && prerest.charCodeAt(pos) !== COLON && prerest.charCodeAt(pos) !== TAB)
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
      while (tabIdx < prerestLen && prerest.charCodeAt(tabIdx) !== TAB) tabIdx++

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

function generateTestData(numSamples: number, format: string, allSamePloidy: boolean) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)

  let genotypeData: string
  if (format === 'GT') {
    if (allSamePloidy) {
      genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
    } else {
      const gts = ['0', '0/1', '1', '0|1', './.']
      genotypeData = Array.from({ length: numSamples }, (_, i) => gts[i % gts.length]!).join('\t')
    }
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }

  return { samples, genotypeData, format }
}

describe('1000 samples - GT only - all same ploidy (diploid)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', true)

  bench('current implementation', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })

  bench('consistent ploidy v2 (length check only)', () => {
    parseGenotypesConsistentPloidyV2(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('5000 samples - GT only - all same ploidy (diploid)', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT', true)

  bench('current implementation', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })

  bench('consistent ploidy v2 (length check only)', () => {
    parseGenotypesConsistentPloidyV2(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('10000 samples - GT only - all same ploidy (diploid)', () => {
  const { samples, genotypeData, format } = generateTestData(10000, 'GT', true)

  bench('current implementation', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })

  bench('consistent ploidy v2 (length check only)', () => {
    parseGenotypesConsistentPloidyV2(format, genotypeData, samples)
  }, { time: 4000 })
})

describe('1000 samples - GT only - mixed ploidy (worst case)', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT', false)

  bench('current implementation', () => {
    parseGenotypesOnly(format, genotypeData, samples)
  }, { time: 4000 })

  bench('consistent ploidy v2 (length check only)', () => {
    parseGenotypesConsistentPloidyV2(format, genotypeData, samples)
  }, { time: 4000 })
})

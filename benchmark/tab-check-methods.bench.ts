import { bench, describe } from 'vitest'

// Current: explicit character checks
function method1_explicitChecks(prerest: string, pos: number, prerestLen: number): boolean {
  return pos + 3 < prerestLen &&
         prerest[pos + 3] === '\t' &&
         prerest[pos] !== '\t' &&
         prerest[pos + 1] !== '\t' &&
         prerest[pos + 2] !== '\t'
}

// Method 2: Find first tab position
function method2_findTab(prerest: string, pos: number, prerestLen: number): boolean {
  if (pos + 3 >= prerestLen) return false
  let i = pos
  while (i < pos + 3 && prerest[i] !== '\t') i++
  return i === pos + 3 && prerest[pos + 3] === '\t'
}

// Method 3: Substring slice check (baseline - likely slower)
function method3_slice(prerest: string, pos: number, prerestLen: number): boolean {
  if (pos + 3 >= prerestLen) return false
  const substr = prerest.slice(pos, pos + 3)
  return prerest[pos + 3] === '\t' && substr.indexOf('\t') === -1
}

// Method 4: Combined check with bitwise OR
function method4_bitwise(prerest: string, pos: number, prerestLen: number): boolean {
  if (pos + 3 >= prerestLen) return false
  // Check if any char is tab using charCodeAt
  const c0 = prerest.charCodeAt(pos)
  const c1 = prerest.charCodeAt(pos + 1)
  const c2 = prerest.charCodeAt(pos + 2)
  const c3 = prerest.charCodeAt(pos + 3)
  // Tab is charCode 9
  return c3 === 9 && c0 !== 9 && c1 !== 9 && c2 !== 9
}

// Method 5: Early exit optimization
function method5_earlyExit(prerest: string, pos: number, prerestLen: number): boolean {
  if (pos + 3 >= prerestLen || prerest[pos + 3] !== '\t') return false
  return prerest[pos] !== '\t' && prerest[pos + 1] !== '\t' && prerest[pos + 2] !== '\t'
}

// Method 6: Reorder checks (check most likely to fail first)
function method6_reordered(prerest: string, pos: number, prerestLen: number): boolean {
  // Most likely to fail: pos + 3 check
  if (pos + 3 >= prerestLen) return false
  if (prerest[pos + 3] !== '\t') return false
  // For 3-char GTs, pos+1 is most likely to be a separator (/ or |)
  // so it's least likely to be tab - check it last
  if (prerest[pos] === '\t') return false
  if (prerest[pos + 2] === '\t') return false
  if (prerest[pos + 1] === '\t') return false
  return true
}

function generateTestData(numSamples: number, threeCharPercent: number) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)
  const threeChar = ['0/1', '0|1', '1/1', '0/0', '1/0']
  const other = ['.', '0', '1', './.', '.|.', '10/11']
  const genotypeData = Array.from({ length: numSamples }, (_, i) => {
    const useThreeChar = (i % 100) < threeCharPercent
    const arr = useThreeChar ? threeChar : other
    return arr[i % arr.length]!
  }).join('\t')

  return { samples, genotypeData }
}

describe('100% 3-char GTs (best case for fast path)', () => {
  const { genotypeData } = generateTestData(1000, 100)
  const prerestLen = genotypeData.length

  bench('method1: explicit checks', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method1_explicitChecks(genotypeData, pos, prerestLen)
    }
  })

  bench('method2: find tab', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method2_findTab(genotypeData, pos, prerestLen)
    }
  })

  bench('method3: slice', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method3_slice(genotypeData, pos, prerestLen)
    }
  })

  bench('method4: bitwise', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method4_bitwise(genotypeData, pos, prerestLen)
    }
  })

  bench('method5: early exit', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method5_earlyExit(genotypeData, pos, prerestLen)
    }
  })

  bench('method6: reordered', () => {
    for (let pos = 0; pos < prerestLen; pos += 4) {
      method6_reordered(genotypeData, pos, prerestLen)
    }
  })
})

describe('50% 3-char GTs (mixed case)', () => {
  const { genotypeData } = generateTestData(1000, 50)
  const prerestLen = genotypeData.length

  bench('method1: explicit checks', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method1_explicitChecks(genotypeData, pos, prerestLen)
    }
  })

  bench('method2: find tab', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method2_findTab(genotypeData, pos, prerestLen)
    }
  })

  bench('method3: slice', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method3_slice(genotypeData, pos, prerestLen)
    }
  })

  bench('method4: bitwise', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method4_bitwise(genotypeData, pos, prerestLen)
    }
  })

  bench('method5: early exit', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method5_earlyExit(genotypeData, pos, prerestLen)
    }
  })

  bench('method6: reordered', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method6_reordered(genotypeData, pos, prerestLen)
    }
  })
})

describe('0% 3-char GTs (worst case - all haploid)', () => {
  const genotypeData = Array.from({ length: 1000 }, () => '0').join('\t')
  const prerestLen = genotypeData.length

  bench('method1: explicit checks', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method1_explicitChecks(genotypeData, pos, prerestLen)
    }
  })

  bench('method2: find tab', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method2_findTab(genotypeData, pos, prerestLen)
    }
  })

  bench('method3: slice', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method3_slice(genotypeData, pos, prerestLen)
    }
  })

  bench('method4: bitwise', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method4_bitwise(genotypeData, pos, prerestLen)
    }
  })

  bench('method5: early exit', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method5_earlyExit(genotypeData, pos, prerestLen)
    }
  })

  bench('method6: reordered', () => {
    for (let pos = 0; pos < prerestLen; pos += 2) {
      method6_reordered(genotypeData, pos, prerestLen)
    }
  })
})

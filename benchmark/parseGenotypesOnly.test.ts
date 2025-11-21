import { expect, test } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

// Import optimized versions from bench file would be ideal, but for testing let's inline them

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
  let start = 0

  if (format.length === 2) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const tabIdx = prerest.indexOf('\t', start)
      const val =
        tabIdx === -1 ? prerest.slice(start) : prerest.slice(start, tabIdx)
      genotypes[samples[idx]!] = val
      start = tabIdx + 1
      if (tabIdx === -1) break
    }
  } else if (gtIdx === 0) {
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
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
      const val = prerest.slice(start, pos)
      const colonIdx = val.indexOf(':')
      genotypes[samples[idx]!] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
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
      pos++
    }
  }

  return genotypes
}

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
      pos++
    }
  }

  return genotypes
}

test('optimized versions match original - GT only', () => {
  const original = parseGenotypesOnly('GT', './.\t./.', ['h1', 'h2'])
  const v1 = parseGenotypesOnlyOptV1('GT', './.\t./.', ['h1', 'h2'])
  const v2 = parseGenotypesOnlyOptV2('GT', './.\t./.', ['h1', 'h2'])
  const v3 = parseGenotypesOnlyOptV3('GT', './.\t./.', ['h1', 'h2'])

  expect(v1).toEqual(original)
  expect(v2).toEqual(original)
  expect(v3).toEqual(original)
})

test('optimized versions match original - GT:RT', () => {
  const original = parseGenotypesOnly('GT:RT', './.:1\t./.', ['h1', 'h2'])
  const v1 = parseGenotypesOnlyOptV1('GT:RT', './.:1\t./.', ['h1', 'h2'])
  const v2 = parseGenotypesOnlyOptV2('GT:RT', './.:1\t./.', ['h1', 'h2'])
  const v3 = parseGenotypesOnlyOptV3('GT:RT', './.:1\t./.', ['h1', 'h2'])

  expect(v1).toEqual(original)
  expect(v2).toEqual(original)
  expect(v3).toEqual(original)
})

test('optimized versions match original - RT:GT', () => {
  const original = parseGenotypesOnly('RT:GT', '1:./.\t2:./.', ['h1', 'h2'])
  const v1 = parseGenotypesOnlyOptV1('RT:GT', '1:./.\t2:./.', ['h1', 'h2'])
  const v2 = parseGenotypesOnlyOptV2('RT:GT', '1:./.\t2:./.', ['h1', 'h2'])
  const v3 = parseGenotypesOnlyOptV3('RT:GT', '1:./.\t2:./.', ['h1', 'h2'])

  expect(v1).toEqual(original)
  expect(v2).toEqual(original)
  expect(v3).toEqual(original)
})

test('optimized versions match original - many samples', () => {
  const samples = Array.from({ length: 100 }, (_, i) => `S${i}`)
  const data = Array.from({ length: 100 }, () => '0/1:45:99').join('\t')

  const original = parseGenotypesOnly('GT:DP:GQ', data, samples)
  const v1 = parseGenotypesOnlyOptV1('GT:DP:GQ', data, samples)
  const v2 = parseGenotypesOnlyOptV2('GT:DP:GQ', data, samples)
  const v3 = parseGenotypesOnlyOptV3('GT:DP:GQ', data, samples)

  expect(v1).toEqual(original)
  expect(v2).toEqual(original)
  expect(v3).toEqual(original)
})

test('optimized versions match original - GT not first, many samples', () => {
  const samples = Array.from({ length: 100 }, (_, i) => `S${i}`)
  const data = Array.from({ length: 100 }, () => '45:99:0/1').join('\t')

  const original = parseGenotypesOnly('DP:GQ:GT', data, samples)
  const v1 = parseGenotypesOnlyOptV1('DP:GQ:GT', data, samples)
  const v2 = parseGenotypesOnlyOptV2('DP:GQ:GT', data, samples)
  const v3 = parseGenotypesOnlyOptV3('DP:GQ:GT', data, samples)

  expect(v1).toEqual(original)
  expect(v2).toEqual(original)
  expect(v3).toEqual(original)
})

import { expect, test } from 'vitest'

import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

test('last sample with 3-char GT and no trailing tab', () => {
  // Single sample, no trailing tab
  const result = parseGenotypesOnly('GT', '0/1', ['S1'])
  expect(result).toEqual({ S1: '0/1' })
})

test('last sample with 3-char GT in multi-sample', () => {
  // Multiple samples, last one is 3-char with no trailing tab
  const result = parseGenotypesOnly('GT', '0/1\t1/1', ['S1', 'S2'])
  expect(result).toEqual({ S1: '0/1', S2: '1/1' })
})

test('last sample with non-3-char GT', () => {
  const result = parseGenotypesOnly('GT', '0/1\t.', ['S1', 'S2'])
  expect(result).toEqual({ S1: '0/1', S2: '.' })
})

test('single sample with 1-char GT', () => {
  const result = parseGenotypesOnly('GT', '.', ['S1'])
  expect(result).toEqual({ S1: '.' })
})

test('GT:DP:GQ - last sample with 3-char GT', () => {
  const result = parseGenotypesOnly('GT:DP:GQ', '0/1:20:99', ['S1'])
  expect(result).toEqual({ S1: '0/1' })
})

test('GT:DP:GQ - multiple samples, last with 3-char GT', () => {
  const result = parseGenotypesOnly('GT:DP:GQ', '0/1:20:99\t1/1:30:99', [
    'S1',
    'S2',
  ])
  expect(result).toEqual({ S1: '0/1', S2: '1/1' })
})

test('GT:DP:GQ - last sample with 1-char GT', () => {
  const result = parseGenotypesOnly('GT:DP:GQ', '0/1:20:99\t.:30:99', [
    'S1',
    'S2',
  ])
  expect(result).toEqual({ S1: '0/1', S2: '.' })
})

test('empty prerest string', () => {
  // Returns empty string for sample when no data present
  const result = parseGenotypesOnly('GT', '', ['S1'])
  expect(result).toEqual({ S1: '' })
})

test('more samples than data', () => {
  // Returns empty strings for samples beyond available data
  const result = parseGenotypesOnly('GT', '0/1', ['S1', 'S2', 'S3'])
  expect(result).toEqual({ S1: '0/1', S2: '', S3: '' })
})

test('haploid genotypes - single character', () => {
  const result = parseGenotypesOnly('GT', '0\t1\t0\t1\t0', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
  ])
  expect(result).toEqual({ S1: '0', S2: '1', S3: '0', S4: '1', S5: '0' })
})

test('haploid genotypes - with missing', () => {
  const result = parseGenotypesOnly('GT', '0\t.\t1\t.\t0', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
  ])
  expect(result).toEqual({ S1: '0', S2: '.', S3: '1', S4: '.', S5: '0' })
})

test('haploid genotypes - multi-allelic', () => {
  const result = parseGenotypesOnly('GT', '0\t1\t2\t3\t4\t5', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
  ])
  expect(result).toEqual({
    S1: '0',
    S2: '1',
    S3: '2',
    S4: '3',
    S5: '4',
    S6: '5',
  })
})

test('haploid genotypes - double-digit alleles', () => {
  const result = parseGenotypesOnly('GT', '10\t11\t20\t99', [
    'S1',
    'S2',
    'S3',
    'S4',
  ])
  expect(result).toEqual({ S1: '10', S2: '11', S3: '20', S4: '99' })
})

test('haploid genotypes - triple-digit alleles', () => {
  const result = parseGenotypesOnly('GT', '100\t200\t999', ['S1', 'S2', 'S3'])
  expect(result).toEqual({ S1: '100', S2: '200', S3: '999' })
})

test('haploid genotypes - many samples', () => {
  const samples = Array.from({ length: 50 }, (_, i) => `S${i}`)
  const gts = Array.from({ length: 50 }, (_, i) => String(i % 2))
  const result = parseGenotypesOnly('GT', gts.join('\t'), samples)

  const expected = {} as Record<string, string>
  samples.forEach((s, i) => {
    expected[s] = gts[i]!
  })

  expect(result).toEqual(expected)
})

test('haploid genotypes - ending without tab', () => {
  const result = parseGenotypesOnly('GT', '0\t1\t2', ['S1', 'S2', 'S3'])
  expect(result).toEqual({ S1: '0', S2: '1', S3: '2' })
})

test('haploid genotypes - single sample', () => {
  const result = parseGenotypesOnly('GT', '1', ['S1'])
  expect(result).toEqual({ S1: '1' })
})

test('mixed diploid and haploid genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/1\t0\t1/1\t1\t0/0\t.', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
  ])
  expect(result).toEqual({
    S1: '0/1',
    S2: '0',
    S3: '1/1',
    S4: '1',
    S5: '0/0',
    S6: '.',
  })
})

test('haploid with GT:DP:GQ format', () => {
  const result = parseGenotypesOnly(
    'GT:DP:GQ',
    '0:20:99\t1:25:99\t0:30:99\t.:15:50',
    ['S1', 'S2', 'S3', 'S4'],
  )
  expect(result).toEqual({ S1: '0', S2: '1', S3: '0', S4: '.' })
})

test('many samples with 3-char diploid GTs', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/1\t1/1\t0/0\t0/1\t1/0\t0/1\t1/1\t0/0\t0/1\t1/0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'],
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/1',
    S3: '0/0',
    S4: '0/1',
    S5: '1/0',
    S6: '0/1',
    S7: '1/1',
    S8: '0/0',
    S9: '0/1',
    S10: '1/0',
  })
})

test('many samples with phased 3-char GTs', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0|1\t1|1\t0|0\t0|1\t1|0\t0|1\t1|1\t0|0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  )
  expect(result).toEqual({
    S1: '0|1',
    S2: '1|1',
    S3: '0|0',
    S4: '0|1',
    S5: '1|0',
    S6: '0|1',
    S7: '1|1',
    S8: '0|0',
  })
})

test('many samples with GT:DP:GQ format', () => {
  const result = parseGenotypesOnly(
    'GT:DP:GQ',
    '0/1:20:99\t1/1:25:99\t0/0:30:99\t.:15:50\t0/1:22:99\t1/0:28:99',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/1',
    S3: '0/0',
    S4: '.',
    S5: '0/1',
    S6: '1/0',
  })
})

test('many samples with DP:GQ:GT format', () => {
  const result = parseGenotypesOnly(
    'DP:GQ:GT',
    '20:99:0/1\t25:99:1/1\t30:99:0/0\t15:50:.\t22:99:0/1\t28:99:1/0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/1',
    S3: '0/0',
    S4: '.',
    S5: '0/1',
    S6: '1/0',
  })
})

test('complex multi-allelic genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/1\t1/2\t2/2\t0/2\t1/1\t./.', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
  ])
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/2',
    S3: '2/2',
    S4: '0/2',
    S5: '1/1',
    S6: './.',
  })
})

test('triploid genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/0/1\t0/1/1\t1/1/1\t0/0/0', [
    'S1',
    'S2',
    'S3',
    'S4',
  ])
  expect(result).toEqual({
    S1: '0/0/1',
    S2: '0/1/1',
    S3: '1/1/1',
    S4: '0/0/0',
  })
})

test('tetraploid genotypes', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/0/0/1\t0/1/1/1\t1/1/1/1\t0/0/0/0',
    ['S1', 'S2', 'S3', 'S4'],
  )
  expect(result).toEqual({
    S1: '0/0/0/1',
    S2: '0/1/1/1',
    S3: '1/1/1/1',
    S4: '0/0/0/0',
  })
})

test('hexaploid genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/0/0/0/0/1\t0/1/1/1/1/1', [
    'S1',
    'S2',
  ])
  expect(result).toEqual({
    S1: '0/0/0/0/0/1',
    S2: '0/1/1/1/1/1',
  })
})

test('mixed ploidy - haploid, diploid, triploid, tetraploid', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0\t0/1\t0/1/2\t0/1/2/3\t1\t./.\t0/0/0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'],
  )
  expect(result).toEqual({
    S1: '0',
    S2: '0/1',
    S3: '0/1/2',
    S4: '0/1/2/3',
    S5: '1',
    S6: './.',
    S7: '0/0/0',
  })
})

test('polyploid with phased genotypes', () => {
  const result = parseGenotypesOnly('GT', '0|0|1\t0|1|1\t1|1|1\t0|0|0', [
    'S1',
    'S2',
    'S3',
    'S4',
  ])
  expect(result).toEqual({
    S1: '0|0|1',
    S2: '0|1|1',
    S3: '1|1|1',
    S4: '0|0|0',
  })
})

test('polyploid with multi-allelic variants', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/1/2\t1/2/3\t2/3/4\t0/0/0\t./././.',
    ['S1', 'S2', 'S3', 'S4', 'S5'],
  )
  expect(result).toEqual({
    S1: '0/1/2',
    S2: '1/2/3',
    S3: '2/3/4',
    S4: '0/0/0',
    S5: './././.',
  })
})

test('large scale mixed ploidy', () => {
  const samples = Array.from({ length: 20 }, (_, i) => `S${i}`)
  const gts = [
    '0',
    '0/1',
    '0/1/2',
    '0/1/2/3',
    '1',
    '1/1',
    '0/0/0',
    '1/1/1/1',
    '.',
    './.',
    '0',
    '0/1',
    '0/1/2',
    '0/1/2/3',
    '1',
    '1/1',
    '0/0/0',
    '1/1/1/1',
    '.',
    './.',
  ]
  const result = parseGenotypesOnly('GT', gts.join('\t'), samples)

  const expected = {} as Record<string, string>
  samples.forEach((s, i) => {
    expected[s] = gts[i]!
  })

  expect(result).toEqual(expected)
})

test('very long polyploid genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/1/2/3/4/5/6/7\t0/0/0/0/0/0/0/0', [
    'S1',
    'S2',
  ])
  expect(result).toEqual({
    S1: '0/1/2/3/4/5/6/7',
    S2: '0/0/0/0/0/0/0/0',
  })
})

test('polyploid with double-digit alleles', () => {
  const result = parseGenotypesOnly('GT', '0/10/20\t10/11/12\t0/0/0', [
    'S1',
    'S2',
    'S3',
  ])
  expect(result).toEqual({
    S1: '0/10/20',
    S2: '10/11/12',
    S3: '0/0/0',
  })
})

test('mixed ploidy ending with haploid', () => {
  const result = parseGenotypesOnly('GT', '0/1\t0/1/2\t0/1/2/3\t1', [
    'S1',
    'S2',
    'S3',
    'S4',
  ])
  expect(result).toEqual({
    S1: '0/1',
    S2: '0/1/2',
    S3: '0/1/2/3',
    S4: '1',
  })
})

test('mixed ploidy ending with polyploid', () => {
  const result = parseGenotypesOnly('GT', '0\t0/1\t0/1/2/3/4', [
    'S1',
    'S2',
    'S3',
  ])
  expect(result).toEqual({
    S1: '0',
    S2: '0/1',
    S3: '0/1/2/3/4',
  })
})

test('alternating ploidy pattern', () => {
  const result = parseGenotypesOnly('GT', '0\t0/1\t0\t0/1\t0\t0/1\t0\t0/1', [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
    'S7',
    'S8',
  ])
  expect(result).toEqual({
    S1: '0',
    S2: '0/1',
    S3: '0',
    S4: '0/1',
    S5: '0',
    S6: '0/1',
    S7: '0',
    S8: '0/1',
  })
})

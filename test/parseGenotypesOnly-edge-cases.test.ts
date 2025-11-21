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
  const result = parseGenotypesOnly('GT:DP:GQ', '0/1:20:99\t1/1:30:99', ['S1', 'S2'])
  expect(result).toEqual({ S1: '0/1', S2: '1/1' })
})

test('GT:DP:GQ - last sample with 1-char GT', () => {
  const result = parseGenotypesOnly('GT:DP:GQ', '0/1:20:99\t.:30:99', ['S1', 'S2'])
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
  const result = parseGenotypesOnly('GT', '0\t1\t0\t1\t0', ['S1', 'S2', 'S3', 'S4', 'S5'])
  expect(result).toEqual({ S1: '0', S2: '1', S3: '0', S4: '1', S5: '0' })
})

test('haploid genotypes - with missing', () => {
  const result = parseGenotypesOnly('GT', '0\t.\t1\t.\t0', ['S1', 'S2', 'S3', 'S4', 'S5'])
  expect(result).toEqual({ S1: '0', S2: '.', S3: '1', S4: '.', S5: '0' })
})

test('mixed diploid and haploid genotypes', () => {
  const result = parseGenotypesOnly('GT', '0/1\t0\t1/1\t1\t0/0\t.', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])
  expect(result).toEqual({ S1: '0/1', S2: '0', S3: '1/1', S4: '1', S5: '0/0', S6: '.' })
})

test('haploid with GT:DP:GQ format', () => {
  const result = parseGenotypesOnly('GT:DP:GQ', '0:20:99\t1:25:99\t0:30:99\t.:15:50', ['S1', 'S2', 'S3', 'S4'])
  expect(result).toEqual({ S1: '0', S2: '1', S3: '0', S4: '.' })
})

test('many samples with 3-char diploid GTs', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/1\t1/1\t0/0\t0/1\t1/0\t0/1\t1/1\t0/0\t0/1\t1/0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']
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
    S10: '1/0'
  })
})

test('many samples with phased 3-char GTs', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0|1\t1|1\t0|0\t0|1\t1|0\t0|1\t1|1\t0|0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
  )
  expect(result).toEqual({
    S1: '0|1',
    S2: '1|1',
    S3: '0|0',
    S4: '0|1',
    S5: '1|0',
    S6: '0|1',
    S7: '1|1',
    S8: '0|0'
  })
})

test('many samples with GT:DP:GQ format', () => {
  const result = parseGenotypesOnly(
    'GT:DP:GQ',
    '0/1:20:99\t1/1:25:99\t0/0:30:99\t.:15:50\t0/1:22:99\t1/0:28:99',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/1',
    S3: '0/0',
    S4: '.',
    S5: '0/1',
    S6: '1/0'
  })
})

test('many samples with DP:GQ:GT format', () => {
  const result = parseGenotypesOnly(
    'DP:GQ:GT',
    '20:99:0/1\t25:99:1/1\t30:99:0/0\t15:50:.\t22:99:0/1\t28:99:1/0',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/1',
    S3: '0/0',
    S4: '.',
    S5: '0/1',
    S6: '1/0'
  })
})

test('complex multi-allelic genotypes', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/1\t1/2\t2/2\t0/2\t1/1\t./.',
    ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
  )
  expect(result).toEqual({
    S1: '0/1',
    S2: '1/2',
    S3: '2/2',
    S4: '0/2',
    S5: '1/1',
    S6: './.'
  })
})

test('triploid genotypes', () => {
  const result = parseGenotypesOnly(
    'GT',
    '0/0/1\t0/1/1\t1/1/1\t0/0/0',
    ['S1', 'S2', 'S3', 'S4']
  )
  expect(result).toEqual({
    S1: '0/0/1',
    S2: '0/1/1',
    S3: '1/1/1',
    S4: '0/0/0'
  })
})

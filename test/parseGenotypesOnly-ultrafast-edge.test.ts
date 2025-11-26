import { expect, test } from 'vitest'

import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

test('ultra-fast path should not be tricked by mixed ploidy with matching length', () => {
  // 4 samples with total length = 15 = 4*4-1
  // Mix of triploid (5 chars) and haploid (1 char)
  const result = parseGenotypesOnly('GT', '0/1/2\t0\t1/2/3\t1', [
    'S1',
    'S2',
    'S3',
    'S4',
  ])

  // Should correctly parse each genotype
  expect(result).toEqual({
    S1: '0/1/2',
    S2: '0',
    S3: '1/2/3',
    S4: '1',
  })
})

test('another ultra-fast path edge case with >10 samples', () => {
  // 11 samples: mix to create length = 11*4-1 = 43
  // Need: 43 chars total
  // Try: 5 × 5-char + 6 × 1-char = 5*6 + 6*2 - 1 = 30 + 12 - 1 = 41 (not quite)
  // Try: 6 × 5-char + 5 × 1-char = 6*6 + 5*2 - 1 = 36 + 10 - 1 = 45 (too much)
  // Try: different mix... let's calculate properly
  // For 12 samples: expected = 47
  // 6 × 5-char + 6 × 1-char = 6*6 + 6*2 - 1 = 36 + 12 - 1 = 47 ✓
  const data = '0/1/2\t0\t1/2/3\t1\t2/3/4\t2\t3/4/5\t3\t4/5/6\t4\t5/6/7\t5'
  const samples = [
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
    'S7',
    'S8',
    'S9',
    'S10',
    'S11',
    'S12',
  ]
  const result = parseGenotypesOnly('GT', data, samples)

  expect(result).toEqual({
    S1: '0/1/2',
    S2: '0',
    S3: '1/2/3',
    S4: '1',
    S5: '2/3/4',
    S6: '2',
    S7: '3/4/5',
    S8: '3',
    S9: '4/5/6',
    S10: '4',
    S11: '5/6/7',
    S12: '5',
  })
})

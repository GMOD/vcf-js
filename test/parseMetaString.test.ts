import { expect, test } from 'vitest'

import {
  parseMetaString,
  parseStructuredMetaVal,
} from '../src/parseMetaString.ts'

test('array in values', () => {
  const result1 = parseMetaString(
    '<ID=Assay,Type=String,Number=.,Values=[WholeGenome, Exome]>',
  )
  const result2 = parseMetaString(
    '<Values=[WholeGenome, Exome],ID=Assay,Type=String,Number=.>',
  )
  expect(result1).toEqual(result2)
  expect(result1).toMatchSnapshot()
})

test('quoted string with comma in description', () => {
  expect(
    parseMetaString(
      '<ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129">',
    ),
  ).toMatchSnapshot()
})

test('equals in description', () => {
  expect(
    parseMetaString(
      '<ID=AP,Number=2,Type=Float,Description="Allelic Probability, P(Allele=1|Haplotype)">',
    ),
  ).toMatchSnapshot()
})

test('parseStructuredMetaVal extracts ID and coerces numeric Number', () => {
  const [id, rest] = parseStructuredMetaVal(
    '<ID=DP,Number=1,Type=Integer,Description="depth">',
  )
  expect(id).toBe('DP')
  expect(rest).toEqual({
    Number: 1,
    Type: 'Integer',
    Description: 'depth',
  })
})

test('parseStructuredMetaVal leaves non-numeric Number as string', () => {
  const [id, rest] = parseStructuredMetaVal(
    '<ID=AF,Number=A,Type=Float,Description="alt freq">',
  )
  expect(id).toBe('AF')
  expect(rest.Number).toBe('A')
})

test('parseStructuredMetaVal returns undefined id when ID missing', () => {
  const [id, rest] = parseStructuredMetaVal(
    '<Description="ClinVar Variation ID">',
  )
  expect(id).toBeUndefined()
  expect(rest).toEqual({ Description: 'ClinVar Variation ID' })
})

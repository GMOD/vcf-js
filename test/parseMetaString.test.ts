import { expect, test } from 'vitest'
import { parseMetaString } from '../src/parseMetaString'

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

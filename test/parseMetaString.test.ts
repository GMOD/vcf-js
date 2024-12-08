import { expect, test } from 'vitest'
import { parseMetaString } from '../src/parseMetaString'

test('m1', () => {
  const result1 = parseMetaString(
    '<ID=Assay,Type=String,Number=.,Values=[WholeGenome, Exome]>',
  )
  const result2 = parseMetaString(
    '<Values=[WholeGenome, Exome],ID=Assay,Type=String,Number=.>',
  )
  expect(result1).toEqual(result2)
  expect(result1).toMatchSnapshot()
})

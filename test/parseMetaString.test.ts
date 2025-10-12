import { deepEqual, deepStrictEqual } from 'node:assert'
import { test } from 'node:test'

import { parseMetaString } from '../src/parseMetaString'

test('array in values', async () => {
  const result1 = parseMetaString(
    '<ID=Assay,Type=String,Number=.,Values=[WholeGenome, Exome]>',
  )
  const result2 = parseMetaString(
    '<Values=[WholeGenome, Exome],ID=Assay,Type=String,Number=.>',
  )
  deepEqual(result1, result2)
  
  // Since Node's test runner doesn't have snapshots built-in,
  // we'll explicitly define the expected output
  const expected = {
    ID: 'Assay',
    Type: 'String',
    Number: '.',
    Values: ['WholeGenome', 'Exome']
  }
  deepStrictEqual(result1, expected)
})

test('quoted string with comma in description', async () => {
  const result = parseMetaString(
    '<ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129">',
  )
  
  const expected = {
    ID: 'DB',
    Number: '0',
    Type: 'Flag',
    Description: 'dbSNP membership, build 129'
  }
  deepStrictEqual(result, expected)
})

test('equals in description', async () => {
  const result = parseMetaString(
    '<ID=AP,Number=2,Type=Float,Description="Allelic Probability, P(Allele=1|Haplotype)">',
  )
  
  const expected = {
    ID: 'AP',
    Number: '2',
    Type: 'Float',
    Description: 'Allelic Probability, P(Allele=1|Haplotype)'
  }
  deepStrictEqual(result, expected)
})

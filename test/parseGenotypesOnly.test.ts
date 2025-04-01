import { test, expect } from 'vitest'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

test('parse genotypes', () => {
  expect(parseGenotypesOnly('GT', './.\t./.', ['h1', 'h2'])).toMatchSnapshot()
  expect(
    parseGenotypesOnly('GT:RT', './.:1\t./.', ['h1', 'h2']),
  ).toMatchSnapshot()
  expect(
    parseGenotypesOnly('RT:GT', '1:./.\t2:./.', ['h1', 'h2']),
  ).toMatchSnapshot()
})

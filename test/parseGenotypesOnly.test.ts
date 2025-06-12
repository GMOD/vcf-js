import { test } from 'node:test'
import { deepEqual } from 'node:assert'
import { parseGenotypesOnly } from '../src/parseGenotypesOnly'

test('parse genotypes', async () => {
  // Since Node's test runner doesn't have snapshots built-in,
  // we'll explicitly define the expected output
  
  const result1 = parseGenotypesOnly('GT', './.\t./.', ['h1', 'h2'])
  const expected1 = {
    samples: ['h1', 'h2'],
    sampleData: [
      { GT: './.' },
      { GT: './.' }
    ]
  }
  deepEqual(result1, expected1)
  
  const result2 = parseGenotypesOnly('GT:RT', './.:1\t./.', ['h1', 'h2'])
  const expected2 = {
    samples: ['h1', 'h2'],
    sampleData: [
      { GT: './.', RT: '1' },
      { GT: './.' }
    ]
  }
  deepEqual(result2, expected2)
  
  const result3 = parseGenotypesOnly('RT:GT', '1:./.\t2:./.', ['h1', 'h2'])
  const expected3 = {
    samples: ['h1', 'h2'],
    sampleData: [
      { RT: '1', GT: './.' },
      { RT: '2', GT: './.' }
    ]
  }
  deepEqual(result3, expected3)
})

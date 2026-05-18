import { expect, test } from 'vitest'

import { parseInfo } from '../src/parseInfo.ts'

const meta = {
  DP: { Type: 'Integer' },
  AF: { Type: 'Float' },
  DB: { Type: 'Flag' },
  NS: { Type: 'String' },
}

test('Flag types become true regardless of value', () => {
  expect(parseInfo('DB', meta)).toEqual({ DB: true })
  expect(parseInfo('DB=0', meta)).toEqual({ DB: true })
})

test('keys without a value become true', () => {
  expect(parseInfo('SOMEFLAG', meta)).toEqual({ SOMEFLAG: true })
  expect(parseInfo('SOMEFLAG=', meta)).toEqual({ SOMEFLAG: true })
})

test('Integer and Float values are coerced to numbers', () => {
  expect(parseInfo('DP=10;AF=0.5', meta)).toEqual({
    DP: [10],
    AF: [0.5],
  })
})

test('comma-separated values split into arrays', () => {
  expect(parseInfo('AF=0.5,0.1,0.4', meta)).toEqual({
    AF: [0.5, 0.1, 0.4],
  })
})

test('dot entries become undefined within arrays', () => {
  expect(parseInfo('AF=0.5,.,0.1', meta)).toEqual({
    AF: [0.5, undefined, 0.1],
  })
})

test('unknown keys are kept as string arrays', () => {
  expect(parseInfo('UNK=foo,bar', meta)).toEqual({
    UNK: ['foo', 'bar'],
  })
})

test('percent-encoded values are URI-decoded for known string fields', () => {
  expect(parseInfo('NS=a%3Bb', meta)).toEqual({ NS: ['a;b'] })
})

test('invalid percent-encoded values do not throw', () => {
  expect(parseInfo('NS=%E0%A4%A', meta)).toEqual({ NS: ['%E0%A4%A'] })
})

test('multiple pairs separated by semicolons', () => {
  expect(parseInfo('DP=20;AF=0.25,0.75;DB;NS=foo', meta)).toEqual({
    DP: [20],
    AF: [0.25, 0.75],
    DB: true,
    NS: ['foo'],
  })
})

import { deepStrictEqual, strictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'

import { Breakend, parseBreakend } from '../src'

describe('testBreakend', () => {
  it('can parse breakends', () => {
    // Breakends from https://samtools.github.io/hts-specs/VCFv4.3.pdf
    const breakendsAndParsed = [
      [
        'G]17:198982]',
        {
          MatePosition: '17:198982',
          Join: 'right',
          Replacement: 'G',
          MateDirection: 'left',
        },
      ],
      [
        ']13:123456]T',
        {
          MatePosition: '13:123456',
          Join: 'left',
          Replacement: 'T',
          MateDirection: 'left',
        },
      ],
      [
        'C[2:321682[',
        {
          MatePosition: '2:321682',
          Join: 'right',
          Replacement: 'C',
          MateDirection: 'right',
        },
      ],
      [
        '[17:198983[A',
        {
          MatePosition: '17:198983',
          Join: 'left',
          Replacement: 'A',
          MateDirection: 'right',
        },
      ],
      [
        'A]2:321681]',
        {
          MatePosition: '2:321681',
          Join: 'right',
          Replacement: 'A',
          MateDirection: 'left',
        },
      ],
      [
        '[13:123457[C',
        {
          MatePosition: '13:123457',
          Join: 'left',
          Replacement: 'C',
          MateDirection: 'right',
        },
      ],
    ] as [string, Breakend][]
    breakendsAndParsed.forEach(([breakend, parsedBreakend]) => {
      deepStrictEqual(parseBreakend(breakend), parsedBreakend)
    })
  })

  it('throws on invalid breakend', () => {
    throws(() => parseBreakend('[13:123457['), /Invalid breakend/)
  })

  it('returns "undefined" for non-breakend', () => {
    strictEqual(parseBreakend('A'), undefined)
  })
})

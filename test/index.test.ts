import { describe, expect, it } from 'vitest'

import { parseBreakend } from '../src/index.ts'

import type { Breakend } from '../src/index.ts'

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
      expect(parseBreakend(breakend)).toEqual(parsedBreakend)
    })
  })

  it('parses telomeric breakends (VCFv4.5 section 5.4.5)', () => {
    // virtual telomeric breakends use positions 0 and N+1
    const telomeresAndParsed = [
      [
        '.[13:123457[',
        {
          MatePosition: '13:123457',
          Join: 'right',
          Replacement: '.',
          MateDirection: 'right',
        },
      ],
      [
        'C[1:1[',
        {
          MatePosition: '1:1',
          Join: 'right',
          Replacement: 'C',
          MateDirection: 'right',
        },
      ],
      [
        ']1:0]A',
        {
          MatePosition: '1:0',
          Join: 'left',
          Replacement: 'A',
          MateDirection: 'left',
        },
      ],
    ] as [string, Breakend][]
    telomeresAndParsed.forEach(([breakend, parsedBreakend]) => {
      expect(parseBreakend(breakend)).toEqual(parsedBreakend)
    })
  })

  it('parses assembly-contig mate positions (VCFv4.5 section 5.4.1)', () => {
    // mate position can be a contig in the assembly file: <ctg1>:pos
    const contigsAndParsed = [
      [
        'C[<ctg1>:1[',
        {
          MatePosition: '<ctg1>:1',
          Join: 'right',
          Replacement: 'C',
          MateDirection: 'right',
        },
      ],
      [
        ']<ctg1>:329]A',
        {
          MatePosition: '<ctg1>:329',
          Join: 'left',
          Replacement: 'A',
          MateDirection: 'left',
        },
      ],
    ] as [string, Breakend][]
    contigsAndParsed.forEach(([breakend, parsedBreakend]) => {
      expect(parseBreakend(breakend)).toEqual(parsedBreakend)
    })
  })

  it('parses single breakends (VCFv4.5 section 5.4.9)', () => {
    expect(parseBreakend('G.')).toEqual({
      Join: 'right',
      SingleBreakend: true,
      Replacement: 'G',
    })
    expect(parseBreakend('.A')).toEqual({
      Join: 'left',
      SingleBreakend: true,
      Replacement: 'A',
    })
  })

  it('throws on invalid breakend', () => {
    expect(() => parseBreakend('[13:123457[')).toThrow(/Invalid breakend/)
  })

  it('returns "undefined" for non-breakend', () => {
    expect(parseBreakend('A')).toBeUndefined()
  })
})

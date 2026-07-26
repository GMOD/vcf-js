export interface Breakend {
  Join: string
  Replacement: string
  MatePosition?: string
  MateDirection?: string
  SingleBreakend?: boolean
}

const ANGLE_BRACKET_START_REGEX = /<(.*)>(.*)/
const ANGLE_BRACKET_END_REGEX = /(.*)<(.*)>/

// Returns undefined for anything that isn't a well-formed breakend, including
// malformed bracket notation. Callers get ALT strings straight out of a VCF and
// treat the result as optional, so an unparseable allele must not take down the
// record it appears on.
export function parseBreakend(breakendString: string): Breakend | undefined {
  const firstChar = breakendString[0]
  const lastChar = breakendString.at(-1)

  if (
    firstChar === '[' ||
    firstChar === ']' ||
    lastChar === '[' ||
    lastChar === ']'
  ) {
    const tokens = breakendString.split(/[[\]]/)
    const MateDirection = breakendString.includes('[') ? 'right' : 'left'
    let Join
    let Replacement
    let MatePosition
    for (const tok of tokens) {
      if (tok) {
        if (tok.includes(':')) {
          MatePosition = tok
          Join = Replacement ? 'right' : 'left'
        } else {
          Replacement = tok
        }
      }
    }
    return MatePosition && Join && Replacement
      ? { MatePosition, Join, Replacement, MateDirection }
      : undefined
  }

  if (firstChar === '.') {
    return {
      Join: 'left',
      SingleBreakend: true,
      Replacement: breakendString.slice(1),
    }
  }

  if (lastChar === '.') {
    return {
      Join: 'right',
      SingleBreakend: true,
      Replacement: breakendString.slice(0, -1),
    }
  }

  if (firstChar === '<') {
    const [, symbol = '', Replacement = ''] =
      ANGLE_BRACKET_START_REGEX.exec(breakendString) ?? []
    return Replacement
      ? {
          Join: 'left',
          Replacement,
          MateDirection: 'right',
          MatePosition: `<${symbol}>:1`,
        }
      : undefined
  }

  if (breakendString.includes('<')) {
    const [, Replacement = '', symbol = ''] =
      ANGLE_BRACKET_END_REGEX.exec(breakendString) ?? []
    return Replacement
      ? {
          Join: 'right',
          Replacement,
          MateDirection: 'right',
          MatePosition: `<${symbol}>:1`,
        }
      : undefined
  }

  return undefined
}

export interface Breakend {
  Join: string
  Replacement: string
  MatePosition?: string
  MateDirection?: string
  SingleBreakend?: boolean
}

const ANGLE_BRACKET_START_REGEX = /<(.*)>(.*)/
const ANGLE_BRACKET_END_REGEX = /(.*)<(.*)>/

export function parseBreakend(breakendString: string): Breakend | undefined {
  const firstChar = breakendString[0]
  const lastChar = breakendString[breakendString.length - 1]

  if (
    firstChar === '[' ||
    firstChar === ']' ||
    lastChar === '[' ||
    lastChar === ']'
  ) {
    const tokens = breakendString.split(/[[\]]/)
    const MateDirection = breakendString.indexOf('[') !== -1 ? 'right' : 'left'
    let Join
    let Replacement
    let MatePosition
    for (const tok of tokens) {
      if (tok) {
        if (tok.indexOf(':') !== -1) {
          MatePosition = tok
          Join = Replacement ? 'right' : 'left'
        } else {
          Replacement = tok
        }
      }
    }
    if (!(MatePosition && Join && Replacement)) {
      throw new Error(`Invalid breakend: ${breakendString}`)
    }
    return { MatePosition, Join, Replacement, MateDirection }
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
    const res = ANGLE_BRACKET_START_REGEX.exec(breakendString)
    if (!res) {
      throw new Error(`failed to parse ${breakendString}`)
    }
    const Replacement = res[2]
    return Replacement
      ? {
          Join: 'left',
          Replacement,
          MateDirection: 'right',
          MatePosition: `<${res[1]!}>:1`,
        }
      : undefined
  }

  if (breakendString.indexOf('<') !== -1) {
    const res = ANGLE_BRACKET_END_REGEX.exec(breakendString)
    if (!res) {
      throw new Error(`failed to parse ${breakendString}`)
    }
    const Replacement = res[1]
    return Replacement
      ? {
          Join: 'right',
          Replacement,
          MateDirection: 'right',
          MatePosition: `<${res[2]!}>:1`,
        }
      : undefined
  }

  return undefined
}

export type { Variant } from './parse.ts'

export { default } from './parse.ts'

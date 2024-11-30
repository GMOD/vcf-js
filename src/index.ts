import VCFParser from './parse'

export interface Breakend {
  Join: string
  Replacement: string
  MatePosition?: string
  MateDirection?: string
  SingleBreakend?: boolean
}

export function parseBreakend(breakendString: string): Breakend | undefined {
  const tokens = breakendString.split(/[[\]]/)
  if (tokens.length > 1) {
    const MateDirection = breakendString.includes('[') ? 'right' : 'left'
    let Join
    let Replacement
    let MatePosition
    for (const tok of tokens) {
      if (tok) {
        if (tok.includes(':')) {
          // this is the remote location
          MatePosition = tok
          Join = Replacement ? 'right' : 'left'
        } else {
          // this is the local alteration
          Replacement = tok
        }
      }
    }
    if (!(MatePosition && Join && Replacement)) {
      throw new Error(`Invalid breakend: ${breakendString}`)
    }
    return { MatePosition, Join, Replacement, MateDirection }
  } else {
    if (breakendString.startsWith('.')) {
      return {
        Join: 'left',
        SingleBreakend: true,
        Replacement: breakendString.slice(1),
      }
    } else if (breakendString.endsWith('.')) {
      return {
        Join: 'right',
        SingleBreakend: true,
        Replacement: breakendString.slice(0, breakendString.length - 1),
      }
    } else if (breakendString.startsWith('<')) {
      const res = /<(.*)>(.*)/.exec(breakendString)
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
    } else if (breakendString.includes('<')) {
      const res = /(.*)<(.*)>/.exec(breakendString)
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
  }
  return undefined
}

export default VCFParser

export type { Variant } from './parse'

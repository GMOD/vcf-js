import VCF from './parse'

export interface Breakend {
  MatePosition: string
  Join: string
  Replacement: string
  MateDirection: string
}

export function parseBreakend(breakendString: string): Breakend | undefined {
  const tokens = breakendString.split(/[[\]]/)
  if (tokens.length > 1) {
    const MateDirection = breakendString.includes('[') ? 'right' : 'left'
    let Join
    let Replacement
    let MatePosition
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i]
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
  }
  return undefined
}

export default VCF

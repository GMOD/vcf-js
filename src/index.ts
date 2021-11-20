import VCF from './parse'

export function parseBreakend(breakendString: string) {
  const tokens = breakendString.split(/[[\]]/)
  if (tokens.length > 1) {
    let MateDirection = breakendString.includes('[') ? 'right' : 'left'
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
    return { MatePosition, Join, Replacement, MateDirection }
  }
  return undefined
}

export default VCF

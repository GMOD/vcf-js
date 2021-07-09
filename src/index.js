import VCF from './parse'

export function parseBreakend(breakendString) {
  const tokens = breakendString.split(/[[\]]/)
  if (tokens.length > 1) {
    const parsed = {}
    parsed.MateDirection = breakendString.includes('[') ? 'right' : 'left'
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i]
      if (tok) {
        if (tok.includes(':')) {
          // this is the remote location
          parsed.MatePosition = tok
          parsed.Join = parsed.Replacement ? 'right' : 'left'
        } else {
          // this is the local alteration
          parsed.Replacement = tok
        }
      }
    }
    return parsed
  }
  // if there is not more than one token, there are no [ or ] characters,
  // so just return it unmodified
  return breakendString
}

export default VCF

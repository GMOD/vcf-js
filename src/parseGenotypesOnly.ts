export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return genotypes
  }

  const rest = prerest.split('\t')
  const samplesLen = samples.length
  let i = 0

  if (format.length === 2) {
    for (let idx = 0; idx < samplesLen; idx++) {
      genotypes[samples[idx]!] = rest[i++]!
    }
  } else if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const val = rest[i++]!
      const colonIdx = val.indexOf(':')
      genotypes[samples[idx]!] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') {
        colonCount++
      }
    }
    for (let idx = 0; idx < samplesLen; idx++) {
      const val = rest[i++]!
      const valLen = val.length
      let colons = 0
      let start = 0
      for (let j = 0; j <= valLen; j++) {
        if (j === valLen || val[j] === ':') {
          if (colons === colonCount) {
            genotypes[samples[idx]!] = val.slice(start, j)
            break
          }
          colons++
          start = j + 1
        }
      }
    }
  }

  return genotypes
}

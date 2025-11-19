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
  let i = 0

  if (format.length === 2) {
    for (const sample of samples) {
      genotypes[sample] = rest[i++]!
    }
  } else if (gtIdx === 0) {
    for (const sample of samples) {
      const val = rest[i++]!
      const colonIdx = val.indexOf(':')
      genotypes[sample] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') colonCount++
    }
    for (const sample of samples) {
      const val = rest[i++]!
      let colons = 0
      let start = 0
      for (let j = 0; j <= val.length; j++) {
        if (j === val.length || val[j] === ':') {
          if (colons === colonCount) {
            genotypes[sample] = val.slice(start, j)
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

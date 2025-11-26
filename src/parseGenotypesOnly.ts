/**
 * Extracts genotype (GT) values from VCF sample data.
 */
export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = Object.create(null) as Record<string, string>

  const samplesLen = samples.length
  const prerestLen = prerest.length
  const TAB = 9
  const COLON = 58
  let pos = 0

  // Fast path: format is exactly "GT"
  if (format === 'GT') {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      pos++
    }
    return genotypes
  }

  // Check if GT field exists
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return genotypes
  }

  // GT is first field but not only field
  if (gtIdx === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (
        pos < prerestLen &&
        prerest.charCodeAt(pos) !== COLON &&
        prerest.charCodeAt(pos) !== TAB
      ) {
        pos++
      }
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      pos++
    }
    return genotypes
  }

  // GT is not first field
  let colonCount = 0
  for (let j = 0; j < gtIdx; j++) {
    if (format.charCodeAt(j) === COLON) {
      colonCount++
    }
  }
  for (let idx = 0; idx < samplesLen; idx++) {
    const sampleStart = pos
    let tabIdx = pos
    while (tabIdx < prerestLen && prerest.charCodeAt(tabIdx) !== TAB) {
      tabIdx++
    }

    let colons = 0
    let fieldStart = sampleStart
    for (let j = sampleStart; j <= tabIdx; j++) {
      if (j === tabIdx || prerest.charCodeAt(j) === COLON) {
        if (colons === colonCount) {
          genotypes[samples[idx]!] = prerest.slice(fieldStart, j)
          break
        }
        colons++
        fieldStart = j + 1
      }
    }
    pos = tabIdx + 1
  }

  return genotypes
}

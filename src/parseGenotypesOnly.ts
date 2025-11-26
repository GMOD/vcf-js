/**
 * Extracts genotype (GT) values from VCF sample data.
 *
 * Performance optimizations:
 * - Avoids string.split() by parsing directly from the input string
 * - Fast path for 3-character genotypes (e.g., 0/1, 0|1) common in diploid organisms
 * - Uses charCodeAt() for faster character comparisons
 * - Special handling for format === 'GT' (most common case)
 * - Eliminates intermediate string allocations when GT is not first field
 *
 * @param format - The FORMAT field from the VCF line (e.g., "GT", "GT:DP:GQ", "DP:GQ:GT")
 * @param prerest - Tab-separated sample data string
 * @param samples - Array of sample names
 * @returns Object mapping sample names to their genotype values
 */
export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  // this was benchmarked to be slightly faster in most cases with larger
  // sample sizes
  const genotypes = Object.create(null) as Record<string, string>

  const samplesLen = samples.length
  const prerestLen = prerest.length
  const TAB = 9
  const COLON = 58
  let pos = 0

  // Fast path: format is exactly "GT"
  if (format === 'GT') {
    for (let idx = 0; idx < samplesLen; idx++) {
      const c3pos = pos + 3
      if (
        c3pos < prerestLen &&
        prerest.charCodeAt(c3pos) === TAB &&
        prerest.charCodeAt(pos) !== TAB &&
        prerest.charCodeAt(pos + 1) !== TAB &&
        prerest.charCodeAt(pos + 2) !== TAB
      ) {
        genotypes[samples[idx]!] = prerest.slice(pos, c3pos)
        pos = c3pos + 1
        continue
      }

      if (
        c3pos === prerestLen &&
        prerest.charCodeAt(pos) !== TAB &&
        prerest.charCodeAt(pos + 1) !== TAB &&
        prerest.charCodeAt(pos + 2) !== TAB
      ) {
        genotypes[samples[idx]!] = prerest.slice(pos, c3pos)
        pos = prerestLen
        continue
      }

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
      if (pos + 3 < prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        const c3 = prerest.charCodeAt(pos + 3)
        if (
          (c3 === COLON || c3 === TAB) &&
          c0 !== COLON &&
          c0 !== TAB &&
          c1 !== COLON &&
          c1 !== TAB &&
          c2 !== COLON &&
          c2 !== TAB
        ) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          if (c3 === COLON) {
            pos += 4
            while (pos < prerestLen && prerest[pos] !== '\t') {
              pos++
            }
            pos++
          } else {
            pos += 4
          }
          continue
        }
      } else if (pos + 3 === prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        if (
          c0 !== COLON &&
          c0 !== TAB &&
          c1 !== COLON &&
          c1 !== TAB &&
          c2 !== COLON &&
          c2 !== TAB
        ) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos = prerestLen
          continue
        }
      }
      const start = pos
      while (
        pos < prerestLen &&
        prerest[pos] !== ':' &&
        prerest[pos] !== '\t'
      ) {
        pos++
      }
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest[pos] !== '\t') {
        pos++
      }
      pos++
    }
  } else {
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

      // Parse GT directly from prerest without creating intermediate string
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
  }

  return genotypes
}

/**
 * Extracts genotype (GT) values from VCF sample data.
 *
 * Performance optimizations:
 * - Avoids string.split() by parsing directly from the input string
 * - Fast path for 3-character genotypes (e.g., 0/1, 0|1) common in diploid organisms
 * - Uses charCodeAt() for faster character comparisons
 * - Special handling for format === 'GT' (most common case)
 * - Eliminates intermediate string allocations when GT is not first field
 * - Ultra-fast path when ploidy is consistent across all samples (detects via length check)
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
  const genotypes = {} as Record<string, string>

  const samplesLen = samples.length
  const prerestLen = prerest.length
  const TAB = 9
  const COLON = 58
  let pos = 0

  // Fast path: format is exactly "GT"
  if (format === 'GT') {
    // Unused: Ultra-fast path: check if all GTs are exactly 3 characters
    // This is common when ploidy is consistent across all samples (e.g., all diploid)
    // const expectedLen = samplesLen * 4 - 1 // (3 chars + tab) * samples - last tab
    // if (prerestLen === expectedLen && samplesLen > 10) {
    //   // Validate first few samples to avoid false positives from mixed ploidy
    //   // Check that char at position 3 is tab (first GT is 3 chars)
    //   // and char at position 7 is tab (second GT is 3 chars)
    //   if (prerest.charCodeAt(3) === TAB && (samplesLen < 2 || prerest.charCodeAt(7) === TAB)) {
    //     // All GTs are exactly 3 characters - no per-sample validation needed!
    //     for (let idx = 0; idx < samplesLen; idx++) {
    //       genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
    //       pos += 4
    //     }
    //     return genotypes
    //   }
    // }

    // Standard path with per-sample validation
    for (let idx = 0; idx < samplesLen; idx++) {
      if (pos + 3 < prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        const c3 = prerest.charCodeAt(pos + 3)
        if (c3 === TAB && c0 !== TAB && c1 !== TAB && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos += 4
          continue
        }
      } else if (pos + 3 === prerestLen) {
        const c0 = prerest.charCodeAt(pos)
        const c1 = prerest.charCodeAt(pos + 1)
        const c2 = prerest.charCodeAt(pos + 2)
        if (c0 !== TAB && c1 !== TAB && c2 !== TAB) {
          genotypes[samples[idx]!] = prerest.slice(pos, pos + 3)
          pos = prerestLen
          continue
        }
      }
      const start = pos
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
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
            while (pos < prerestLen && prerest[pos] !== '\t') pos++
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
      while (pos < prerestLen && prerest[pos] !== ':' && prerest[pos] !== '\t')
        pos++
      genotypes[samples[idx]!] = prerest.slice(start, pos)
      while (pos < prerestLen && prerest[pos] !== '\t') pos++
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
      while (tabIdx < prerestLen && prerest.charCodeAt(tabIdx) !== TAB) tabIdx++

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

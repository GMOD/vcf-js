/**
 * Callback type for processGenotypes - receives the raw string and
 * start/end indices to avoid string allocation. The sample index is the
 * 0-based position in the header sample list.
 */
export type GenotypeCallback = (
  str: string,
  start: number,
  end: number,
  sampleIdx: number,
) => unknown

/**
 * Process genotypes by calling a callback for each one, avoiding intermediate
 * object/string allocation. This is useful for operations like counting alleles
 * where you don't need to build the full genotypes object.
 *
 * @param format - The FORMAT field from the VCF line
 * @param prerest - The sample data portion of the VCF line (after FORMAT)
 * @param samplesLen - Number of samples
 * @param callback - Called for each genotype with (string, startIndex, endIndex)
 */
const TAB = 9
const COLON = 58
const G = 71
const T = 84

// Column index of the exact "GT" field among the colon-separated FORMAT
// keys, or -1 if absent. Matches the field exactly so keys that merely
// contain "GT" (e.g. GATK's PGT) are not mistaken for it.
function gtColumnIndex(format: string) {
  let col = 0
  let start = 0
  const len = format.length
  for (let j = 0; j <= len; j++) {
    if (j === len || format.charCodeAt(j) === COLON) {
      if (
        j - start === 2 &&
        format.charCodeAt(start) === G &&
        format.charCodeAt(start + 1) === T
      ) {
        return col
      }
      col++
      start = j + 1
    }
  }
  return -1
}

export function processGenotypes(
  format: string,
  prerest: string,
  samplesLen: number,
  callback: GenotypeCallback,
) {
  const prerestLen = prerest.length
  let pos = 0

  // Fast path: format is exactly "GT"
  if (format === 'GT') {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      callback(prerest, start, pos, idx)
      pos++
    }
    return
  }

  const colonCount = gtColumnIndex(format)
  if (colonCount === -1) {
    return
  }

  // GT is first field but not only field
  if (colonCount === 0) {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (
        pos < prerestLen &&
        prerest.charCodeAt(pos) !== COLON &&
        prerest.charCodeAt(pos) !== TAB
      ) {
        pos++
      }
      callback(prerest, start, pos, idx)
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      pos++
    }
    return
  }

  // GT is not first field - skip to its column (colonCount fields precede it)
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
          callback(prerest, fieldStart, j, idx)
          break
        }
        colons++
        fieldStart = j + 1
      }
    }
    pos = tabIdx + 1
  }
}

/**
 * Callback type for processGenotypes - receives the raw string and
 * start/end indices to avoid string allocation
 */
export type GenotypeCallback = (str: string, start: number, end: number) => any

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
export function processGenotypes(
  format: string,
  prerest: string,
  samplesLen: number,
  callback: GenotypeCallback,
) {
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
      callback(prerest, start, pos)
      pos++
    }
    return
  }

  // Check if GT field exists
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return
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
      callback(prerest, start, pos)
      while (pos < prerestLen && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      pos++
    }
    return
  }

  // GT is not first field - need to skip to the right column
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
          callback(prerest, fieldStart, j)
          break
        }
        colons++
        fieldStart = j + 1
      }
    }
    pos = tabIdx + 1
  }
}

import { formatColumnIndex } from './processFormatFields.ts'

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

const TAB = 9
const COLON = 58

/**
 * Process genotypes by calling a callback for each one, avoiding intermediate
 * object/string allocation. This is useful for operations like counting alleles
 * where you don't need to build the full genotypes object.
 *
 * @param format - The FORMAT field from the VCF line
 * @param prerest - A string whose `[from, to)` range is the sample data portion
 * of the VCF line (everything after FORMAT). Callers that already hold the whole
 * line should pass it with offsets rather than slicing: a V8 `SlicedString`
 * costs an extra unwrap on every `charCodeAt`, and this scan is nothing but
 * `charCodeAt` - handing the flat line through instead measured 1.3x on a
 * 3202-sample record. The offsets the callback reports are into `prerest`,
 * whatever it is, so a consumer's `str.slice(start, end)` is unaffected.
 * @param samplesLen - Number of samples
 * @param callback - Called for each genotype with (string, startIndex,
 * endIndex, sampleIdx)
 * @param from - Offset of the first sample column in `prerest`
 * @param to - Offset just past the last sample column in `prerest`
 */
export function processGenotypes(
  format: string,
  prerest: string,
  samplesLen: number,
  callback: GenotypeCallback,
  from = 0,
  to = prerest.length,
) {
  let pos = from

  if (format === 'GT') {
    for (let idx = 0; idx < samplesLen; idx++) {
      const start = pos
      while (pos < to && prerest.charCodeAt(pos) !== TAB) {
        pos++
      }
      callback(prerest, start, pos, idx)
      pos++
    }
    return
  }

  const gtCol = formatColumnIndex(format, 'GT')
  if (gtCol === -1) {
    return
  }

  // The hop from the end of GT to the end of the sample is the long one - it
  // steps over every other FORMAT field - and `indexOf` does it far faster than
  // a charCodeAt loop can: V8 searches a one-byte string with a vectorized
  // memchr, so on the 1000G shape (GT:AB:AD:DP:GQ:PGT:PID:PL, ~30 chars a
  // sample) GT-first measured 2.3x faster than walking the same bytes one at a
  // time. Same lesson tabix-js records in its ADR 0003 for Uint8Array scans,
  // and it is why the *short* scans - GT itself, and the whole of the
  // `format === 'GT'` branch above - keep their loops: with nothing to skip,
  // the call costs more than it saves (measured 0.86x).
  for (let idx = 0; idx < samplesLen; idx++) {
    let col = 0
    let fieldStart = pos
    let gtEnd = -1
    while (pos < to) {
      const c = prerest.charCodeAt(pos)
      if (c === TAB) {
        break
      }
      if (c === COLON) {
        if (col === gtCol) {
          gtEnd = pos
          // clamped back to `to`, since `indexOf` searches past it when the
          // caller passed the whole line with offsets
          const tab = prerest.indexOf('\t', pos)
          pos = tab === -1 || tab > to ? to : tab
          break
        }
        col++
        fieldStart = pos + 1
      }
      pos++
    }
    if (gtEnd === -1) {
      // GT is the sample's last field, or the sample's fields stop before GT's
      // column - report an empty range in the latter case rather than skipping
      // the callback, so sampleIdx always tracks the callback count
      if (col !== gtCol) {
        fieldStart = pos
      }
      gtEnd = pos
    }
    callback(prerest, fieldStart, gtEnd, idx)
    pos++
  }
}

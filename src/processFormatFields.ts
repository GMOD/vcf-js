/**
 * Callback type for processFormatFields. `ranges` holds the requested fields'
 * bounds within `str`, interleaved: field `k` spans
 * `str.slice(ranges[2 * k], ranges[2 * k + 1])`, and both entries are -1 when
 * that field is absent for this sample. The array is scratch, reused for every
 * sample — read it inside the callback, don't retain it.
 */
export type FormatFieldsCallback = (
  str: string,
  ranges: Int32Array,
  sampleIdx: number,
) => unknown

const TAB = 9
const COLON = 58

/**
 * Column index of each requested key among the colon-separated FORMAT keys, or
 * -1 for a key FORMAT doesn't declare. Matched exactly, so a key that merely
 * contains another (GATK's PGT against GT) is not mistaken for it.
 */
function formatColumnIndices(format: string, keys: string[]) {
  const cols = new Int32Array(keys.length).fill(-1)
  let col = 0
  let start = 0
  const len = format.length
  for (let j = 0; j <= len; j++) {
    if (j === len || format.charCodeAt(j) === COLON) {
      const fieldLen = j - start
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k]!
        if (cols[k] === -1 && key.length === fieldLen) {
          let eq = true
          for (let i = 0; i < fieldLen; i++) {
            if (format.charCodeAt(start + i) !== key.charCodeAt(i)) {
              eq = false
              break
            }
          }
          if (eq) {
            cols[k] = col
          }
        }
      }
      col++
      start = j + 1
    }
  }
  return cols
}

/**
 * Report several named FORMAT fields per sample as ranges into the line,
 * allocating nothing. The generalization of `processGenotypes` past GT: reading
 * two fields through `SAMPLES()` costs a parse of *every* field of every sample
 * plus an object and an array apiece, which on a 2504-sample GT:AD:DP:GQ:PL
 * record set measured 1985ms/2095MB against 180ms/1MB here.
 *
 * Fields are located in a single pass per sample, so the cost is the sample's
 * length regardless of how many keys are asked for.
 *
 * @param format - The FORMAT field from the VCF line
 * @param prerest - The sample data portion of the VCF line (after FORMAT)
 * @param samplesLen - Number of samples
 * @param keys - FORMAT keys to report, e.g. `['GT', 'PS']`
 * @param callback - Called once per sample with (line, ranges, sampleIdx)
 */
export function processFormatFields(
  format: string,
  prerest: string,
  samplesLen: number,
  keys: string[],
  callback: FormatFieldsCallback,
) {
  const numKeys = keys.length
  if (numKeys === 0) {
    return
  }
  const cols = formatColumnIndices(format, keys)
  let maxCol = -1
  for (let k = 0; k < numKeys; k++) {
    if (cols[k]! > maxCol) {
      maxCol = cols[k]!
    }
  }
  // FORMAT declares none of the requested keys, so there is nothing any sample
  // could report — matches processGenotypes' behaviour for a GT-less record.
  if (maxCol === -1) {
    return
  }

  const ranges = new Int32Array(numKeys * 2)
  const prerestLen = prerest.length
  let pos = 0

  for (let idx = 0; idx < samplesLen; idx++) {
    ranges.fill(-1)
    let col = 0
    let fieldStart = pos
    // Walk the sample's colon-separated fields once, closing out whichever
    // requested keys land on each column.
    let closed = false
    while (pos < prerestLen) {
      const c = prerest.charCodeAt(pos)
      if (c === TAB) {
        break
      }
      if (c === COLON) {
        for (let k = 0; k < numKeys; k++) {
          if (cols[k] === col) {
            ranges[k * 2] = fieldStart
            ranges[k * 2 + 1] = pos
          }
        }
        col++
        fieldStart = pos + 1
        // Every requested key is answered, so the rest of this sample is dead
        // weight - hop it in one `indexOf` instead of a byte at a time. On a
        // GT:PS:AD:DP:GQ:PL record asked for GT and PS that measured 1.7x, and
        // it is the same vectorized-memchr win processGenotypes takes. When the
        // last requested key IS the sample's last column there is nothing to
        // hop and the loop below runs as before.
        if (col > maxCol) {
          closed = true
          const tab = prerest.indexOf('\t', pos)
          pos = tab === -1 ? prerestLen : tab
          break
        }
      }
      pos++
    }
    // The sample's last field carries no trailing colon, so it is closed out
    // here rather than in the loop - unless the hop above already answered
    // every key, in which case `col` is past them all and this would only
    // rediscover that. A sample whose fields stop before a requested column
    // leaves that key at -1 rather than skipping the callback, so sampleIdx
    // always tracks the callback count.
    if (!closed) {
      for (let k = 0; k < numKeys; k++) {
        if (cols[k] === col) {
          ranges[k * 2] = fieldStart
          ranges[k * 2 + 1] = pos
        }
      }
    }
    callback(prerest, ranges, idx)
    pos++
  }
}

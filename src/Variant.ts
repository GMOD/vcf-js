import { parseGenotypesOnly } from './parseGenotypesOnly.ts'
import { parseInfo } from './parseInfo.ts'
import { processFormatFields } from './processFormatFields.ts'
import { processGenotypes } from './processGenotypes.ts'

import type { InfoValue, MetaMap } from './parseInfo.ts'
import type { FormatFieldsCallback } from './processFormatFields.ts'
import type { GenotypeCallback } from './processGenotypes.ts'

const COLON = 58

export type SampleValue = (string | number | undefined)[] | undefined
export type SampleData = Record<string, SampleValue>
export type Samples = Record<string, SampleData>

export class Variant {
  private formatMeta: MetaMap
  /**
   * The whole line, kept rather than the `rest` slice it used to hold. `rest` is
   * `line.slice(restStart, restEnd)`, and in V8 that is a `SlicedString` - which
   * costs an extra unwrap on every `charCodeAt`, the one operation the genotype
   * scans consist of. Scanning the flat line with offsets instead measured 1.3x
   * on a 3202-sample record. `rest` stays as a getter for callers that want the
   * substring, and materializes only when asked for.
   */
  readonly line: string
  /** Offset of the first sample column in `line`. */
  readonly restStart: number
  /** Offset just past the last sample column in `line` (trailing CR/LF excluded). */
  readonly restEnd: number
  /** Header sample names, in column order; the index `processGenotypes` reports. */
  readonly sampleNames: string[]

  CHROM: string | undefined
  POS: number
  ID: string[] | undefined
  REF: string | undefined
  ALT: string[] | undefined
  QUAL: number | undefined
  FILTER: string | string[] | undefined
  INFO: Record<string, InfoValue>
  FORMAT: string | undefined

  constructor(
    line: string,
    infoMeta: MetaMap,
    formatMeta: MetaMap,
    sampleNames: string[],
    strict: boolean,
  ) {
    // Ignore any trailing line terminator so it can't end up inside the last
    // field. Callers that split a CRLF file on '\n' leave a '\r' behind, which
    // would otherwise make e.g. GT read as '0/0\r'.
    let lineLen = line.length
    while (lineLen > 0) {
      const c = line.charCodeAt(lineLen - 1)
      if (c !== 10 && c !== 13) {
        break
      }
      lineLen -= 1
    }

    let currChar = 0
    let tabCount = 0
    while (currChar < lineLen && tabCount < 9) {
      if (line.charCodeAt(currChar) === 9) {
        tabCount += 1
      }
      currChar += 1
    }
    const splitPos = tabCount === 9 ? currChar - 1 : currChar
    const fields = line.slice(0, splitPos).split('\t')
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER] = fields

    if (strict && !fields[7]) {
      throw new Error(
        "no INFO field specified, must contain at least a '.' (turn off strict mode to allow)",
      )
    }

    const filter = FILTER === '.' ? undefined : FILTER?.split(';')

    this.CHROM = CHROM
    this.POS = POS !== undefined ? +POS : 0
    this.ID = ID === '.' ? undefined : ID?.split(';')
    this.REF = REF
    this.ALT = ALT === '.' ? undefined : ALT?.split(',')
    this.QUAL = QUAL === undefined || QUAL === '.' ? undefined : +QUAL
    this.FILTER = filter?.length === 1 && filter[0] === 'PASS' ? 'PASS' : filter
    this.INFO =
      fields[7] === undefined || fields[7] === '.'
        ? {}
        : parseInfo(fields[7], infoMeta)
    this.FORMAT = fields[8]

    this.formatMeta = formatMeta
    this.line = line
    // `splitPos` is the last tab counted, so the samples begin one past it. A
    // line with fewer than 9 tabs has no sample columns at all, and then
    // restStart lands at or past restEnd and every scan reports nothing.
    this.restStart = Math.min(splitPos + 1, lineLen)
    this.restEnd = lineLen
    this.sampleNames = sampleNames
  }

  /** The sample columns of the line, i.e. everything after FORMAT. */
  get rest() {
    return this.line.slice(this.restStart, this.restEnd)
  }

  SAMPLES(): Samples {
    const genotypes: Samples = {}
    const format = this.FORMAT
    if (format) {
      const rest = this.rest.split('\t')
      const formatKeys = format.split(':')
      const isNumberType = formatKeys.map(k => {
        const t = this.formatMeta[k]?.Type
        return t === 'Integer' || t === 'Float'
      })
      const numKeys = formatKeys.length
      const samplesLen = this.sampleNames.length
      for (let i = 0; i < samplesLen; i++) {
        const sample = this.sampleNames[i] ?? ''
        const sampleData: SampleData = {}
        const sampleStr = rest[i] ?? ''
        const sampleStrLen = sampleStr.length
        let colStart = 0
        let colIdx = 0

        for (let j = 0; j <= sampleStrLen; j++) {
          if (j === sampleStrLen || sampleStr.charCodeAt(j) === COLON) {
            const key = formatKeys[colIdx] ?? ''
            const val = sampleStr.slice(colStart, j)
            const isNum = isNumberType[colIdx]
            if (val === '' || val === '.') {
              sampleData[key] = undefined
            } else if (!val.includes(',')) {
              // single-valued fields are the common case, and skipping split()
              // here is the bulk of this method's cost
              sampleData[key] = [isNum ? +val : val]
            } else {
              const items = val.split(',')
              const itemsLen = items.length
              const result: (string | number | undefined)[] = []
              for (let k = 0; k < itemsLen; k++) {
                const ent = items[k] ?? ''
                result.push(ent === '.' ? undefined : isNum ? +ent : ent)
              }
              sampleData[key] = result
            }
            colStart = j + 1
            colIdx += 1
            if (colIdx >= numKeys) {
              break
            }
          }
        }
        genotypes[sample] = sampleData
      }
    }
    return genotypes
  }

  GENOTYPES() {
    return parseGenotypesOnly(
      this.FORMAT ?? '',
      this.line,
      this.sampleNames,
      this.restStart,
      this.restEnd,
    )
  }

  processGenotypes(callback: GenotypeCallback) {
    processGenotypes(
      this.FORMAT ?? '',
      this.line,
      this.sampleNames.length,
      callback,
      this.restStart,
      this.restEnd,
    )
  }

  processFormatFields(keys: string[], callback: FormatFieldsCallback) {
    processFormatFields(
      this.FORMAT ?? '',
      this.line,
      this.sampleNames.length,
      keys,
      callback,
      this.restStart,
      this.restEnd,
    )
  }

  toJSON() {
    return {
      CHROM: this.CHROM,
      POS: this.POS,
      ID: this.ID,
      REF: this.REF,
      ALT: this.ALT,
      QUAL: this.QUAL,
      FILTER: this.FILTER,
      INFO: this.INFO,
      FORMAT: this.FORMAT,
    }
  }
}

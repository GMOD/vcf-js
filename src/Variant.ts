import { parseGenotypesOnly } from './parseGenotypesOnly.ts'
import { parseInfo } from './parseInfo.ts'
import { processGenotypes } from './processGenotypes.ts'

import type { GenotypeCallback } from './processGenotypes.ts'

export class Variant {
  CHROM: string | undefined
  POS: number
  ID: string[] | undefined
  REF: string | undefined
  ALT: string[] | undefined
  QUAL: number | undefined
  FILTER: string | string[] | undefined
  INFO: Record<string, unknown>
  FORMAT: string | undefined

  private formatMeta: Record<string, { Type?: string }>
  private rest: string
  private sampleNames: string[]

  constructor(
    line: string,
    infoMeta: Record<string, { Type?: string }>,
    formatMeta: Record<string, { Type?: string }>,
    sampleNames: string[],
    strict: boolean,
  ) {
    const lineLen = line.length
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
    const rest = line.slice(splitPos + 1)
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER] = fields
    const filter = FILTER === '.' ? undefined : FILTER?.split(';')

    if (strict && !fields[7]) {
      throw new Error(
        "no INFO field specified, must contain at least a '.' (turn off strict mode to allow)",
      )
    }

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
    this.rest = rest
    this.sampleNames = sampleNames
  }

  SAMPLES() {
    const genotypes = {} as Record<
      string,
      Record<string, (string | number | undefined)[] | undefined>
    >
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
        const sampleData: Record<
          string,
          (string | number | undefined)[] | undefined
        > = {}
        const sampleStr = rest[i] ?? ''
        const sampleStrLen = sampleStr.length
        let colStart = 0
        let colIdx = 0

        for (let j = 0; j <= sampleStrLen; j++) {
          if (j === sampleStrLen || sampleStr[j] === ':') {
            const val = sampleStr.slice(colStart, j)
            if (val === '' || val === '.') {
              sampleData[formatKeys[colIdx] ?? ''] = undefined
            } else {
              const items = val.split(',')
              const itemsLen = items.length
              const isNum = isNumberType[colIdx]
              const result: (string | number | undefined)[] = []
              for (let k = 0; k < itemsLen; k++) {
                const ent = items[k] ?? ''
                result.push(ent === '.' ? undefined : isNum ? +ent : ent)
              }
              sampleData[formatKeys[colIdx] ?? ''] = result
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
    return parseGenotypesOnly(this.FORMAT ?? '', this.rest, this.sampleNames)
  }

  processGenotypes(callback: GenotypeCallback) {
    processGenotypes(
      this.FORMAT ?? '',
      this.rest,
      this.sampleNames.length,
      callback,
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

import { parseGenotypesOnly } from './parseGenotypesOnly.ts'
import { processGenotypes } from './processGenotypes.ts'

import type { GenotypeCallback } from './processGenotypes.ts'

function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (_e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}

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
    let currChar = 0
    let tabCount = 0
    while (currChar < line.length && tabCount < 9) {
      if (line[currChar] === '\t') {
        tabCount += 1
      }
      currChar += 1
    }
    const splitPos = tabCount === 9 ? currChar - 1 : currChar
    const fields = line.slice(0, splitPos).split('\t')
    const rest = line.slice(splitPos + 1)
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER] = fields
    const filter = FILTER === '.' ? undefined : FILTER!.split(';')

    if (strict && !fields[7]) {
      throw new Error(
        "no INFO field specified, must contain at least a '.' (turn off strict mode to allow)",
      )
    }

    this.CHROM = CHROM
    this.POS = +POS!
    this.ID = ID === '.' ? undefined : ID!.split(';')
    this.REF = REF
    this.ALT = ALT === '.' ? undefined : ALT!.split(',')
    this.QUAL = QUAL === '.' ? undefined : +QUAL!
    this.FILTER = filter?.length === 1 && filter[0] === 'PASS' ? 'PASS' : filter
    this.INFO =
      fields[7] === undefined || fields[7] === '.'
        ? {}
        : this.parseInfo(fields[7], infoMeta)
    this.FORMAT = fields[8]

    this.formatMeta = formatMeta
    this.rest = rest
    this.sampleNames = sampleNames
  }

  private parseInfo(
    infoStr: string,
    infoMeta: Record<string, { Type?: string }>,
  ) {
    const result: Record<string, unknown> = {}
    const hasDecode = infoStr.includes('%')
    const infoPairs = infoStr.split(';')
    const pairsLen = infoPairs.length

    for (let i = 0; i < pairsLen; i++) {
      const pair = infoPairs[i]!
      const eqIdx = pair.indexOf('=')
      const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx)
      const val = eqIdx === -1 ? undefined : pair.slice(eqIdx + 1)
      const itemType = infoMeta[key]?.Type

      if (itemType === 'Flag') {
        result[key] = true
      } else if (!val) {
        result[key] = true
      } else {
        const isNumber = itemType === 'Integer' || itemType === 'Float'
        const rawItems = val.split(',')
        const itemsLen = rawItems.length

        if (hasDecode) {
          const items: (string | number | undefined)[] = []
          for (let j = 0; j < itemsLen; j++) {
            const v = rawItems[j]!
            if (v === '.') {
              items.push(undefined)
            } else {
              const decoded = decodeURIComponentNoThrow(v)
              items.push(isNumber ? Number(decoded) : decoded)
            }
          }
          result[key] = items
        } else {
          const items: (string | number | undefined)[] = []
          for (let j = 0; j < itemsLen; j++) {
            const v = rawItems[j]!
            if (v === '.') {
              items.push(undefined)
            } else {
              items.push(isNumber ? Number(v) : v)
            }
          }
          result[key] = items
        }
      }
    }
    return result
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
      const isNumberType: boolean[] = []
      for (let i = 0; i < formatKeys.length; i++) {
        const r = this.formatMeta[formatKeys[i]!]?.Type
        isNumberType.push(r === 'Integer' || r === 'Float')
      }
      const numKeys = formatKeys.length
      const samplesLen = this.sampleNames.length
      for (let i = 0; i < samplesLen; i++) {
        const sample = this.sampleNames[i]!
        const sampleData: Record<
          string,
          (string | number | undefined)[] | undefined
        > = {}
        const sampleStr = rest[i]!
        const sampleStrLen = sampleStr.length
        let colStart = 0
        let colIdx = 0

        for (let j = 0; j <= sampleStrLen; j++) {
          if (j === sampleStrLen || sampleStr[j] === ':') {
            const val = sampleStr.slice(colStart, j)
            if (val === '' || val === '.') {
              sampleData[formatKeys[colIdx]!] = undefined
            } else {
              const items = val.split(',')
              const result: (string | number | undefined)[] = []
              if (isNumberType[colIdx]) {
                for (let k = 0; k < items.length; k++) {
                  const ent = items[k]!
                  result.push(ent === '.' ? undefined : +ent)
                }
              } else {
                for (let k = 0; k < items.length; k++) {
                  const ent = items[k]!
                  result.push(ent === '.' ? undefined : ent)
                }
              }
              sampleData[formatKeys[colIdx]!] = result
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

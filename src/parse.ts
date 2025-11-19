import { parseGenotypesOnly } from './parseGenotypesOnly.ts'
import { parseMetaString } from './parseMetaString.ts'
import vcfReserved from './vcfReserved.ts'

function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (_e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}

/**
 * Class representing a VCF parser, instantiated with the VCF header.
 *
 * @param {object} args
 *
 * @param {string} args.header - The VCF header. Supports both LF and CRLF
 * newlines.
 *
 * @param {boolean} args.strict - Whether to parse in strict mode or not
 * (default true)
 */
export default class VCFParser {
  private metadata: Record<string, unknown>
  public strict: boolean
  public samples: string[]

  constructor({
    header = '',
    strict = true,
  }: {
    header: string
    strict?: boolean
  }) {
    if (!header.length) {
      throw new Error('empty header received')
    }
    const headerLines = header.split(/[\r\n]+/).filter(Boolean)
    if (!headerLines.length) {
      throw new Error('no non-empty header lines specified')
    }

    this.strict = strict
    this.metadata = {
      INFO: { ...vcfReserved.InfoFields },
      FORMAT: { ...vcfReserved.GenotypeFields },
      ALT: { ...vcfReserved.AltTypes },
      FILTER: { ...vcfReserved.FilterTypes },
    }

    let lastLine: string | undefined
    headerLines.forEach(line => {
      if (!line.startsWith('#')) {
        throw new Error(`Bad line in header:\n${line}`)
      } else if (line.startsWith('##')) {
        this.parseMetadata(line)
      } else {
        lastLine = line
      }
    })

    if (!lastLine) {
      throw new Error('No format line found in header')
    }
    const fields = lastLine.trim().split('\t')
    const thisHeader = fields.slice(0, 8)
    const correctHeader = [
      '#CHROM',
      'POS',
      'ID',
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      'INFO',
    ]
    if (fields.length < 8) {
      throw new Error(`VCF header missing columns:\n${lastLine}`)
    } else if (
      thisHeader.length !== correctHeader.length ||
      !thisHeader.every((value, index) => value === correctHeader[index])
    ) {
      throw new Error(`VCF column headers not correct:\n${lastLine}`)
    }
    this.samples = fields.slice(9)
  }

  private parseSamples(format: string, prerest: string) {
    const genotypes = {} as Record<
      string,
      Record<string, (string | number | undefined)[] | undefined>
    >
    if (format) {
      const rest = prerest.split('\t')
      const formatKeys = format.split(':')
      const isNumberType = formatKeys.map(key => {
        const r = this.getMetadata('FORMAT', key, 'Type')
        return r === 'Integer' || r === 'Float'
      })
      const numKeys = formatKeys.length
      for (let i = 0; i < this.samples.length; i++) {
        const sample = this.samples[i]!
        const sampleData: Record<
          string,
          (string | number | undefined)[] | undefined
        > = {}
        const sampleStr = rest[i]!
        let colStart = 0
        let colIdx = 0

        for (let j = 0; j <= sampleStr.length; j++) {
          if (j === sampleStr.length || sampleStr[j] === ':') {
            const val = sampleStr.slice(colStart, j)
            if (val === '' || val === '.') {
              sampleData[formatKeys[colIdx]!] = undefined
            } else {
              const items = val.split(',')
              sampleData[formatKeys[colIdx]!] = isNumberType[colIdx]
                ? items.map(ent => (ent === '.' ? undefined : +ent))
                : items.map(ent => (ent === '.' ? undefined : ent))
            }
            colStart = j + 1
            colIdx += 1
            if (colIdx >= numKeys) break
          }
        }
        genotypes[sample] = sampleData
      }
    }
    return genotypes
  }

  /**
   * Parse a VCF metadata line (i.e. a line that starts with "##") and add its
   * properties to the object.
   *
   * @param {string} line - A line from the VCF. Supports both LF and CRLF
   * newlines.
   */
  private parseMetadata(line: string) {
    const match = /^##(.+?)=(.*)/.exec(line.trim())
    if (!match) {
      throw new Error(`Line is not a valid metadata line: ${line}`)
    }
    const [metaKey, metaVal] = match.slice(1, 3)

    const r = metaKey!
    if (metaVal?.startsWith('<')) {
      if (!(r in this.metadata)) {
        this.metadata[r] = {}
      }
      const [id, keyVals] = this.parseStructuredMetaVal(metaVal)
      if (id) {
        // if there is an ID field in the <> metadata
        // e.g. ##INFO=<ID=AF_ESP,...>
        ;(this.metadata[r] as Record<string, unknown>)[id] = keyVals
      } else {
        // if there is not an ID field in the <> metadata
        // e.g. ##ID=<Description="ClinVar Variation ID">
        this.metadata[r] = keyVals
      }
    } else {
      this.metadata[r] = metaVal
    }
  }

  /**
   * Parse a VCF header structured meta string (i.e. a meta value that starts
   * with "<ID=...")
   *
   * @param {string} metaVal - The VCF metadata value
   *
   * @returns {Array} - Array with two entries, 1) a string of the metadata ID
   * and 2) an object with the other key-value pairs in the metadata
   */
  private parseStructuredMetaVal(metaVal: string) {
    const keyVals = parseMetaString(metaVal)
    const id = keyVals.ID!
    delete keyVals.ID
    if ('Number' in keyVals) {
      if (!Number.isNaN(Number(keyVals.Number))) {
        keyVals.Number = Number(keyVals.Number)
      }
    }
    return [id, keyVals] as const
  }

  /**
   * Get metadata filtered by the elements in args. For example, can pass
   * ('INFO', 'DP') to only get info on an metadata tag that was like
   * "##INFO=<ID=DP,...>"
   *
   * @param  {...string} args - List of metadata filter strings.
   *
   * @returns {any} An object, string, or number, depending on the filtering
   */
  getMetadata(...args: string[]) {
    let filteredMetadata: any = this.metadata
    for (const arg of args) {
      filteredMetadata = filteredMetadata[arg]
      if (!filteredMetadata) {
        return filteredMetadata
      }
    }
    return filteredMetadata
  }

  /**
   * Parse a VCF line into an object like
   *
   * ```typescript
   * {
   *   CHROM: 'contigA',
   *   POS: 3000,
   *   ID: ['rs17883296'],
   *   REF: 'G',
   *   ALT: ['T', 'A'],
   *   QUAL: 100,
   *   FILTER: 'PASS',
   *   INFO: {
   *     NS: [3],
   *     DP: [14],
   *     AF: [0.5],
   *     DB: true,
   *     XYZ: ['5'],
   *   },
   *   SAMPLES: () => ({
   *     HG00096: {
   *       GT: ['0|0'],
   *       AP: ['0.000', '0.000'],
   *     }
   *   }),
   *   GENOTYPES: () => ({
   *     HG00096: '0|0'
   *   })
   * }
   * ```
   *
   * SAMPLES and GENOTYPES methods are functions instead of static data fields
   * because it avoids parsing the potentially long list of samples from e.g.
   * 1000 genotypes data unless requested.
   *
   * The SAMPLES function gives all info about the samples
   *
   * The GENOTYPES function only extracts the raw GT string if it exists, for
   * potentially optimized parsing by programs that need it
   *
   * @param {string} line - A string of a line from a VCF
   */
  parseLine(line: string) {
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
    const chrom = CHROM
    const pos = +POS!
    const id = ID === '.' ? undefined : ID!.split(';')
    const ref = REF
    const alt = ALT === '.' ? undefined : ALT!.split(',')
    const qual = QUAL === '.' ? undefined : +QUAL!
    const filter = FILTER === '.' ? undefined : FILTER!.split(';')
    const format = fields[8]

    if (this.strict && !fields[7]) {
      throw new Error(
        "no INFO field specified, must contain at least a '.' (turn off strict mode to allow)",
      )
    }
    const info =
      fields[7] === undefined || fields[7] === '.'
        ? {}
        : (() => {
            const result: Record<string, any> = {}
            const hasDecode = fields[7]!.includes('%')
            const infoPairs = fields[7]!.split(';')
            for (const pair of infoPairs) {
              const eqIdx = pair.indexOf('=')
              const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx)
              const val = eqIdx === -1 ? undefined : pair.slice(eqIdx + 1)
              const itemType = this.getMetadata('INFO', key, 'Type')

              if (itemType === 'Flag') {
                result[key] = true
              } else if (!val) {
                result[key] = true
              } else {
                const rawItems = val.split(',')
                const items = hasDecode
                  ? rawItems.map(v =>
                      v === '.' ? undefined : decodeURIComponentNoThrow(v),
                    )
                  : rawItems.map(v => (v === '.' ? undefined : v))

                if (itemType === 'Integer' || itemType === 'Float') {
                  result[key] = items.map(v =>
                    v === undefined ? undefined : Number(v),
                  )
                } else {
                  result[key] = items
                }
              }
            }
            return result
          })()

    return {
      CHROM: chrom,
      POS: pos,
      ALT: alt,
      INFO: info,
      REF: ref,
      FILTER:
        filter && filter.length === 1 && filter[0] === 'PASS' ? 'PASS' : filter,
      ID: id,
      QUAL: qual,
      FORMAT: format,
      SAMPLES: () => this.parseSamples(fields[8] ?? '', rest),
      GENOTYPES: () => parseGenotypesOnly(fields[8] ?? '', rest, this.samples),
    }
  }
}

export type Variant = ReturnType<VCFParser['parseLine']>

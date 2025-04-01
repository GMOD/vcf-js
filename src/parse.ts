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
    this.metadata = JSON.parse(
      JSON.stringify({
        INFO: vcfReserved.InfoFields,
        FORMAT: vcfReserved.GenotypeFields,
        ALT: vcfReserved.AltTypes,
        FILTER: vcfReserved.FilterTypes,
      }),
    )

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
      for (let i = 0; i < this.samples.length; i++) {
        const sample = this.samples[i]!
        genotypes[sample] = {}
        const columns = rest[i]!.split(':')
        for (let j = 0; j < columns.length; j++) {
          const val = columns[j]!
          genotypes[sample][formatKeys[j]!] =
            val === '' || val === '.'
              ? undefined
              : val
                  .split(',')
                  .map(ent =>
                    ent === '.' ? undefined : isNumberType[j] ? +ent : ent,
                  )
        }
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
    for (let currField = 0; currChar < line.length; currChar += 1) {
      if (line[currChar] === '\t') {
        currField += 1
      }
      if (currField === 9) {
        // reached genotypes, rest of fields are evaluated lazily
        break
      }
    }
    const fields = line.slice(0, currChar).split('\t')
    const rest = line.slice(currChar + 1)
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
    const hasDecode = fields[7]?.includes('%')
    const info =
      fields[7] === undefined || fields[7] === '.'
        ? {}
        : Object.fromEntries(
            fields[7].split(';').map(r => {
              const [key, val] = r.split('=')

              const items = val
                ?.split(',')
                .map(val => (val === '.' ? undefined : val))
                .map(f => (f && hasDecode ? decodeURIComponentNoThrow(f) : f))
              const itemType = this.getMetadata('INFO', key!, 'Type')
              if (itemType === 'Integer' || itemType === 'Float') {
                return [
                  key,
                  items?.map(val =>
                    val === undefined ? undefined : Number(val),
                  ),
                ]
              } else if (itemType === 'Flag') {
                return [key, true]
              } else {
                // ?? true interpret as flag if undefined
                return [key, items ?? true]
              }
            }),
          )

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

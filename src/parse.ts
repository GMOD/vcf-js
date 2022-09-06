import vcfReserved from './vcfReserved'

class Variant {
  #fields8: any
  #rest: any
  #parser: any
  constructor(stuff: any, fields8: any, rest: any, parser: any) {
    Object.assign(this, stuff)
    this.#fields8 = fields8
    this.#rest = rest
    this.#parser = parser
  }

  get SAMPLES() {
    //@ts-ignore
    return this.#parser._parseGenotypes(this.#fields8, this.#rest)
  }
}

function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}

/**
 * Class representing a VCF parser, instantiated with the VCF header.
 * @param {object} args
 * @param {string} args.header - The VCF header. Supports both LF and CRLF
 * newlines.
 * @param {boolean} args.strict - Whether to parse in strict mode or not (default true)
 */
export default class VCF {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private metadata: Record<string, any>
  public strict: boolean
  public samples: string[]

  constructor({
    header = '',
    strict = true,
  }: {
    header: string
    strict?: boolean
  }) {
    if (!header || !header.length) {
      throw new Error('empty header received')
    }
    const headerLines = header.split(/[\r\n]+/).filter(line => line)
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
        this._parseMetadata(line)
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

  _parseGenotypes(format: string | undefined, prerest: string) {
    const rest = prerest.split('\t')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genotypes = {} as any
    const formatKeys = format?.split(':')
    if (formatKeys) {
      this.samples.forEach((sample, index) => {
        genotypes[sample] = {}
        formatKeys.forEach(key => {
          genotypes[sample][key] = null
        })
        rest[index]
          .split(':')
          .filter(f => f)
          .forEach((val, index) => {
            let thisValue: unknown
            if (val === '' || val === '.' || val === undefined) {
              thisValue = null
            } else {
              const entries = val
                .split(',')
                .map(ent => (ent === '.' ? null : ent))

              const valueType = this.getMetadata(
                'FORMAT',
                formatKeys[index],
                'Type',
              )
              if (valueType === 'Integer' || valueType === 'Float') {
                thisValue = entries.map(val => (val ? +val : val))
              } else {
                thisValue = entries
              }
            }

            genotypes[sample][formatKeys[index]] = thisValue
          }, {})
      })
    }
    return genotypes
  }

  /**
   * Parse a VCF metadata line (i.e. a line that starts with "##") and add its
   * properties to the object.
   * @param {string} line - A line from the VCF. Supports both LF and CRLF
   * newlines.
   */
  _parseMetadata(line: string) {
    const match = line.trim().match(/^##(.+?)=(.*)/)
    if (!match) {
      throw new Error(`Line is not a valid metadata line: ${line}`)
    }
    const [metaKey, metaVal] = match.slice(1, 3)

    if (metaVal.startsWith('<')) {
      if (!(metaKey in this.metadata)) {
        this.metadata[metaKey] = {}
      }
      const [id, keyVals] = this._parseStructuredMetaVal(metaVal)
      this.metadata[metaKey][id] = keyVals
    } else {
      this.metadata[metaKey] = metaVal
    }
  }

  /**
   * Parse a VCF header structured meta string (i.e. a meta value that starts
   * with "<ID=...")
   * @param metaVal - The VCF metadata value
   *
   * @returns - Array with two entries, 1) a string of the metadata ID
   * and 2) an object with the other key-value pairs in the metadata
   */
  _parseStructuredMetaVal(metaVal: string) {
    const keyVals = this._parseKeyValue(metaVal.replace(/^<|>$/g, ''), ',')
    const id = keyVals.ID
    delete keyVals.ID
    if ('Number' in keyVals) {
      if (!Number.isNaN(Number(keyVals.Number))) {
        keyVals.Number = Number(keyVals.Number)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [id, keyVals] as [string, any]
  }

  /**
   * Get metadata filtered by the elements in args. For example, can pass
   * ('INFO', 'DP') to only get info on an metadata tag that was like
   * "##INFO=<ID=DP,...>"
   * @param  args - List of metadata filter strings.
   *
   * @returns An object, string, or number, depending on the filtering
   */
  getMetadata(...args: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filteredMetadata = this.metadata as any
    for (let i = 0; i < args.length; i += 1) {
      filteredMetadata = filteredMetadata[args[i]]
      if (!filteredMetadata) {
        return filteredMetadata
      }
    }
    return filteredMetadata
  }

  /**
   * Sometimes VCFs have key-value strings that allow the separator within
   * the value if it's in quotes, like:
   * 'ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129"'
   *
   * Parse this at a low level since we can't just split at "," (or whatever
   * separator). Above line would be parsed to:
   * {ID: 'DB', Number: '0', Type: 'Flag', Description: 'dbSNP membership, build 129'}
   * @param str - Key-value pairs in a string
   * @param [pairSeparator] - A string that separates sets of key-value
   * pairs
   *
   * @returns An object containing the key-value pairs
   */
  _parseKeyValue(str: string, pairSeparator = ';') {
    const data = {} as Record<string, unknown>
    let currKey = ''
    let currValue = ''

    // states:
    // 1: read key to = or pair sep
    // 2: read value to sep or quote
    // 3: read value to quote
    let state = 1
    for (let i = 0; i < str.length; i += 1) {
      if (state === 1) {
        // read key to = or pair sep
        if (str[i] === '=') {
          state = 2
        } else if (str[i] !== pairSeparator) {
          currKey += str[i]
        } else if (currValue === '') {
          data[currKey] = null
          currKey = ''
        }
      } else if (state === 2) {
        // read value to pair sep or quote
        if (str[i] === pairSeparator) {
          data[currKey] = currValue
          currKey = ''
          currValue = ''
          state = 1
        } else if (str[i] === '"') {
          state = 3
        } else {
          currValue += str[i]
        }
      } else if (state === 3) {
        // read value to quote
        if (str[i] !== '"') {
          currValue += str[i]
        } else {
          state = 2
        }
      }
    }
    if (state === 2 || state === 3) {
      data[currKey] = currValue
    } else if (state === 1) {
      data[currKey] = null
    }
    return data
  }

  /**
   * Parse a VCF line into an object like { CHROM POS ID REF ALT QUAL FILTER
   * INFO } with SAMPLES optionally included if present in the VCF
   * @param {string} l - A string of a line from a VCF. Supports both LF and
   * CRLF newlines.
   */
  parseLine(l: string) {
    const line = l.trim()
    if (!line.length) {
      return undefined
    }

    const parser = this

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
    const pos = +POS
    const id = ID === '.' ? null : ID.split(';')
    const ref = REF
    const alt = ALT === '.' ? null : ALT.split(',')
    const qual = QUAL === '.' ? null : +QUAL
    const filter = FILTER === '.' ? null : FILTER.split(';')

    if (this.strict && fields[7] === undefined) {
      throw new Error(
        "no INFO field specified, must contain at least a '.' (turn off strict mode to allow)",
      )
    }
    const info =
      fields[7] === undefined || fields[7] === '.'
        ? {}
        : this._parseKeyValue(fields[7])

    Object.keys(info).forEach(key => {
      let items
      if (info[key]) {
        items = (info[key] as string)
          .split(',')
          .map(val => (val === '.' ? null : val))
          .map(f => (f ? decodeURIComponentNoThrow(f) : f))
      } else {
        // it will be falsy so just assign whatever is there
        items = info[key]
      }
      const itemType = this.getMetadata('INFO', key, 'Type')
      if (itemType) {
        if (itemType === 'Integer' || itemType === 'Float') {
          items = (items as string[]).map((val: string) =>
            val === null ? null : Number(val),
          )
        } else if (itemType === 'Flag') {
          if (info[key]) {
            console.warn(
              `Info field ${key} is a Flag and should not have a value (got value ${info[key]})`,
            )
          } else {
            items = true
          }
        }
      }
      info[key] = items
    })

    return new Variant(
      {
        CHROM: chrom,
        POS: pos,
        ALT: alt,
        INFO: info,
        REF: ref,
        FILTER: filter?.length === 1 && filter[0] === 'PASS' ? 'PASS' : filter,
        ID: id,
        QUAL: qual,
      },
      fields[8],
      rest,
      parser,
    )
  }
}

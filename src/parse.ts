import { Variant } from './Variant.ts'
import { parseMetaString } from './parseMetaString.ts'
import vcfReserved from './vcfReserved.ts'

export { Variant } from './Variant.ts'

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

  constructor({ header, strict = true }: { header: string; strict?: boolean }) {
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
    for (let i = 0; i < headerLines.length; i++) {
      const line = headerLines[i]!
      if (!line.startsWith('#')) {
        throw new Error(`Bad line in header:\n${line}`)
      } else if (line.startsWith('##')) {
        this.parseMetadata(line)
      } else {
        lastLine = line
      }
    }

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
    const argsLen = args.length
    for (let i = 0; i < argsLen; i++) {
      filteredMetadata = filteredMetadata[args[i]!]
      if (!filteredMetadata) {
        return filteredMetadata
      }
    }
    return filteredMetadata
  }

  /**
   * Parse a VCF line into a Variant object.
   *
   * The returned Variant has SAMPLES() and GENOTYPES() methods which are
   * lazily evaluated to avoid parsing the potentially long list of samples from
   * e.g. 1000 genotypes data unless requested.
   *
   * @param {string} line - A string of a line from a VCF
   */
  parseLine(line: string) {
    return new Variant(
      line,
      this.metadata.INFO as Record<string, { Type?: string }>,
      this.metadata.FORMAT as Record<string, { Type?: string }>,
      this.samples,
      this.strict,
    )
  }
}

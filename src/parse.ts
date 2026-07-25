import { Variant } from './Variant.ts'
import { parseStructuredMetaVal } from './parseMetaString.ts'
import vcfReserved from './vcfReserved.ts'

import type { MetaField, MetaMap } from './parseInfo.ts'

export { Variant } from './Variant.ts'

type Metadata = Record<string, MetaMap | MetaField | string | undefined>

const VCF_COLUMNS = [
  '#CHROM',
  'POS',
  'ID',
  'REF',
  'ALT',
  'QUAL',
  'FILTER',
  'INFO',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export default class VCFParser {
  private metadata: Metadata
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
    for (const line of headerLines) {
      if (!line.startsWith('#')) {
        throw new Error(`Bad line in header:\n${line}`)
      }
      if (line.startsWith('##')) {
        this.parseMetadata(line)
      } else {
        lastLine = line
      }
    }

    if (!lastLine) {
      throw new Error('No format line found in header')
    }
    const fields = lastLine.trim().split('\t')
    if (fields.length < 8) {
      throw new Error(`VCF header missing columns:\n${lastLine}`)
    }
    if (VCF_COLUMNS.some((column, index) => fields[index] !== column)) {
      throw new Error(`VCF column headers not correct:\n${lastLine}`)
    }
    this.samples = fields.slice(9)
  }

  private parseMetadata(line: string) {
    const match = /^##(.+?)=(.*)/.exec(line.trim())
    if (!match) {
      throw new Error(`Line is not a valid metadata line: ${line}`)
    }
    const r = match[1] ?? ''
    const metaVal = match[2]
    if (metaVal?.startsWith('<')) {
      const existing = this.metadata[r]
      const section: MetaMap =
        existing && typeof existing === 'object' ? (existing as MetaMap) : {}
      const [id, keyVals] = parseStructuredMetaVal(metaVal)
      if (typeof id === 'string') {
        // ##INFO=<ID=AF_ESP,...>
        section[id] = keyVals
        this.metadata[r] = section
      } else {
        // ##ID=<Description="ClinVar Variation ID">
        this.metadata[r] = keyVals
      }
    } else {
      this.metadata[r] = metaVal
    }
  }

  getMetadata(): Metadata
  getMetadata(section: string): MetaMap | MetaField | string | undefined
  getMetadata(section: string, ...rest: string[]): unknown
  getMetadata(...args: string[]): unknown {
    let current: unknown = this.metadata
    for (const arg of args) {
      current = isRecord(current) ? current[arg] : undefined
    }
    return current
  }

  // SAMPLES() and GENOTYPES() on the returned Variant are lazily evaluated.
  parseLine(line: string) {
    return new Variant(
      line,
      this.metadata.INFO as MetaMap,
      this.metadata.FORMAT as MetaMap,
      this.samples,
      this.strict,
    )
  }
}

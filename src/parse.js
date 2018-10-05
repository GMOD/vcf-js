/**
 * Class representing a VCF parser, instantiated with the VCF header.
 * @param {object} args
 * @param {string} args.header - The VCF header. Supports both LF and CRLF
 * newlines.
 */
class VCF {
  constructor(args) {
    const headerLines = args.header.split(/[\r\n]+/).filter(line => line)
    this.metadata = {
      INFO: this._vcfReservedInfoFields,
      FORMAT: this._vcfReservedGenotypeFields,
      ALT: this._vcfReservedAltTypes,
    }
    headerLines.forEach(line => {
      if (!line.startsWith('#')) {
        console.warn(`Bad line in header:\n${line}`)
      }
      if (!line.startsWith('#CHROM')) {
        this._parseMetadata(line)
      } else if (line) {
        const fields = line.split('\t')
        if (fields.length < 8) {
          throw new Error(`VCF header missing columns:\n${line}`)
        } else if (fields.length === 9) {
          throw new Error(`VCF header has FORMAT but no samples:\n${line}`)
        } else if (
          !fields.slice(0, 8) ===
          ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO']
        ) {
          throw new Error(`VCF column headers not correct:\n${line}`)
        }
        this.samples = fields.slice(9)
      }
    })
    if (!this.samples) throw new Error('VCF does not have a header line')
  }

  /**
   * Parse a VCF metadata line (i.e. a line that starts with "##") and add its
   * properties to the object.
   * @param {string} line - A line from the VCF. Supports both LF and CRLF
   * newlines.
   */
  _parseMetadata(line) {
    const [metaKey, metaVal] = line
      .trim()
      .match(/^##(.+?)=(.*)/)
      .slice(1, 3)
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
   * @param {string} metaVal - The VCF metadata value
   *
   * @returns {Array} - Array with two entries, 1) a string of the metadata ID
   * and 2) an object with the other key-value pairs in the metadata
   */
  _parseStructuredMetaVal(metaVal) {
    const keyVals = this._parseKeyValue(metaVal.replace(/^<|>$/g, ''), ',')
    const id = keyVals.ID
    delete keyVals.ID
    if ('Number' in keyVals) {
      if (!Number.isNaN(keyVals.Number)) {
        keyVals.Number = Number(keyVals.Number)
      }
    }
    return [id, keyVals]
  }

  /**
   * Get metadata filtered by the elements in args. For example, can pass
   * ('INFO', 'DP') to only get info on an metadata tag that was like
   * "##INFO=<ID=DP,...>"
   * @param  {...string} args - List of metadata filter strings.
   *
   * @returns {any} An object, string, or number, depending on the filtering
   */
  getMetadata(...args) {
    let last = this.metadata
    for (let i = 0; args.length; i += 1) {
      if (last[args[i]] && !last[args[i]][args[i + 1]]) return last[args[i]]
      last = last[args[i]]
    }
    return this.metadata
  }

  /**
   * Sometimes VCFs have key-value strings that allow the separator within
   * the value if it's in quotes, like:
   * 'ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129"'
   *
   * Parse this at a low level since we can't just split at "," (or whatever
   * separator). Above line would be parsed to:
   * {ID: 'DB', Number: '0', Type: 'Flag', Description: 'dbSNP membership, build 129'}
   * @param {string} str - Key-value pairs in a string
   * @param {string} [pairSeparator] - A string that separates sets of key-value
   * pairs
   *
   * @returns {object} An object containing the key-value pairs
   */
  _parseKeyValue(str, pairSeparator = ';') {
    const data = {}
    let currKey = ''
    let currValue = ''
    let state = 1 // states: 1: read key to = or pair sep, 2: read value to sep or quote, 3: read value to quote
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
        } else currValue += str[i]
      } else if (state === 3) {
        // read value to quote
        if (str[i] !== '"') currValue += str[i]
        else state = 2
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
   * @param {string} line - A string of a line from a VCF. Supports both LF and
   * CRLF newlines.
   */
  parseLine(line) {
    const fields = line.trim().split('\t')
    const variant = {
      CHROM: fields[0],
      POS: Number(fields[1]),
      ID: fields[2] === '.' ? null : fields[2].split(';'),
      REF: fields[3],
      ALT: fields[4] === '.' ? null : fields[4].split(','),
      QUAL: fields[5] === '.' ? null : parseFloat(fields[5]),
    }
    if (fields[6] === '.') {
      variant.FILTER = null
    } else if (fields[6] === 'PASS') {
      variant.FILTER = 'PASS'
    } else {
      variant.FILTER = fields[6].split(';')
    }
    const info = fields[7] === '.' ? {} : this._parseKeyValue(fields[7])
    Object.keys(info).forEach(key => {
      let items
      if (info[key]) {
        items = info[key].split(',')
        items = items.map(val => {
          if (val === '.') return null
          return val
        })
      } else items = info[key]
      const itemType = this.getMetadata('INFO', key, 'Type')
      if (itemType) {
        if (itemType === 'Integer' || itemType === 'Float') {
          items = items.map(val => {
            if (val === null) return null
            return Number(val)
          })
        } else if (itemType === 'Flag' && info[key]) {
          console.warn(
            `Info field ${key} is a Flag and shoud not have a value (got value ${
              info[key]
            })`,
          )
        }
      }
      info[key] = items
    })
    variant.INFO = info
    variant.SAMPLES = {}
    const formatKeys = fields[8] && fields[8].split(':')
    this.samples.forEach((sample, index) => {
      const sampleFormats = fields[9 + index]
        .split(':')
        .reduce((accumulator, formatValue, formatIndex) => {
          let thisValue =
            formatValue === '' ||
            formatValue === '.' ||
            formatValue === undefined
              ? null
              : formatValue
          if (typeof thisValue === 'string') {
            thisValue = thisValue.split(',')
          }
          const valueType = this.getMetadata(
            'FORMAT',
            formatKeys[formatIndex],
            'Type',
          )
          if (valueType === 'Integer' || (valueType === 'Float' && thisValue)) {
            thisValue = thisValue.map(val => {
              if (val === '.') return null
              return Number(val)
            })
          }
          accumulator[formatKeys[formatIndex]] = thisValue
          return accumulator
        }, {})
      variant.SAMPLES[sample] = sampleFormats
    })
    return variant
  }

  /**
   * A getter that returns the INFO fields that are reserved in the VCF spec.
   */
  get _vcfReservedInfoFields() {
    return {
      // from the VCF4.3 spec, https://samtools.github.io/hts-specs/VCFv4.3.pdf
      AA: { Number: 1, Type: 'String', Description: 'Ancestral allele' },
      AC: {
        Number: 'A',
        Type: 'Integer',
        Description:
          'Allele count in genotypes, for each ALT allele, in the same order as listed',
      },
      AD: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Total read depth for each allele',
      },
      ADF: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele on the forward strand',
      },
      ADR: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele on the reverse strand',
      },
      AF: {
        Number: 'A',
        Type: 'Float',
        Description:
          'Allele frequency for each ALT allele in the same order as listed (estimated from primary data, not called genotypes)',
      },
      AN: {
        Number: 1,
        Type: 'Integer',
        Description: 'Total number of alleles in called genotypes',
      },
      BQ: {
        Number: 1,
        Type: 'Float',
        Description: 'RMS base quality',
      },
      CIGAR: {
        Number: 1,
        Type: 'Float',
        Description:
          'Cigar string describing how to align an alternate allele to the reference allele',
      },
      DB: {
        Number: 0,
        Type: 'Flag',
        Description: 'dbSNP membership',
      },
      DP: {
        Number: 1,
        Type: 'Integer',
        Description: 'combined depth across samples',
      },
      END: {
        Number: 1,
        Type: 'Integer',
        Description: 'End position (for use with symbolic alleles)',
      },
      H2: {
        Number: 0,
        Type: 'Flag',
        Description: 'HapMap2 membership',
      },
      H3: {
        Number: 0,
        Type: 'Flag',
        Description: 'HapMap3 membership',
      },
      MQ: {
        Number: 1,
        Type: null,
        Description: 'RMS mapping quality',
      },
      MQ0: {
        Number: 1,
        Type: 'Integer',
        Description: 'Number of MAPQ == 0 reads',
      },
      NS: {
        Number: 1,
        Type: 'Integer',
        Description: 'Number of samples with data',
      },
      SB: {
        Number: 4,
        Type: 'Integer',
        Description: 'Strand bias',
      },
      SOMATIC: {
        Number: 0,
        Type: 'Flag',
        Description: 'Somatic mutation (for cancer genomics)',
      },
      VALIDATED: {
        Number: 0,
        Type: 'Flag',
        Description: 'Validated by follow-up experiment',
      },
      '1000G': {
        Number: 0,
        Type: 'Flag',
        Description: '1000 Genomes membership',
      },
      // specifically for structural variants
      IMPRECISE: {
        Number: 0,
        Type: 'Flag',
        Description: 'Imprecise structural variation',
      },
      NOVEL: {
        Number: 0,
        Type: 'Flag',
        Description: 'Indicates a novel structural variation',
      },
      // For precise variants, END is POS + length of REF allele - 1,
      // and the for imprecise variants the corresponding best estimate.
      SVTYPE: {
        Number: 1,
        Type: 'String',
        Description: 'Type of structural variant',
      },
      // Value should be one of DEL, INS, DUP, INV, CNV, BND. This key can
      // be derived from the REF/ALT fields but is useful for filtering.
      SVLEN: {
        Number: null,
        Type: 'Integer',
        Description: 'Difference in length between REF and ALT alleles',
      },
      // One value for each ALT allele. Longer ALT alleles (e.g. insertions)
      // have positive values, shorter ALT alleles (e.g. deletions)
      // have negative values.
      CIPOS: {
        Number: 2,
        Type: 'Integer',
        Description: 'Confidence interval around POS for imprecise variants',
      },
      CIEND: {
        Number: 2,
        Type: 'Integer',
        Description: 'Confidence interval around END for imprecise variants',
      },
      HOMLEN: {
        Type: 'Integer',
        Description:
          'Length of base pair identical micro-homology at event breakpoints',
      },
      HOMSEQ: {
        Type: 'String',
        Description:
          'Sequence of base pair identical micro-homology at event breakpoints',
      },
      BKPTID: {
        Type: 'String',
        Description:
          'ID of the assembled alternate allele in the assembly file',
      },
      // For precise variants, the consensus sequence the alternate allele assembly
      // is derivable from the REF and ALT fields. However, the alternate allele
      // assembly file may contain additional information about the characteristics
      // of the alt allele contigs.
      MEINFO: {
        Number: 4,
        Type: 'String',
        Description: 'Mobile element info of the form NAME,START,END,POLARITY',
      },
      METRANS: {
        Number: 4,
        Type: 'String',
        Description:
          'Mobile element transduction info of the form CHR,START,END,POLARITY',
      },
      DGVID: {
        Number: 1,
        Type: 'String',
        Description: 'ID of this element in Database of Genomic Variation',
      },
      DBVARID: {
        Number: 1,
        Type: 'String',
        Description: 'ID of this element in DBVAR',
      },
      DBRIPID: {
        Number: 1,
        Type: 'String',
        Description: 'ID of this element in DBRIP',
      },
      MATEID: {
        Number: null,
        Type: 'String',
        Description: 'ID of mate breakends',
      },
      PARID: {
        Number: 1,
        Type: 'String',
        Description: 'ID of partner breakend',
      },
      EVENT: {
        Number: 1,
        Type: 'String',
        Description: 'ID of event associated to breakend',
      },
      CILEN: {
        Number: 2,
        Type: 'Integer',
        Description:
          'Confidence interval around the inserted material between breakend',
      },
      DPADJ: { Type: 'Integer', Description: 'Read Depth of adjacency' },
      CN: {
        Number: 1,
        Type: 'Integer',
        Description: 'Copy number of segment containing breakend',
      },
      CNADJ: {
        Number: null,
        Type: 'Integer',
        Description: 'Copy number of adjacency',
      },
      CICN: {
        Number: 2,
        Type: 'Integer',
        Description: 'Confidence interval around copy number for the segment',
      },
      CICNADJ: {
        Number: null,
        Type: 'Integer',
        Description: 'Confidence interval around copy number for the adjacency',
      },
    }
  }

  /**
   * A getter that returns the FORMAT fields that are reserved in the VCF spec.
   */
  get _vcfReservedGenotypeFields() {
    return {
      // from the VCF4.3 spec, https://samtools.github.io/hts-specs/VCFv4.3.pdf
      AD: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele',
      },
      ADF: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele on the forward strand',
      },
      ADR: {
        Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele on the reverse strand',
      },
      DP: {
        Number: 1,
        Type: 'Integer',
        Description: 'Read depth',
      },
      EC: {
        Number: 'A',
        Type: 'Integer',
        Description: 'Expected alternate allele counts',
      },
      FT: {
        Number: 1,
        Type: 'String',
        Description: 'Filter indicating if this genotype was "called"',
      },
      GL: {
        Number: 'G',
        Type: 'Float',
        Description: 'Genotype likelihoods',
      },
      GP: {
        Number: 'G',
        Type: 'Float',
        Description: 'Genotype posterior probabilities',
      },
      GQ: {
        Number: 1,
        Type: 'Integer',
        Description: 'Conditional genotype quality',
      },
      GT: {
        Number: 1,
        Type: 'String',
        Description: 'Genotype',
      },
      HQ: {
        Number: 2,
        Type: 'Integer',
        Description: 'Haplotype quality',
      },
      MQ: {
        Number: 1,
        Type: 'Integer',
        Description: 'RMS mapping quality',
      },
      PL: {
        Number: 'G',
        Type: 'Integer',
        Description:
          'Phred-scaled genotype likelihoods rounded to the closest integer',
      },
      PQ: {
        Number: 1,
        Type: 'Integer',
        Description: 'Phasing quality',
      },
      PS: {
        Number: 1,
        Type: 'Integer',
        Description: 'Phase set',
      },
    }
  }

  /**
   * A getter that returns the ALT fields that are reserved in the VCF spec.
   */
  get _vcfReservedAltTypes() {
    return {
      DEL: {
        Description: 'Deletion relative to the reference',
        so_term: 'deletion',
      },
      INS: {
        Description: 'Insertion of novel sequence relative to the reference',
        so_term: 'insertion',
      },
      DUP: {
        Description: 'Region of elevated copy number relative to the reference',
        so_term: 'copy_number_gain',
      },
      INV: {
        Description: 'Inversion of reference sequence',
        so_term: 'inversion',
      },
      CNV: {
        Description:
          'Copy number variable region (may be both deletion and duplication)',
        so_term: 'copy_number_variation',
      },
      'DUP:TANDEM': {
        Description: 'Tandem duplication',
        so_term: 'copy_number_gain',
      },
      'DEL:ME': {
        Description: 'Deletion of mobile element relative to the reference',
      },
      'INS:ME': {
        Description: 'Insertion of a mobile element relative to the reference',
      },
      NON_REF: {
        Description:
          'Represents any possible alternative allele at this location',
        so_term: 'sequence_variant',
      },
      '*': {
        Description:
          'Represents any possible alternative allele at this location',
        so_term: 'sequence_variant',
      },
    }
  }
}

module.exports = VCF

import vcfReserved from './vcfReserved'

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
      INFO: vcfReserved.InfoFields,
      FORMAT: vcfReserved.GenotypeFields,
      ALT: vcfReserved.AltTypes,
      FILTER: vcfReserved.FilterTypes,
    }
    headerLines.forEach(line => {
      if (!line.startsWith('#')) {
        throw new Error(`Bad line in header:\n${line}`)
      }
      if (line.startsWith('##')) {
        this._parseMetadata(line)
      } else if (line) {
        const fields = line.split('\t')
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
          throw new Error(`VCF header missing columns:\n${line}`)
        } else if (fields.length === 9) {
          throw new Error(`VCF header has FORMAT but no samples:\n${line}`)
        } else if (
          thisHeader.length !== correctHeader.length ||
          !thisHeader.every((value, index) => value === correctHeader[index])
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
      if (!Number.isNaN(Number(keyVals.Number))) {
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
    if (args.length && !(args[0] in this.metadata)) return undefined
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
      variant.SAMPLES[sample] = {}
      formatKeys.forEach(key => {
        variant.SAMPLES[sample][key] = null
      })
      fields[9 + index].split(':').forEach((formatValue, formatIndex) => {
        let thisValue
        if (
          formatValue === '' ||
          formatValue === '.' ||
          formatValue === undefined
        ) {
          thisValue = null
        } else {
          thisValue = formatValue.split(',')
          thisValue = thisValue.map(val => {
            if (val === '.') return null
            return val
          })
          const valueType = this.getMetadata(
            'FORMAT',
            formatKeys[formatIndex],
            'Type',
          )
          if ((valueType === 'Integer' || valueType === 'Float') && thisValue) {
            thisValue = thisValue.map(val => {
              if (!val) return null
              return Number(val)
            })
          }
        }
        variant.SAMPLES[sample][formatKeys[formatIndex]] = thisValue
      }, {})
    })
    return variant
  }
}

module.exports = VCF

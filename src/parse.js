class VCF {
  constructor(header) {
    const headerLines = header.split(/[\r\n]+/).filter(line => line)
    this.metadata = {}
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

  _parseMetadata(line) {
    const [metaKey, metaVal] = line
      .trim()
      .match(/^##(\w+)=(.*)/)
      .slice(1, 3)
    if (metaVal.match(/^<.+>$/)) {
      if (!(metaKey in this.metadata)) {
        this.metadata[metaKey] = {}
      }
      const [id, keyVals] = this._parseStructuredMetaVal(metaVal)
      this.metadata[metaKey][id] = keyVals
    } else {
      this.metadata[metaKey] = metaVal
    }
  }

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

  getMetadata(...args) {
    let last = this.metadata
    for (let i = 0; args.length; i += 1) {
      if (args[i] && !args[i + 1]) return last[args[i]]
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

  parseLine(line) {
    const fields = line.trim().split('\t')
    const variant = {
      CHROM: fields[0],
      POS: Number(fields[1]),
      ID: fields[2] === '.' ? null : fields[2],
      REF: fields[3],
      ALT: fields[4] === '.' ? null : fields[4].split(','),
      QUAL: fields[5] === '.' ? null : Number(fields[5]),
      FILTER: fields[6] === '.' ? null : fields[6],
    }
    const info = fields[7] === '.' ? {} : this._parseKeyValue(fields[7])
    variant.INFO = info
    variant.SAMPLES = {}
    const formatKeys = fields[8] && fields[8].split(':')
    this.samples.forEach((sample, index) => {
      const sampleFormats = fields[9 + index]
        .split(':')
        .reduce((accumulator, currentValue, currentIndex) => {
          accumulator[formatKeys[currentIndex]] =
            currentValue === ('' || undefined) ? null : currentValue
          return accumulator
        }, {})
      variant.SAMPLES[sample] = sampleFormats
    })
    return variant
  }
}

module.exports = VCF

class VCF {
  constructor(header) {
    const headerLines = header.split(/[\r\n]/)
    headerLines.forEach(line => {
      if (line && !line.startsWith('#')) {
        console.warn(`Bad line in header:\n${line}`)
      }
      if (line.startsWith('#CHROM')) {
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
  }

  parseLine(line) {
    const fields = line.trim().split('\t')
    const variant = {
      CHROM: fields[0],
      POS: Number(fields[1]),
      ID: fields[2],
      REF: fields[3],
      ALT: fields[4].split(','),
      QUAL: Number(fields[5]),
      FILTER: fields[6],
    }
    const info = fields[7].split(';').reduce((accumulator, currentValue) => {
      const [key, val] = currentValue.split('=')
      accumulator[key] = val === undefined ? null : val
      return accumulator
    }, {})
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

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
        } else {
          if (
            !fields.slice(0, 8) ===
            ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO']
          ) {
            throw new Error(`VCF column headers not correct:\n${line}`)
          }
          this.samples = fields.slice(9)
        }
      }
    })
  }

  parseLine(line) {
    const fields = line.trim().split('\t')
    return {
      CHROM: fields[0],
      POS: fields[1],
      ID: fields[2],
      REF: fields[3],
      ALT: fields[4],
      QUAL: fields[5],
      FILTER: fields[6],
      INFO: fields[7],
    }
  }
}

module.exports = VCF

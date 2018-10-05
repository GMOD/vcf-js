const VCF = require('../src')

describe('VCF parser', () => {
  let VCFParser
  beforeAll(() => {
    VCFParser = new VCF({
      header: `##fileformat=VCFv4.3
##fileDate=20090805
##source=myImputationProgramV3.1
##reference=file:///seq/references/1000GenomesPilot-NCBI36.fasta
##contig=<ID=20,length=62435964,assembly=B36,md5=f126cdf8a6e0c7f379d618ff66beb2da,species="Homo sapiens",taxonomy=x>
##phasing=partial
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of Samples With Data">
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##INFO=<ID=AA,Number=1,Type=String,Description="Ancestral Allele">
##INFO=<ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129">
##INFO=<ID=H2,Number=0,Type=Flag,Description="HapMap2 membership">
##FILTER=<ID=q10,Description="Quality below 10">
##FILTER=<ID=s50,Description="Less than 50% of samples have data">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype Quality">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
##FORMAT=<ID=HQ,Number=2,Type=Integer,Description="Haplotype Quality">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tNA00001\tNA00002\tNA00003
`,
    })
  })

  it('can get metadata from the header', () => {
    const metadata = VCFParser.getMetadata()
    expect(metadata.FILTER.q10).toEqual({ Description: 'Quality below 10' })
    expect(metadata.source).toEqual('myImputationProgramV3.1')
  })

  it('can get default metadata not in the header', () => {
    const metadata = VCFParser.getMetadata()
    expect(metadata.INFO.AC).toEqual({
      Number: 'A',
      Type: 'Integer',
      Description:
        'Allele count in genotypes, for each ALT allele, in the same order as listed',
    })
  })

  it('can parse a line from the VCF spec', () => {
    const variant = VCFParser.parseLine(
      '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.\n',
    )
    expect(variant).toEqual({
      CHROM: '20',
      POS: 14370,
      ID: ['rs6054257'],
      REF: 'G',
      ALT: ['A'],
      QUAL: 29,
      FILTER: 'PASS',
      INFO: { NS: [3], DP: [14], AF: [0.5], DB: null, H2: null },
      SAMPLES: {
        NA00001: { GT: ['0|0'], GQ: [48], DP: [1], HQ: [51, 51] },
        NA00002: { GT: ['1|0'], GQ: [48], DP: [8], HQ: [51, 51] },
        NA00003: { GT: ['1/1'], GQ: [43], DP: [5], HQ: [null, null] },
      },
    })
  })

  it('can parse a line with minimal entries', () => {
    const variant = VCFParser.parseLine(
      '20\t14370\t.\tG\tA\t.\t.\t.\tGT:GQ:DP:HQ\t.\t.\t.\n',
    )
    expect(variant).toEqual({
      CHROM: '20',
      POS: 14370,
      ID: null,
      REF: 'G',
      ALT: ['A'],
      QUAL: null,
      FILTER: null,
      INFO: {},
      SAMPLES: {
        NA00001: { GT: null, GQ: null, DP: null, HQ: null },
        NA00002: { GT: null, GQ: null, DP: null, HQ: null },
        NA00003: { GT: null, GQ: null, DP: null, HQ: null },
      },
    })
  })

  let tmp // eslint-disable-line
  it('throws errors with bad header lines', () => {
    expect(() => {
      tmp = new VCF({ header: 'notARealHeader' })
    }).toThrow('Bad line in header')
    expect(() => {
      tmp = new VCF({ header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\n' })
    }).toThrow('VCF header missing columns')
    expect(() => {
      tmp = new VCF({
        header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\n',
      })
    }).toThrow('VCF header has FORMAT but no samples')
    expect(() => {
      tmp = new VCF({ header: '#CHROM\tPS\tID\tRF\tALT\tQUAL\tFILTER\tINFO\n' })
    }).toThrow('VCF column headers not correct')
    expect(() => {
      tmp = new VCF({ header: '##this=badHeader\n' })
    }).toThrow('VCF does not have a header line')
  })
})

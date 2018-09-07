// const { TabixIndexedFile } = require('@gmod/tabix')
const VCF = require('../src')

// function getVariants(filename, chrom, start, stop) {
//   const tbiIndexed = new TabixIndexedFile({ path: filename })
//   const headerText = tbiIndexed.getHeader()
//   const VCFParser = new VCF({ header: headerText })
//   const variants = []
//   tbiIndexed.getLines(chrom, start, stop, line =>
//     variants.push(VCFParser.parseLine(line)),
//   )
//   return variants
// }

test('Just testing', () => {
  const VCFParser = new VCF(
    `##fileformat=VCFv4.3
##fileDate=20090805
##source=myImputationProgramV3.1
##reference=file:///seq/references/1000GenomesPilot-NCBI36.fasta
##contig=<ID=contigA,length=62435964,assembly=B36,md5=f126cdf8a6e0c7f379d618ff66beb2da,species="Homo sapiens",taxonomy=x>
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
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tHG00096\n`,
  )
  const variant = VCFParser.parseLine(
    'contigA\t3000\trs17883296\tG\tT,A\t100\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:AP\t0|0:0.000,0.000\n',
  )
  console.log(variant)
})

// describe('VCF parser', () => {
//   xit('reads big dbsnp', async () => {
//     const variants = getVariants(
//       '../../../data/big_vcf/00-All.vcf.gz',
//       'chr10',
//       33870887,
//       33896487,
//     )
//     expect(variants.length).toEqual(560)
//   })

//   it('reads gvcf * alleles', () => {
//     const variants = getVariants(
//       '../../docs/tutorial/data_files/gvcf.vcf.gz',
//       'ctgA',
//       0,
//       5000,
//     )
//     expect(variants.length).toEqual(7)
//     expect(variants[2].ALT).toEqual(['TC', '<*>'])
//   })

//   it('no newline in VCF genotypes', () => {
//     const variants = getVariants(
//       '../../docs/tutorial/data_files/volvox.test.vcf.gz',
//       'ctgA',
//       0,
//       7000,
//     )
//     const hasGT = Object.keys(variants[0]).map((currentValue, index) => {
//       if (index < 8) return true
//       if ('GT' in currentValue) return true
//       return false
//     })
//     expect(hasGT.every(currentValue => currentValue)).toEqual(true)
//   })

//   it('reads gatk non_ref alleles', () => {
//     const variants = getVariants('../data/raw.g.vcf.gz', 'ctgA', 0, 100)
//     expect(variants.length).toEqual(37)
//     expect(variants[0].ALT).toEqual(['<NON_REF>'])
//   })

//   it('parses END field', () => {
//     const variants = getVariants(
//       '../../docs/tutorial/data_files/volvox.test.vcf.gz',
//       '1',
//       1,
//       5000,
//     )
//     expect(variants[0].INFO.END).toEqual(4388)
//     expect(variants[1].INFO.END).toEqual(4600)
//     expect(variants.length).toEqual(2)
//   })

//   xit('large VCF header', () => {
//     const variants = getVariants(
//       '../data/large_vcf_header/large_vcf_header.vcf.gz',
//       'LcChr1',
//       1,
//       10000,
//     )
//     expect(Object.keys(variants[0]).length).toEqual(332) // expect non empty object
//   })
// })

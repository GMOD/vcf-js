// @ts-nocheck
import { test, expect } from 'vitest'
import fs from 'fs'
import VCF, { parseBreakend } from '../src'

const readVcf = file => {
  const f = fs.readFileSync(file, 'utf8')
  const lines = f.split('\n')
  const header = []
  const rest = []
  lines.forEach(line => {
    if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      rest.push(line)
    }
  })
  return { header: header.join('\n'), lines: rest }
}

function makeParser() {
  return new VCF({
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
##INFO=<ID=TEST,Number=1,Type=String,Description="Used for testing">
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##FILTER=<ID=q10,Description="Quality below 10">
##FILTER=<ID=s50,Description="Less than 50% of samples have data">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype Quality">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
##FORMAT=<ID=HQ,Number=2,Type=Integer,Description="Haplotype Quality">
##FORMAT=<ID=PL,Number=G,Type=Integer,Description="List of Phred-scaled genotype likelihoods">
##FORMAT=<ID=TEST,Number=1,Type=String,Description="Used for testing">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tNA00001\tNA00002\tNA00003
`,
  })
}

test('can get metadata from the header', () => {
  const VCFParser = makeParser()
  // Note that there is a custom PL that overrides the default PL
  expect(VCFParser.getMetadata()).toMatchSnapshot()
  expect(VCFParser.getMetadata('nonexistent')).toBe(undefined)
  expect(VCFParser.getMetadata('fileDate')).toBe('20090805')
  expect(VCFParser.getMetadata('INFO')).toMatchSnapshot()
  expect(VCFParser.getMetadata('INFO', 'nonexistent')).toBe(undefined)
  expect(VCFParser.getMetadata('INFO', 'AA')).toEqual({
    Description: 'Ancestral Allele',
    Number: 1,
    Type: 'String',
  })
  expect(VCFParser.getMetadata('INFO', 'AA', 'nonexistent')).toBe(undefined)
  expect(VCFParser.getMetadata('INFO', 'AA', 'Type')).toBe('String')
  expect(VCFParser.getMetadata('INFO', 'AA', 'Type', 'nonexistent')).toBe(
    undefined,
  )
  expect(VCFParser.getMetadata('INFO', 'TEST')).toEqual({
    Description: 'Used for testing',
    Number: 1,
    Type: 'String',
  })
})

test('can get default metadata not in the header', () => {
  const VCFParser = makeParser()
  const metadata = VCFParser.getMetadata()
  expect(metadata.INFO.AC).toEqual({
    Number: 'A',
    Type: 'Integer',
    Description:
      'Allele count in genotypes, for each ALT allele, in the same order as listed',
  })
})

test('can parse a line from the VCF spec', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.\n',
  )
  expect(variant).toMatchSnapshot()
  expect(variant.SAMPLES()).toMatchSnapshot()
})

test('can parse a line with minimal entries', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\t.\tG\tA\t.\t.\t.\tGT:GQ:DP:HQ\t.\t.\t.\n',
  )
  expect(variant).toMatchSnapshot()
  expect(variant.SAMPLES()).toMatchSnapshot()
})

test('parses a line with a breakend ALT', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '2\t321681\tbnd_W\tG\tG]17:198982]\t6\tPASS\tSVTYPE=BND',
  )
  expect(variant.ALT.length).toBe(1)
  expect(variant.INFO.SVTYPE).toEqual(['BND'])
  expect(variant).toMatchSnapshot()
})

test(`parses a line with mix of multiple breakends and non breakends`, () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    `13\t123456\tbnd_U\tC\tCTATGTCG,C[2 : 321682[,C[17 : 198983[\t6\tPASS\tSVTYPE=BND;MATEID=bnd V,bnd Z`,
  )
  expect(variant.ALT.length).toBe(3)
  expect(variant.INFO.SVTYPE).toEqual(['BND'])
  expect(variant).toMatchSnapshot()
})

test('throws errors with bad header lines', () => {
  expect(() => {
    new VCF({ header: 'notARealHeader' })
  }).toThrow('Bad line in header')
  expect(() => {
    new VCF({
      header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\n',
    })
  }).toThrow('VCF header missing columns')
  expect(() => {
    new VCF({
      header: '#CHROM\tPS\tID\tRF\tALT\tQUAL\tFILTER\tINFO\n',
    })
  }).toThrow('VCF column headers not correct')
  expect(() => {
    new VCF({ header: '##this=badHeader\n' })
  }).toThrow(/No format line/)
})

test('can parse a line from the VCF spec', () => {
  const VCFParser = new VCF({
    header: `##fileformat=VCFv4.2
##source=Sniffles
##fileDate=20170420
##ALT=<ID=DEL,Description="Deletion">
##ALT=<ID=DUP,Description="Duplication">
##ALT=<ID=INV,Description="Inversion">
##ALT=<ID=INVDUP,Description="InvertedDUP with unknown boundaries">
##ALT=<ID=TRA,Description="Translocation">
##ALT=<ID=INS,Description="Insertion">
##INFO=<ID=CHR2,Number=1,Type=String,Description="Chromosome for END coordinate in case of a translocation">
##INFO=<ID=END,Number=1,Type=Integer,Description="End position of the structural variant">
##INFO=<ID=MAPQ,Number=1,Type=Integer,Description="Median mapping quality of paired-ends">
##INFO=<ID=RE,Number=1,Type=Integer,Description="read support">
##INFO=<ID=IMPRECISE,Number=0,Type=Flag,Description="Imprecise structural variation">
##INFO=<ID=PRECISE,Number=0,Type=Flag,Description="Precise structural variation">
##INFO=<ID=SVLEN,Number=1,Type=Integer,Description="Length of the SV">
##INFO=<ID=SVMETHOD,Number=1,Type=String,Description="Type of approach used to detect SV">
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=DR,Number=1,Type=Integer,Description="# high-quality reference reads">
##FORMAT=<ID=DV,Number=1,Type=Integer,Description="# high-quality variant reads">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	/seq/schatz/fritz/sv-paper/real/Nanopore_NA12878/mapped/ngm_Nanopore_human_ngmlr-0.2.3_mapped.bam`,
  })
  const variant = VCFParser.parseLine(
    '8\t17709115\t28329_0\tN\t<DEL>\t.\tPASS\tPRECISE;SVMETHOD=Snifflesv1.0.3;CHR2=8;END=17709148;STD_quant_start=0.000000;STD_quant_stop=0.000000;Kurtosis_quant_start=20.524521;Kurtosis_quant_stop=3.925926;SVTYPE=DEL;SUPTYPE=AL;SVLEN=33;STRANDS=+-;STRANDS2=20,14,20,14;RE=34;AF=0.971429\tGT:DR:DV\t1/1:1:34',
  )
  expect(variant).toMatchSnapshot()
  expect(variant.SAMPLES()).toMatchSnapshot()
})

test('can parse a line from the VCF spec Y chrom (haploid))', () => {
  const VCFParser = new VCF({
    header: `##fileformat=VCFv4.1
##FILTER=<ID=PASS,Description="All filters passed">
##fileDate=20150218
##reference=ftp://ftp.1000genomes.ebi.ac.uk//vol1/ftp/technical/reference/phase2_reference_assembly_sequence/hs37d5.fa.gz
##contig=<ID=Y,length=59373566,assembly=b37>
##source=freeBayes v0.9.9.2 | GT values over-written with maximum likelihood state (subject to threshold) OR phylogenetic imputation
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total read depth at the locus">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##source=GenomeSTRiP_v1.04
##ALT=<ID=CNV,Description="Copy number polymorphism">
##FILTER=<ID=ALIGNLENGTH,Description="GSELENGTH < 200">
##FILTER=<ID=CLUSTERSEP,Description="GSCLUSTERSEP == NA || GSCLUSTERSEP <= 2.0">
##FILTER=<ID=DUPLICATE,Description="GSDUPLICATESCORE != NA && GSDUPLICATEOVERLAP >= 0.5 && GSDUPLICATESCORE >= 0.0">
##FILTER=<ID=GTDEPTH,Description="GSM1 == NA || GSM1 <= 0.5 || GSM1 >= 2.0">
##FILTER=<ID=INBREEDINGCOEFF,Description="GLINBREEDINGCOEFF != NA && GLINBREEDINGCOEFF < -0.15">
##FILTER=<ID=NONVARIANT,Description="GSNONVARSCORE != NA && GSNONVARSCORE >= 13.0">
##FORMAT=<ID=CN,Number=1,Type=Integer,Description="Copy number genotype for imprecise events">
##FORMAT=<ID=CNL,Number=.,Type=Float,Description="Copy number likelihoods with no frequency prior">
##FORMAT=<ID=CNP,Number=.,Type=Float,Description="Copy number likelihoods">
##FORMAT=<ID=CNQ,Number=1,Type=Float,Description="Copy number genotype quality for imprecise events">
##FORMAT=<ID=GP,Number=G,Type=Float,Description="Genotype likelihoods">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype Quality">
##FORMAT=<ID=FT,Number=1,Type=String,Description="Per-sample genotype filter">
##FORMAT=<ID=PL,Number=G,Type=Integer,Description="Normalized, Phred-scaled likelihoods for genotypes as defined in the VCF specification">
##INFO=<ID=END,Number=1,Type=Integer,Description="End coordinate of this variant">
##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
##INFO=<ID=AA,Number=1,Type=String,Description="Ancestral allele">
##INFO=<ID=AC,Number=A,Type=Integer,Description="Total number of alternate alleles in called genotypes">
##INFO=<ID=AF,Number=A,Type=Float,Description="Estimated allele frequency in the range (0,1]">
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of samples with data">
##INFO=<ID=AN,Number=1,Type=Integer,Description="Total number of alleles in called genotypes">
##INFO=<ID=SAS_AF,Number=A,Type=Float,Description="Allele frequency in the SAS populations calculated from AC and AN, in the range (0,1)">
##INFO=<ID=EUR_AF,Number=A,Type=Float,Description="Allele frequency in the EUR populations calculated from AC and AN, in the range (0,1)">
##INFO=<ID=AFR_AF,Number=A,Type=Float,Description="Allele frequency in the AFR populations calculated from AC and AN, in the range (0,1)">
##INFO=<ID=AMR_AF,Number=A,Type=Float,Description="Allele frequency in the AMR populations calculated from AC and AN, in the range (0,1)">
##INFO=<ID=EAS_AF,Number=A,Type=Float,Description="Allele frequency in the EAS populations calculated from AC and AN, in the range (0,1)">
##INFO=<ID=VT,Number=.,Type=String,Description="indicates what type of variant the line represents">
##INFO=<ID=EX_TARGET,Number=0,Type=Flag,Description="indicates whether a variant is within the exon pull down target boundaries">
##INFO=<ID=MULTI_ALLELIC,Number=0,Type=Flag,Description="indicates whether a site is multi-allelic">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tHG00096\tHG00101\tHG00103\tHG001055`,
  })
  const variant = VCFParser.parseLine(
    'Y\t14483990\tCNV_Y_14483990_15232198\tC\t<CN0>\t100\tPASS\tAC=1;AF=0.000817661;AN=1223;END=15232198;NS=1233;SVTYPE=CNV;AMR_AF=0;AFR_AF=0;EUR_AF=0.0042;SAS_AF=0;EAS_AF=0;VT=SV;EX_TARGET\tGT:CN:CNL:CNP:CNQ:GP:GQ:PL\t0:1:-1000,0,-119.08:-1000,0,-218.16:99:0,-1000:99:0,10000\t0:1:-1000,0,-43.56:-1000,0,-142.64:99:0,-1000:99:0,10000\t.:.:.:.:.:.:.:.\t.:.:.:.:.:.:.:.',
  )
  const variant2 = VCFParser.parseLine(
    'Y\t2655180\trs11575897\tG\tA\t100\tPASS\tAA=G;AC=22;AF=0.0178427;AN=1233;DP=84761;NS=1233;AMR_AF=0;AFR_AF=0;EUR_AF=0;SAS_AF=0;EAS_AF=0.0902;VT=SNP;EX_TARGET\tGT\t0\t0\t0\t.',
  )
  expect(variant).toMatchSnapshot()
  expect(variant.SAMPLES()).toMatchSnapshot()
  expect(variant2).toMatchSnapshot()
  expect(variant2.SAMPLES()).toMatchSnapshot()
})

test('snippet from VCF 4.3 spec', () => {
  const { header, lines } = readVcf('test/data/vcf4.3_spec_snippet.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variants = lines.map(line => VCFParser.parseLine(line))
  expect(variants).toMatchSnapshot()
  expect(variants.map(variant => variant.SAMPLES())).toMatchSnapshot()
})
test('can parse breakends', () => {
  const header = `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tBAMs/caudaus.sorted.sam`
  const VCFParser = new VCF({
    header,
  })
  const lines =
    `11	94975747	MantaBND:0:2:3:0:0:0:1	G	G]8:107653520]	.	PASS	SVTYPE=BND;MATEID=MantaBND:0:2:3:0:0:0:0;CIPOS=0,2;HOMLEN=2;HOMSEQ=TT;BND_DEPTH=216;MATE_BND_DEPTH=735	PR:SR	722,9:463,15
11	94975753	MantaDEL:0:1:2:0:0:0	T	<DEL>	.	PASS	END=94987865;SVTYPE=DEL;SVLEN=12112;IMPRECISE;CIPOS=-156,156;CIEND=-150,150	PR	161,13
11	94987872	MantaBND:0:0:1:0:0:0:0	T	T[8:107653411[	.	PASS	SVTYPE=BND;MATEID=MantaBND:0:0:1:0:0:0:1;BND_DEPTH=171;MATE_BND_DEPTH=830	PR:SR	489,4:520,19`.split(
      '\n',
    )

  expect(lines.map(line => VCFParser.parseLine(line))).toMatchSnapshot()
})

// from https://github.com/GMOD/jbrowse/issues/1358
test('vcf lines with weird info field and missing format/genotypes', () => {
  const { header, lines } = readVcf(
    'test/data/weird_info_and_missing_format.vcf',
  )
  const VCFParser = new VCF({
    header,
  })

  expect(lines.map(line => VCFParser.parseLine(line))).toMatchSnapshot()
})
test('test no info strict', () => {
  const { header, lines } = readVcf('test/data/multipleAltSVs.vcf')
  const VCFParser = new VCF({
    header,
    strict: true,
  })
  expect(() => VCFParser.parseLine(lines[0])).toThrow(/INFO/)
})

test('test no info non-strict', () => {
  const { header, lines } = readVcf('test/data/multipleAltSVs.vcf')
  const VCFParser = new VCF({
    header,
    strict: false,
  })
  expect(VCFParser.parseLine(lines[0])).toBeTruthy()
  expect(VCFParser.parseLine(lines[0]).GENOTYPES()).toStrictEqual({})
})

test('empty header lines', () => {
  expect(() => new VCF({ header: '\n' })).toThrow(/no non-empty/)
})

test('shortcut parsing with 1000 genomes', () => {
  const { header, lines } = readVcf('test/data/1000genomes.vcf')

  const VCFParser = new VCF({ header })
  expect(lines.map(line => VCFParser.parseLine(line))).toMatchSnapshot()
})

test('shortcut parsing with vcf 4.3 bnd example', () => {
  const { header, lines } = readVcf('test/data/vcf4.3_spec_bnd.vcf')

  const VCFParser = new VCF({ header })
  const variants = lines.map(line => VCFParser.parseLine(line))
  expect(variants.map(m => m.ALT[0].toString())).toEqual(
    lines.map(line => line.split('\t')[4]),
  )

  expect(variants).toMatchSnapshot()
})

test('vcf 4.3 single breakends', () => {
  // single breakend
  expect(parseBreakend('G.')).toMatchSnapshot()
  expect(parseBreakend('ACGT.')).toMatchSnapshot()
  expect(parseBreakend('.ACGT')).toMatchSnapshot()
})

test('vcf 4.3 insertion shorthand', () => {
  expect(parseBreakend('G<ctgA>')).toMatchSnapshot()
  expect(parseBreakend('<ctgA>G')).toMatchSnapshot()
  expect(parseBreakend('C[<ctg1>:1[')).toMatchSnapshot()
  expect(parseBreakend(']13:123456]AGTNNNNNCAT')).toMatchSnapshot()
})

test('parse breakend on symbolic alleles', () => {
  expect(parseBreakend('<TRA>')).not.toBeTruthy()
  expect(parseBreakend('<INS>')).not.toBeTruthy()
  expect(parseBreakend('<DEL>')).not.toBeTruthy()
  expect(parseBreakend('<INV>')).not.toBeTruthy()
})

test('parse breakend on thing that looks like symbolic allele but is actually a feature', () => {
  expect(parseBreakend('<INV>C')).toMatchSnapshot()
})

test('clinvar metadata', () => {
  const { header } = readVcf('test/data/clinvar.header.vcf')
  const VCFParser = new VCF({
    header,
  })
  expect(VCFParser.getMetadata()).toMatchSnapshot()
})

test('sample to genotype information', () => {
  const { header } = readVcf('test/data/sample2genotype.vcf')
  const VCFParser = new VCF({
    header,
  })
  expect(VCFParser.getMetadata().META).toMatchSnapshot()
  expect(VCFParser.getMetadata().SAMPLES).toMatchSnapshot()
})

test('pedigree', () => {
  const { header } = readVcf('test/data/pedigree.vcf')
  const VCFParser = new VCF({
    header,
  })
  expect(VCFParser.getMetadata()).toMatchSnapshot()
})

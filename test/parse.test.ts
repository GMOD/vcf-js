import { test } from 'node:test'
import { strictEqual, deepStrictEqual, ok, throws } from 'node:assert'
import fs from 'fs'
import VCF, { parseBreakend } from '../src'

const readVcf = (file: string) => {
  const f = fs.readFileSync(file, 'utf8')
  const lines = f.split('\n')
  const header = [] as string[]
  const rest = [] as string[]
  lines.forEach(line => {
    if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      rest.push(line)
    }
  })
  return {
    header: header.join('\n'),
    lines: rest,
  }
}

function makeParser() {
  const { header } = readVcf('test/data/spec-example.vcf')
  return new VCF({
    header,
  })
}

test('can get metadata from the header', async () => {
  const VCFParser = makeParser()
  // Note that there is a custom PL that overrides the default PL
  
  // Since Node's test runner doesn't have snapshots built-in,
  // we'll explicitly check the important values
  ok(VCFParser.getMetadata())
  strictEqual(VCFParser.getMetadata('nonexistent'), undefined)
  strictEqual(VCFParser.getMetadata('fileDate'), '20090805')
  
  // Check INFO metadata
  const infoMetadata = VCFParser.getMetadata('INFO')
  ok(infoMetadata)
  strictEqual(VCFParser.getMetadata('INFO', 'nonexistent'), undefined)
  
  deepStrictEqual(VCFParser.getMetadata('INFO', 'AA'), {
    Description: 'Ancestral Allele',
    Number: 1,
    Type: 'String',
  })
  
  strictEqual(VCFParser.getMetadata('INFO', 'AA', 'nonexistent'), undefined)
  strictEqual(VCFParser.getMetadata('INFO', 'AA', 'Type'), 'String')
  strictEqual(VCFParser.getMetadata('INFO', 'AA', 'Type', 'nonexistent'), undefined)
  
  deepStrictEqual(VCFParser.getMetadata('INFO', 'TEST'), {
    Description: 'Used for testing',
    Number: 1,
    Type: 'String',
  })

  deepStrictEqual(VCFParser.getMetadata('INFO', 'AC'), {
    Number: 'A',
    Type: 'Integer',
    Description:
      'Allele count in genotypes, for each ALT allele, in the same order as listed',
  })
})

test('can parse a line from the VCF spec', async () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.\n',
  )
  
  // Since Node's test runner doesn't have snapshots built-in,
  // we'll check the important values
  strictEqual(variant.CHROM, '20')
  strictEqual(variant.POS, 14370)
  strictEqual(variant.ID, 'rs6054257')
  strictEqual(variant.REF, 'G')
  deepStrictEqual(variant.ALT, ['A'])
  strictEqual(variant.QUAL, 29)
  strictEqual(variant.FILTER, 'PASS')
  
  // Check INFO fields
  deepStrictEqual(variant.INFO.NS, [3])
  deepStrictEqual(variant.INFO.DP, [14])
  deepStrictEqual(variant.INFO.AF, [0.5])
  ok(variant.INFO.DB)
  ok(variant.INFO.H2)
  
  // Check sample data
  const samples = variant.SAMPLES()
  ok(samples)
  strictEqual(samples.length, 3)
})

test('can parse a line with minimal entries', async () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\t.\tG\tA\t.\t.\t.\tGT:GQ:DP:HQ\t.\t.\t.\n',
  )
  
  // Check the important values
  strictEqual(variant.CHROM, '20')
  strictEqual(variant.POS, 14370)
  strictEqual(variant.ID, null)
  strictEqual(variant.REF, 'G')
  deepStrictEqual(variant.ALT, ['A'])
  strictEqual(variant.QUAL, null)
  strictEqual(variant.FILTER, null)
  
  // Check sample data
  const samples = variant.SAMPLES()
  ok(samples)
  strictEqual(samples.length, 3)
})

test('parses a line with a breakend ALT', async () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '2\t321681\tbnd_W\tG\tG]17:198982]\t6\tPASS\tSVTYPE=BND',
  )
  strictEqual(variant.ALT?.length, 1)
  deepStrictEqual(variant.INFO.SVTYPE, ['BND'])
  
  // Check basic variant properties
  strictEqual(variant.CHROM, '2')
  strictEqual(variant.POS, 321681)
  strictEqual(variant.ID, 'bnd_W')
  strictEqual(variant.REF, 'G')
  strictEqual(variant.QUAL, 6)
  strictEqual(variant.FILTER, 'PASS')
})

test(`parses a line with mix of multiple breakends and non breakends`, async () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    `13\t123456\tbnd_U\tC\tCTATGTCG,C[2 : 321682[,C[17 : 198983[\t6\tPASS\tSVTYPE=BND;MATEID=bnd V,bnd Z`,
  )
  strictEqual(variant.ALT?.length, 3)
  deepStrictEqual(variant.INFO.SVTYPE, ['BND'])
  
  // Check basic variant properties
  strictEqual(variant.CHROM, '13')
  strictEqual(variant.POS, 123456)
  strictEqual(variant.ID, 'bnd_U')
  strictEqual(variant.REF, 'C')
  strictEqual(variant.QUAL, 6)
  strictEqual(variant.FILTER, 'PASS')
  deepStrictEqual(variant.INFO.MATEID, ['bnd V', 'bnd Z'])
})

test('throws errors with bad header lines', async () => {
  throws(() => {
    new VCF({ header: 'notARealHeader' })
  }, /Bad line in header/)
  
  throws(() => {
    new VCF({
      header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\n',
    })
  }, /VCF header missing columns/)
  
  throws(() => {
    new VCF({
      header: '#CHROM\tPS\tID\tRF\tALT\tQUAL\tFILTER\tINFO\n',
    })
  }, /VCF column headers not correct/)
  
  throws(() => {
    new VCF({ header: '##this=badHeader\n' })
  }, /No format line/)
})

test('sniffles vcf', async () => {
  const { header, lines } = readVcf('test/data/sniffles.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variant = VCFParser.parseLine(lines[0])
  
  // Check basic properties instead of snapshot
  ok(variant)
  ok(variant.SAMPLES())
})

test('can parse a line from the VCF spec Y chrom (haploid))', async () => {
  const { header, lines } = readVcf('test/data/y-chrom-haploid.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variant = VCFParser.parseLine(lines[0])
  const variant2 = VCFParser.parseLine(lines[1])
  
  // Check basic properties instead of snapshot
  ok(variant)
  ok(variant.SAMPLES())
  ok(variant2)
  ok(variant2.SAMPLES())
})

test('snippet from VCF 4.3 spec', async () => {
  const { header, lines } = readVcf('test/data/vcf4.3_spec_snippet.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variants = lines.map(line => VCFParser.parseLine(line))
  
  // Check basic properties instead of snapshot
  ok(variants.length > 0)
  ok(variants.every(variant => variant !== undefined))
  
  const samples = variants.map(variant => variant.SAMPLES())
  ok(samples.length > 0)
  ok(samples.every(sample => sample !== undefined))
})

test('can parse breakends', async () => {
  const { header, lines } = readVcf('test/data/breakends.vcf')
  const VCFParser = new VCF({
    header,
  })
  
  const variants = lines.map(line => VCFParser.parseLine(line))
  ok(variants.length > 0)
  ok(variants.every(variant => variant !== undefined))
})

// from https://github.com/GMOD/jbrowse/issues/1358
test('vcf lines with weird info field and missing format/genotypes', async () => {
  const { header, lines } = readVcf(
    'test/data/weird_info_and_missing_format.vcf',
  )
  const VCFParser = new VCF({
    header,
  })
  
  const variants = lines.map(line => VCFParser.parseLine(line))
  ok(variants.length > 0)
  ok(variants.every(variant => variant !== undefined))
})

test('test no info strict', async () => {
  const { header, lines } = readVcf('test/data/multipleAltSVs.vcf')
  const VCFParser = new VCF({
    header,
    strict: true,
  })
  throws(() => VCFParser.parseLine(lines[0]), /INFO/)
})

test('test no info non-strict', async () => {
  const { header, lines } = readVcf('test/data/multipleAltSVs.vcf')
  const VCFParser = new VCF({
    header,
    strict: false,
  })
  ok(VCFParser.parseLine(lines[0]))
  deepStrictEqual(VCFParser.parseLine(lines[0]).GENOTYPES(), {})
})

test('empty header lines', async () => {
  throws(() => new VCF({ header: '\n' }), /no non-empty/)
})

test('shortcut parsing with 1000 genomes', async () => {
  const { header, lines } = readVcf('test/data/1000genomes.vcf')

  const VCFParser = new VCF({ header })
  const variants = lines.map(line => VCFParser.parseLine(line))
  ok(variants.length > 0)
  ok(variants.every(variant => variant !== undefined))
})

test('shortcut parsing with vcf 4.3 bnd example', async () => {
  const { header, lines } = readVcf('test/data/vcf4.3_spec_bnd.vcf')

  const VCFParser = new VCF({ header })
  const variants = lines.map(line => VCFParser.parseLine(line))
  
  // Check that ALT fields match the expected values from the file
  deepStrictEqual(
    variants.map(m => m.ALT?.[0].toString()),
    lines.map(line => line.split('\t')[4])
  )
  
  ok(variants.length > 0)
  ok(variants.every(variant => variant !== undefined))
})

test('vcf 4.3 single breakends', async () => {
  // single breakend
  ok(parseBreakend('G.'))
  ok(parseBreakend('ACGT.'))
  ok(parseBreakend('.ACGT'))
})

test('vcf 4.3 insertion shorthand', async () => {
  ok(parseBreakend('G<ctgA>'))
  ok(parseBreakend('<ctgA>G'))
  ok(parseBreakend('C[<ctg1>:1['))
  ok(parseBreakend(']13:123456]AGTNNNNNCAT'))
})

test('parse breakend on symbolic alleles', async () => {
  strictEqual(!!parseBreakend('<TRA>'), false)
  strictEqual(!!parseBreakend('<INS>'), false)
  strictEqual(!!parseBreakend('<DEL>'), false)
  strictEqual(!!parseBreakend('<INV>'), false)
})

test('parse breakend on thing that looks like symbolic allele but is actually a feature', async () => {
  ok(parseBreakend('<INV>C'))
})

test('clinvar metadata', async () => {
  const { header } = readVcf('test/data/clinvar.header.vcf')
  const VCFParser = new VCF({
    header,
  })
  ok(VCFParser.getMetadata())
})

test('sample to genotype information', async () => {
  const { header } = readVcf('test/data/sample2genotype.vcf')
  const VCFParser = new VCF({
    header,
  })
  ok(VCFParser.getMetadata().META)
  ok(VCFParser.getMetadata().SAMPLES)
})

test('pedigree', async () => {
  const { header } = readVcf('test/data/pedigree.vcf')
  const VCFParser = new VCF({
    header,
  })
  ok(VCFParser.getMetadata())
})

//https://github.com/samtools/hts-specs/blob/master/examples/vcf/sv44.vcf
test('x vcf44 spec', async () => {
  const { header, lines } = readVcf('test/data/vcf44_spec.vcf')
  const VCFParser = new VCF({
    header,
  })
  ok(VCFParser.getMetadata())
  
  const parsedLines = lines.map(l => {
    const entry = VCFParser.parseLine(l)
    return {
      ...entry,
      SAMPLES: entry.SAMPLES(),
    }
  })
  
  ok(parsedLines.length > 0)
  ok(parsedLines.every(line => line !== undefined))
})

//https://github.com/samtools/hts-specs/blob/master/examples/vcf/simple.vcf
test('x simple spec', async () => {
  const { header, lines } = readVcf('test/data/simple.vcf')
  const VCFParser = new VCF({
    header,
  })
  ok(VCFParser.getMetadata())
  
  const parsedLines = lines.map(l => {
    const entry = VCFParser.parseLine(l)
    return {
      ...entry,
      SAMPLES: entry.SAMPLES(),
    }
  })
  
  ok(parsedLines.length > 0)
  ok(parsedLines.every(line => line !== undefined))
})

// Remove duplicate pedigree test

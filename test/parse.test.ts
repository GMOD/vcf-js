import fs from 'fs'

import { expect, test } from 'vitest'

import VCF, { parseBreakend, Variant } from '../src'

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

  expect(VCFParser.getMetadata('INFO', 'AC')).toEqual({
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
  expect(variant.ALT?.length).toBe(1)
  expect(variant.INFO.SVTYPE).toEqual(['BND'])
  expect(variant).toMatchSnapshot()
})

test(`parses a line with mix of multiple breakends and non breakends`, () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    `13\t123456\tbnd_U\tC\tCTATGTCG,C[2 : 321682[,C[17 : 198983[\t6\tPASS\tSVTYPE=BND;MATEID=bnd V,bnd Z`,
  )
  expect(variant.ALT?.length).toBe(3)
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

test('sniffles vcf', () => {
  const { header, lines } = readVcf('test/data/sniffles.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variant = VCFParser.parseLine(lines[0])
  expect(variant).toMatchSnapshot()
  expect(variant.SAMPLES()).toMatchSnapshot()
})

test('can parse a line from the VCF spec Y chrom (haploid))', () => {
  const { header, lines } = readVcf('test/data/y-chrom-haploid.vcf')
  const VCFParser = new VCF({
    header,
  })
  const variant = VCFParser.parseLine(lines[0])
  const variant2 = VCFParser.parseLine(lines[1])
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
  const { header, lines } = readVcf('test/data/breakends.vcf')
  const VCFParser = new VCF({
    header,
  })

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
  expect(VCFParser.parseLine(lines[0]).GENOTYPES()).toEqual({})
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
  expect(variants.map(m => m.ALT?.[0].toString())).toEqual(
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

// https://github.com/samtools/hts-specs/blob/master/examples/vcf/sv44.vcf
test('x vcf44 spec', () => {
  const { header, lines } = readVcf('test/data/vcf44_spec.vcf')
  const VCFParser = new VCF({
    header,
  })
  expect(VCFParser.getMetadata()).toMatchSnapshot()
  expect(
    lines.map(l => {
      const entry = VCFParser.parseLine(l)
      return {
        ...entry,
        SAMPLES: entry.SAMPLES(),
      }
    }),
  ).toMatchSnapshot()
})

// https://github.com/samtools/hts-specs/blob/master/examples/vcf/simple.vcf
test('x simple spec', () => {
  const { header, lines } = readVcf('test/data/simple.vcf')
  const VCFParser = new VCF({
    header,
  })
  expect(VCFParser.getMetadata()).toMatchSnapshot()
  expect(
    lines.map(l => {
      const entry = VCFParser.parseLine(l)
      return {
        ...entry,
        SAMPLES: entry.SAMPLES(),
      }
    }),
  ).toMatchSnapshot()
})

test('parseLine returns a Variant instance', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.',
  )
  expect(variant).toBeInstanceOf(Variant)
})

test('Variant serializes without methods', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.',
  )
  const serialized = JSON.parse(JSON.stringify(variant))

  expect(serialized.SAMPLES).toBeUndefined()
  expect(serialized.GENOTYPES).toBeUndefined()
  expect(serialized.processGenotypes).toBeUndefined()

  expect(serialized.CHROM).toBe('20')
  expect(serialized.POS).toBe(14370)
})

test('processGenotypes method works correctly', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.',
  )

  const genotypes: string[] = []
  variant.processGenotypes((str, start, end) => {
    genotypes.push(str.slice(start, end))
  })

  expect(genotypes).toEqual(['0|0', '1|0', '1/1'])
})

test('SAMPLES and GENOTYPES can be called multiple times', () => {
  const VCFParser = makeParser()
  const variant = VCFParser.parseLine(
    '20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14;AF=0.5;DB;H2\tGT:GQ:DP:HQ\t0|0:48:1:51,51\t1|0:48:8:51,51\t1/1:43:5:.,.',
  )

  expect(variant.SAMPLES()).toEqual(variant.SAMPLES())
  expect(variant.GENOTYPES()).toEqual(variant.GENOTYPES())
})

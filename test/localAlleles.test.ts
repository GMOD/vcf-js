import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import VCF, {
  LocalAlleleGenotypeMaps,
  decodeLocalAlleles,
  genotypeCount,
  genotypeIndex,
  localAlleles,
  localGenotypeMap,
  localToGlobalA,
  localToGlobalG,
  localToGlobalR,
  ploidyForLocalGenotypes,
  readLocalAlleles,
} from '../src/index.ts'

const readVcf = (file: string) => {
  const f = readFileSync(file, 'utf8')
  const header = [] as string[]
  const lines = [] as string[]
  for (const line of f.split('\n')) {
    if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      lines.push(line)
    }
  }
  return { header: header.join('\n'), lines }
}

const parse = (file: string) => {
  const { header, lines } = readVcf(file)
  const parser = new VCF({ header })
  return lines.map(line => parser.parseLine(line))
}

test('genotype ordering matches the spec examples', () => {
  expect(genotypeCount(2, 2)).toBe(3)
  expect(genotypeCount(3, 2)).toBe(6)
  expect(genotypeCount(3, 3)).toBe(10)
  // "for P=2, the index of the genotype a/b, where a <= b, is b(b+1)/2 + a"
  expect(genotypeIndex([0, 0])).toBe(0)
  expect(genotypeIndex([0, 1])).toBe(1)
  expect(genotypeIndex([1, 1])).toBe(2)
  expect(genotypeIndex([0, 2])).toBe(3)
  expect(genotypeIndex([2, 4])).toBe(12)
  // "for P=3 and N=2, the ordering is 000, 001, 011, 111, 002, ..."
  expect(genotypeIndex([1, 1, 1])).toBe(3)
  expect(genotypeIndex([2, 2, 2])).toBe(9)
})

test('ploidy is read off the local value count, and is ambiguous for REF-only', () => {
  expect(ploidyForLocalGenotypes(3, 6)).toBe(2)
  expect(ploidyForLocalGenotypes(3, 3)).toBe(1)
  expect(ploidyForLocalGenotypes(3, 10)).toBe(3)
  expect(ploidyForLocalGenotypes(3, 7)).toBeUndefined()
  // one genotype at every ploidy, so LPL cannot say which
  expect(ploidyForLocalGenotypes(1, 1)).toBeUndefined()
})

test('readLocalAlleles prepends REF and allocates nothing per sample', () => {
  const out = new Int32Array(8)
  const read = (s: string) => {
    const n = readLocalAlleles(s, 0, s.length, out)
    return [...out.slice(0, n)]
  }
  expect(read('2,4')).toEqual([0, 2, 4])
  expect(read('3')).toEqual([0, 3])
  expect(read('12,7')).toEqual([0, 12, 7])
  // a MISSING LAA is the empty vector, i.e. a REF-only site
  expect(read('.')).toEqual([0])
  expect(read('')).toEqual([0])
  expect(readLocalAlleles('x', -1, -1, out)).toBe(1)
})

test('localAlleles prepends REF to a parsed LAA value', () => {
  expect(localAlleles([2, 4])).toEqual([0, 2, 4])
  expect(localAlleles(undefined)).toEqual([0])
  expect(localAlleles([undefined])).toEqual([0])
  // a file that never declared LAA hands back strings
  expect(localAlleles(['2', '4'])).toEqual([0, 2, 4])
})

test('the spec worked example round-trips', () => {
  // VCF 4.5 section 1.6.2: REF G, ALT A,C,T,<*>, LAA=[2,4]
  const alleles = [0, 2, 4]
  expect(localToGlobalR([20, 30, 10], alleles, 5)).toEqual([
    20,
    undefined,
    30,
    undefined,
    10,
  ])
  expect(localToGlobalG([90, 80, 0, 100, 110, 120], alleles, 5)).toEqual([
    90,
    undefined,
    undefined,
    80,
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    undefined,
    100,
    undefined,
    110,
    undefined,
    120,
  ])
})

test('LAA given out of order is honoured in its stated order', () => {
  // LAA=[4,2], so local allele 1 is global 4 and local allele 2 is global 2.
  // The cross term is local 1/2 = global {4,2}, which must be sorted to 2/4
  // before indexing: the spec's Index() formula is only defined for ascending
  // alleles. bcftools 1.24 applies it unsorted and lands on 1/3 instead.
  const alleles = [0, 4, 2]
  expect(localToGlobalR([5, 6, 7], alleles, 5)).toEqual([
    5,
    undefined,
    7,
    undefined,
    6,
  ])
  const pl = localToGlobalG([11, 22, 33, 44, 55, 66], alleles, 5)
  expect(pl[0]).toBe(11)
  expect(pl[10]).toBe(22)
  expect(pl[14]).toBe(33)
  expect(pl[3]).toBe(44)
  expect(pl[12]).toBe(55)
  expect(pl[5]).toBe(66)
})

test('Number=LA expands over ALT alone', () => {
  expect(localToGlobalA([7, 9], [0, 2, 4], 4)).toEqual([
    undefined,
    7,
    undefined,
    9,
  ])
})

test('a REF-only sample expands to the ploidy hint', () => {
  expect(localToGlobalR([30], [0], 5)).toEqual([
    30,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  expect(localToGlobalG([0], [0], 5)).toHaveLength(15)
  expect(localToGlobalG([0], [0], 5, 1)).toHaveLength(5)
  expect(localToGlobalG([0], [0], 5)[0]).toBe(0)
})

test('haploid local genotypes map straight through', () => {
  expect([...localGenotypeMap([0, 2, 4], 3, 1)]).toEqual([0, 2, 4])
})

test('missing local fields decode to all-missing', () => {
  expect(localToGlobalR(undefined, [0, 2], 5)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  expect(localToGlobalG(undefined, [0, 2], 5)).toHaveLength(15)
})

test('LocalAlleleGenotypeMaps returns the same map for a repeated LAA', () => {
  const maps = new LocalAlleleGenotypeMaps()
  const a = new Int32Array([0, 2, 4, 0, 0])
  const b = new Int32Array([0, 2, 4, 9, 9])
  const first = maps.get(a, 3, 2)
  expect(maps.get(b, 3, 2)).toBe(first)
  expect(maps.get(new Int32Array([0, 1, 4]), 3, 2)).not.toBe(first)
  // and back again, from the Map behind the single-entry memo
  expect(maps.get(a, 3, 2)).toBe(first)
  expect([...first]).toEqual([0, 3, 5, 10, 12, 14])
})

test('reserved 4.5 keys type local fields as numbers without a header line', () => {
  const parser = new VCF({
    header: [
      '##fileformat=VCFv4.5',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1',
    ].join('\n'),
  })
  const variant = parser.parseLine(
    '1\t100\t.\tG\tA,C,T,<*>\t.\t.\t.\tGT:LAA:LAD:LPL\t2/2:2,4:20,30,10:90,80,0,100,110,120',
  )
  const sample = variant.SAMPLES().S1!
  expect(sample.LAA).toEqual([2, 4])
  expect(sample.LAD).toEqual([20, 30, 10])
  expect(sample.LPL).toEqual([90, 80, 0, 100, 110, 120])
})

test('decodeLocalAlleles reports local fields under their non-local keys', () => {
  const variants = parse('test/data/local-alleles.vcf')
  const samples = variants[0]!.SAMPLES()
  const decoded = decodeLocalAlleles(samples.NA3!, 6)
  expect(decoded.AD).toEqual([
    2,
    undefined,
    undefined,
    9,
    undefined,
    undefined,
    undefined,
  ])
  expect(decoded.PL![6]).toBe(180)
  expect(decoded.PL![9]).toBe(150)
  // the local keys stay put alongside
  expect(decoded.LAD).toEqual([2, 9])
})

test('an existing global key wins over the local one it duplicates', () => {
  const decoded = decodeLocalAlleles(
    { LAA: [2], LAD: [1, 2], AD: [9, 9, 9] },
    2,
  )
  expect(decoded.AD).toEqual([9, 9, 9])
})

test('decodes the whole bcftools fixture to match its --LXX-to-XX expansion', () => {
  const local = parse('test/data/local-alleles.vcf')
  const expanded = parse('test/data/local-alleles.expanded.vcf')
  expect(local).toHaveLength(expanded.length)
  for (const [i, variant] of local.entries()) {
    const altCount = variant.ALT!.length
    const localSamples = variant.SAMPLES()
    const globalSamples = expanded[i]!.SAMPLES()
    for (const name of variant.sampleNames) {
      const decoded = decodeLocalAlleles(localSamples[name]!, altCount)
      const expected = globalSamples[name]!
      expect({ name, AD: decoded.AD }).toEqual({ name, AD: expected.AD })
      expect({ name, PL: decoded.PL }).toEqual({ name, PL: expected.PL })
    }
  }
})

test('the allocation-free path reads local depths under processFormatFields', () => {
  const variant = parse('test/data/local-alleles.vcf')[0]!
  const altCount = variant.ALT!.length
  // scratch sized once for the record and reused for every sample, the shape a
  // many-sample consumer wants
  const alleles = new Int32Array(altCount + 1)
  const refDepth = new Int32Array(variant.sampleNames.length)
  const altDepth = new Int32Array(variant.sampleNames.length * altCount)
  variant.processFormatFields(['LAA', 'LAD'], (str, ranges, sampleIdx) => {
    const count = readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
    let local = 0
    let value = 0
    let digits = 0
    for (let i = ranges[2]!; i <= ranges[3]!; i++) {
      const c = i === ranges[3]! ? 44 : str.charCodeAt(i)
      if (c === 44) {
        if (digits > 0 && local < count) {
          const global = alleles[local]!
          if (global === 0) {
            refDepth[sampleIdx] = value
          } else {
            altDepth[sampleIdx * altCount + global - 1] = value
          }
        }
        local++
        value = 0
        digits = 0
      } else {
        value = value * 10 + (c - 48)
        digits++
      }
    }
  })
  // same numbers the decoded path reports, without a per-sample allocation
  const samples = variant.SAMPLES()
  for (const [i, name] of variant.sampleNames.entries()) {
    const ad = decodeLocalAlleles(samples[name]!, altCount).AD!
    expect(refDepth[i]).toBe(ad[0])
    for (let a = 0; a < altCount; a++) {
      expect(altDepth[i * altCount + a]).toBe(ad[a + 1] ?? 0)
    }
  }
})

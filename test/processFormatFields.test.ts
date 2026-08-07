import { expect, test } from 'vitest'

import VCF from '../src/index.ts'

function makeParser(samples: string[]) {
  return new VCF({
    header:
      '##fileformat=VCFv4.2\n' +
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="gt">\n' +
      '##FORMAT=<ID=PS,Number=1,Type=Integer,Description="ps">\n' +
      '##FORMAT=<ID=DP,Number=1,Type=Integer,Description="dp">\n' +
      `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}\n`,
  })
}

// Collect (key -> string | undefined) per sample, so the tests read as the
// fields they are rather than as offsets.
function collect(line: string, samples: string[], keys: string[]) {
  const variant = makeParser(samples).parseLine(line)
  const out: Record<string, string | undefined>[] = []
  variant.processFormatFields(keys, (str, ranges, idx) => {
    const rec: Record<string, string | undefined> = {}
    for (let k = 0; k < keys.length; k++) {
      const s = ranges[k * 2]!
      const e = ranges[k * 2 + 1]!
      rec[keys[k]!] = s === -1 ? undefined : str.slice(s, e)
    }
    out[idx] = rec
  })
  return out
}

test('reads two fields out of the middle of FORMAT', () => {
  expect(
    collect(
      '1\t100\t.\tA\tG\t.\t.\t.\tGT:DP:PS\t0|1:30:12345\t1|1:9:12345',
      ['S1', 'S2'],
      ['GT', 'PS'],
    ),
  ).toEqual([
    { GT: '0|1', PS: '12345' },
    { GT: '1|1', PS: '12345' },
  ])
})

test('a key FORMAT does not declare comes back undefined', () => {
  expect(
    collect('1\t100\t.\tA\tG\t.\t.\t.\tGT:DP\t0|1:30', ['S1'], ['GT', 'PS']),
  ).toEqual([{ GT: '0|1', PS: undefined }])
})

test('reports every sample when FORMAT declares no requested key at all', () => {
  // Nothing to report, so nothing is reported — same contract processGenotypes
  // has for a GT-less record.
  expect(
    collect('1\t100\t.\tA\tG\t.\t.\t.\tDP\t30\t9', ['S1', 'S2'], ['GT', 'PS']),
  ).toEqual([])
})

test('a sample whose fields stop early still gets its callback', () => {
  // sampleIdx has to keep tracking the callback count, so a short sample
  // reports the fields it has and -1 for the rest rather than being skipped.
  expect(
    collect(
      '1\t100\t.\tA\tG\t.\t.\t.\tGT:DP:PS\t0|1\t1|1:9:12345',
      ['S1', 'S2'],
      ['GT', 'PS'],
    ),
  ).toEqual([
    { GT: '0|1', PS: undefined },
    { GT: '1|1', PS: '12345' },
  ])
})

test('the last FORMAT column has no trailing colon', () => {
  expect(
    collect('1\t100\t.\tA\tG\t.\t.\t.\tDP:GT\t30:0|1', ['S1'], ['GT']),
  ).toEqual([{ GT: '0|1' }])
})

test('matches a key exactly, not as a substring', () => {
  // GATK writes PGT alongside GT; a substring match would read the wrong column
  expect(
    collect(
      '1\t100\t.\tA\tG\t.\t.\t.\tPGT:GT:PID\t0|1:1|1:foo',
      ['S1'],
      ['GT'],
    ),
  ).toEqual([{ GT: '1|1' }])
})

test('one key repeated in the request reports the same column twice', () => {
  expect(
    collect('1\t100\t.\tA\tG\t.\t.\t.\tGT:DP\t0|1:30', ['S1'], ['GT', 'GT']),
  ).toEqual([{ GT: '0|1' }])
})

test('agrees with processGenotypes on GT', () => {
  const line = '1\t100\t.\tA\tG\t.\t.\t.\tDP:GT:PS\t30:0|1:5\t9:.|.:5\t12:1/1:5'
  const samples = ['S1', 'S2', 'S3']
  const variant = makeParser(samples).parseLine(line)
  const viaGenotypes: string[] = []
  variant.processGenotypes((str, start, end, idx) => {
    viaGenotypes[idx] = str.slice(start, end)
  })
  expect(collect(line, samples, ['GT']).map(r => r.GT)).toEqual(viaGenotypes)
})

test('no keys requested does nothing', () => {
  expect(collect('1\t100\t.\tA\tG\t.\t.\t.\tGT\t0|1', ['S1'], [])).toEqual([])
})

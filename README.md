# vcf-js

VCF (variant call format) parser

[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/vcf)
![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/vcf-js/publish.yml?branch=main)

## Install

```sh
npm install @gmod/vcf
```

## Usage

```typescript
import { TabixIndexedFile } from '@gmod/tabix'
import VCF, { type Variant } from '@gmod/vcf'

const tbiIndexed = new TabixIndexedFile({ path: '/path/to/my.vcf.gz' })

const headerText = await tbiIndexed.getHeader()
const parser = new VCF({ header: headerText })

const variants: Variant[] = []
await tbiIndexed.getLines('ctgA', 200, 300, line => {
  variants.push(parser.parseLine(line))
})
```

Reuse one parser for all lines — the header is parsed once per `VCF`.

`strict` (default `true`) makes `parseLine` throw on a line with no INFO column;
the VCF spec requires at least a `.` there.

## Variant

`parseLine(line)` returns a `Variant`:

```typescript
{
  CHROM: 'contigA',
  POS: 3000,
  ID: ['rs17883296'],  // undefined if '.'
  REF: 'G',
  ALT: ['T', 'A'],     // undefined if '.'
  QUAL: 100,           // undefined if '.'
  FILTER: 'PASS',      // 'PASS' | string[] of filter names | undefined if '.'
  FORMAT: 'GT:DP',     // undefined if the file has no samples
  INFO: {
    NS: [3],
    DP: [14],
    AF: [0.5],
    DB: true,   // Type=Flag, a bare key, or KEY= with an empty value
    XYZ: ['5'], // unknown fields default to Number=1, Type=String
  },
}
```

INFO and FORMAT values are typed using header metadata. Values are arrays unless
`Type=Flag`, in which case they are `true`. Fields defined in the
[VCF spec](https://samtools.github.io/hts-specs/VCFv4.3.pdf) are typed even
without a header entry. `.` inside a value becomes `undefined`, and `%XX`
escapes are percent-decoded.

`JSON.stringify(variant)` serializes the columns above only — sample data is not
included.

### Sample methods

Sample data is not touched until one of these is called, so lines from a
many-sample file are cheap to parse if you only need the columns above.

- `variant.SAMPLES()` — all FORMAT fields, keyed by sample name
- `variant.GENOTYPES()` — GT strings only, keyed by sample name
- `variant.processGenotypes(callback)` — GT positions only, no allocation

```typescript
let homRef = 0
variant.processGenotypes((str, start, end, sampleIdx) => {
  if (
    end - start === 3 && // e.g. "0|0"
    str.charCodeAt(start) === 48 && // 48 = '0'
    str.charCodeAt(start + 2) === 48
  ) {
    homRef++
  }
})
```

## Performance

For files with many samples:

| method               | allocates per sample                    |
| -------------------- | --------------------------------------- |
| `processGenotypes()` | nothing — indices into the line         |
| `GENOTYPES()`        | one string                              |
| `SAMPLES()`          | one object plus an array per FORMAT key |

- `SAMPLES()` re-parses on every call. Call it once and keep the result.
- `processGenotypes` ignores the callback's return value, so there is no early
  exit — it always visits every sample.
- `GENOTYPES()` returns a null-prototype object; use `Object.keys` / `in`, not
  `hasOwnProperty`.
- INFO is parsed eagerly for every line, unlike sample data. Files with large
  INFO columns pay that cost even if you only read `CHROM`/`POS`.
- A retained `Variant` holds a reference to its whole input line. Streaming is
  fine, but collecting variants from a many-sample file keeps every line in
  memory.

## Metadata

`parser.getMetadata(...keys)` returns header metadata, filtered by the keys
provided:

```typescript
parser.getMetadata('INFO', 'DP')
// { Number: 1, Type: 'Integer', Description: 'combined depth across samples' }

parser.getMetadata('INFO', 'DP', 'Number')
// 1
```

Call with no arguments to get all metadata. `parser.samples` lists sample names.

## Streaming

Without tabix, collect header lines until the first non-header line, then
construct the parser:

```typescript
import fs from 'node:fs'
import readline from 'node:readline'
import VCF from '@gmod/vcf'

const rl = readline.createInterface({
  input: fs.createReadStream('file.vcf'),
})

const header: string[] = []
let parser: VCF | undefined

for await (const line of rl) {
  if (line.startsWith('#')) {
    header.push(line)
  } else {
    parser ??= new VCF({ header: header.join('\n') })
    const variant = parser.parseLine(line)
    console.log(variant.CHROM, variant.POS)
  }
}
```

For `.vcf.gz`, pipe the read stream through `createGunzip()` from `node:zlib`.

## Breakends

`parseBreakend(alt)` parses a breakend ALT string, returning `undefined` for
anything that isn't one:

```typescript
import { parseBreakend } from '@gmod/vcf'

parseBreakend('C[2:321682[')
// { MateDirection: 'right', Replacement: 'C', MatePosition: '2:321682', Join: 'right' }
```

All four bracket forms from the VCF spec:

| ALT form | Join  | MateDirection |
| -------- | ----- | ------------- |
| `t[p[`   | right | right         |
| `t]p]`   | right | left          |
| `[p[t`   | left  | right         |
| `]p]t`   | left  | left          |

- `Join` — whether the replacement base appears before (`right`) or after
  (`left`) the mate position
- `MateDirection` — `[` means the mate sequence extends rightward; `]` means
  leftward

### Single breakends

When the ALT starts or ends with `.`, the result has `SingleBreakend: true` and
no `MatePosition`:

```typescript
parseBreakend('C.')
// { Join: 'right', Replacement: 'C', SingleBreakend: true }

parseBreakend('.ACGT')
// { Join: 'left', Replacement: 'ACGT', SingleBreakend: true }
```

### Symbolic alleles

An ALT containing `<...>` uses the symbol as the mate contig:

```typescript
parseBreakend('<DUP>ACGT')
// { Join: 'left', Replacement: 'ACGT', MateDirection: 'right', MatePosition: '<DUP>:1' }

parseBreakend('ACGT<DUP>')
// { Join: 'right', Replacement: 'ACGT', MateDirection: 'right', MatePosition: '<DUP>:1' }
```

## Exports

`default` (the parser), `Variant`, `parseBreakend`, and the types `Breakend`,
`Samples`, `SampleData`, `SampleValue`, `InfoValue`, `MetaMap`, `MetaField`,
`GenotypeCallback`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

# vcf-js

VCF (variant call format) parser

[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/vcf)
[![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/vcf-js/publish.yml?branch=main&style=flat-square)](https://github.com/GMOD/vcf-js/actions/workflows/publish.yml)

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

Reuse one parser for all lines — the header is parsed once per `VCF`. Pass
`strict: false` to accept a line with no INFO column; by default `parseLine`
throws on one, since the spec requires at least a `.` there.

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
  FORMAT: 'GT:DP',     // undefined if the line has no sample columns
  INFO: { NS: [3], DP: [14], AF: [0.5], DB: true },
}
```

INFO and FORMAT values are typed using header metadata — see
[docs/api.md](docs/api.md) for the rules, and for `parser.getMetadata`.

### Sample methods

Sample data is not touched until one of these is called, so lines from a
many-sample file are cheap to parse if you only need the columns above.

- `variant.SAMPLES()` — all FORMAT fields, keyed by sample name
- `variant.GENOTYPES()` — GT strings only, keyed by sample name
- `variant.processGenotypes(callback)` — GT positions only, no allocation
- `variant.processFormatFields(keys, callback)` — positions of the named FORMAT
  fields, no allocation

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

| method                  | allocates per sample                    |
| ----------------------- | --------------------------------------- |
| `processGenotypes()`    | nothing — indices into the line         |
| `processFormatFields()` | nothing — indices into the line         |
| `GENOTYPES()`           | one string                              |
| `SAMPLES()`             | one object plus an array per FORMAT key |

- Reading a couple of fields through `SAMPLES()` still parses every field of
  every sample. On a 2504-sample `GT:AD:DP:GQ:PL` set that measured 1985ms and
  2095MB, against 180ms and 1MB for the same two fields via
  `processFormatFields`.
- `SAMPLES()` re-parses on every call. Call it once and keep the result.
- Both `process*` methods ignore the callback's return value, so there is no
  early exit — they always visit every sample.
- Key off the callback's `sampleIdx` rather than counting calls.
- INFO is parsed eagerly for every line, unlike sample data. Files with large
  INFO columns pay that cost even if you only read `CHROM`/`POS`.
- A retained `Variant` holds a reference to its whole input line. Streaming is
  fine, but collecting variants from a many-sample file keeps every line in
  memory.

[docs/optimizations.md](docs/optimizations.md) explains why each of those is the
way it is, and what a consumer has to do to keep the wins.

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

All four bracket forms from the spec, plus single breakends and symbolic alleles
— [docs/api.md](docs/api.md#parsebreakendalt-breakend--undefined) has the table
and the edge cases.

## Docs

- [docs/api.md](docs/api.md) — every constructor arg, method and type
- [docs/optimizations.md](docs/optimizations.md) — why the parser is lazy about
  sample data, what that measured, and what a consumer has to do
- [CONTRIBUTING.md](CONTRIBUTING.md) — development, benchmarking and release
  steps

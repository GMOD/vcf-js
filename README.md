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

Reuse one parser for all lines — each `VCF` parses its header once. Pass
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

The parser types the INFO and FORMAT values from the header metadata. See
[docs/api.md](docs/api.md) for the rules, and for `parser.getMetadata`.

### Sample methods

The parser leaves sample data unparsed until you call one of these.

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

## Local alleles

VCF 4.5 records can give a sample's FORMAT values against a subset of the site's
alleles (`LAA` plus `LAD`, `LPL`, and friends). `SAMPLES()` also reports those
under their non-local keys, as the spec requires:

```typescript
const sample = variant.SAMPLES().NA00001!
sample.AD // from the record's AD, or expanded from its LAD
sample.PL // from the record's PL, or expanded from its LPL
```

For a whole-file pass, skip the expansion and use the allocation-free
`readLocalAlleles`. See [docs/local-alleles.md](docs/local-alleles.md).

## Performance

On a many-sample file, the choice of sample method outweighs every other parsing
cost; see [docs/optimizations.md](docs/optimizations.md). Three rules that are
easy to get wrong:

- Both `process*` methods ignore the callback's return value, so they cannot
  stop early and always visit every sample.
- Key off the callback's `sampleIdx`, not a running count. A sample whose fields
  stop short still gets a callback.
- `SAMPLES()` re-parses on every call, so call it once and keep the result.

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

`parseBreakend` handles all four bracket forms, single breakends and symbolic
[docs/api.md](docs/api.md#parsebreakendalt-breakend--undefined).

## Docs

- [docs/api.md](docs/api.md) — every constructor arg, method and type
- [docs/optimizations.md](docs/optimizations.md) — sample-data performance
- [docs/local-alleles.md](docs/local-alleles.md) — VCF 4.5 local alleles
- [CONTRIBUTING.md](CONTRIBUTING.md) — development, benchmarking and release

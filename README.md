# vcf-js

VCF (variant call format) parser

[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/vcf)
[![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/vcf-js/push.yml?branch=main)](https://github.com/GMOD/vcf-js/actions)

## Usage

```typescript
import { TabixIndexedFile } from '@gmod/tabix'
import VCF from '@gmod/vcf'

const tbiIndexed = new TabixIndexedFile({ path: '/path/to/my.vcf.gz' })

const headerText = await tbiIndexed.getHeader()
const parser = new VCF({ header: headerText }) // strict?: boolean (default true)

const variants = []
await tbiIndexed.getLines('ctgA', 200, 300, line =>
  variants.push(parser.parseLine(line)),
)
```

## Variant

`parseLine(line)` returns a `Variant` with these fields:

```typescript
{
  CHROM: 'contigA',
  POS: 3000,
  ID: ['rs17883296'],
  REF: 'G',
  ALT: ['T', 'A'],
  QUAL: 100,
  FILTER: 'PASS', // 'PASS' | string[] of filter names | undefined if '.'
  INFO: {
    NS: [3],
    DP: [14],
    AF: [0.5],
    DB: true,   // Flag type
    XYZ: ['5'], // unknown fields default to Number=1, Type=String
  },
}
```

INFO and FORMAT values are typed using header metadata. Values are arrays unless
`Type=Flag`, in which case they are `true`. Fields defined in the
[VCF spec](https://samtools.github.io/hts-specs/VCFv4.3.pdf) are typed even
without a header entry.

### Sample methods

- `variant.SAMPLES()` — full sample data with all FORMAT fields parsed
- `variant.GENOTYPES()` — GT strings only (faster)
- `variant.processGenotypes(callback)` — iterate genotypes without allocating
  strings (fastest)

```typescript
let homRef = 0
variant.processGenotypes((str, start, end) => {
  if (
    end - start === 3 && // e.g. "0|0"
    str.charCodeAt(start) === 48 && // 48 = '0'
    str.charCodeAt(start + 2) === 48
  ) {
    homRef++
  }
})
```

Sample data is lazily parsed — nothing is computed until these methods are
called.

## Metadata

`parser.getMetadata(...keys)` returns header metadata, filtered by the keys
provided:

```typescript
parser.getMetadata('INFO', 'DP')
// { Number: 1, Type: 'Integer', Description: 'Total Depth' }

parser.getMetadata('INFO', 'DP', 'Number')
// 1
```

Call with no arguments to get all metadata. `parser.samples` lists sample names.

## Streaming

To parse a plain VCF without tabix, collect header lines until the first
non-header line, then construct the parser:

```typescript
import fs from 'fs'
import VCF from '@gmod/vcf'
import { createGunzip } from 'zlib'
import readline from 'readline'

const rl = readline.createInterface({
  input: fs.createReadStream('file.vcf.gz').pipe(createGunzip()),
})

const header = []
let parser

rl.on('line', line => {
  if (line.startsWith('#')) {
    header.push(line)
  } else {
    if (!parser) {
      parser = new VCF({ header: header.join('\n') })
    }
    const variant = parser.parseLine(line)
    console.log(variant.CHROM, variant.POS)
  }
})
```

## Breakends

`parseBreakend(alt)` parses a breakend ALT string:

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

When the ALT starts or ends with `.`, `parseBreakend` returns
`SingleBreakend: true` with no `MatePosition`:

```typescript
parseBreakend('C.')
// { Join: 'right', Replacement: 'C', SingleBreakend: true }

parseBreakend('.ACGT')
// { Join: 'left', Replacement: 'ACGT', SingleBreakend: true }
```

## Publishing

[Trusted publishing](https://docs.npmjs.com/about-trusted-publishing) via GitHub Actions.

```bash
npm version patch  # or minor/major
```

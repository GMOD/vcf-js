# vcf-js

High performance Variant Call Format (VCF) parser in pure JavaScript.

## Status

[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/vcf)
[![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/vcf-js/push.yml?branch=main)](https://github.com/GMOD/vcf-js/actions)

## Usage

This module is best used when combined with some easy way of retrieving the
header and individual lines from a VCF, like the `@gmod/tabix` module.

```typescript
import { TabixIndexedFile } from '@gmod/tabix'
import VCF, { parseBreakend, Variant } from '@gmod/vcf'

const tbiIndexed = new TabixIndexedFile({ path: '/path/to/my.vcf.gz' })

async function doStuff() {
  const headerText = await tbiIndexed.getHeader()
  const tbiVCFParser = new VCF({ header: headerText })
  const variants = []
  await tbiIndexed.getLines('ctgA', 200, 300, line =>
    variants.push(tbiVCFParser.parseLine(line)),
  )
  console.log(variants)
}
```

If you want to stream a VCF file, you can alternatively use something like this

```typescript
import fs from 'fs'
import VCF from '@gmod/vcf'
import { createGunzip } from 'zlib'
import readline from 'readline'

const rl = readline.createInterface({
  input: fs.createReadStream(process.argv[2]).pipe(createGunzip()),
})

const header = []
const elts = []
let parser

rl.on('line', function (line) {
  if (line.startsWith('#')) {
    header.push(line)
    return
  }
  if (!parser) {
    parser = new VCF({ header: header.join('\n') })
  }
  const elt = parser.parseLine(line)
  elts.push(elt.INFO.NS[0]) // NS is defined in the VCF spec as an integer
})

rl.on('close', function () {
  console.log(elts.reduce((a, b) => a + b, 0) / elts.length)
})
```

This streaming approach is used to benchmark @gmod/vcf in https://github.com/brentp/vcf-bench

## Methods

Given a VCF with a single variant line

```text
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	HG00096
contigA	3000	rs17883296	G	T,A	100	PASS	NS=3;DP=14;AF=0.5;DB;XYZ=5	GT:AP	0|0:0.000,0.000
```

The `Variant` object returned by `parseLine()` has these properties:

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
    DB: true,
    XYZ: ['5'],
  },
}
```

The `Variant` class also has methods for accessing sample data:

- `variant.SAMPLES()` - returns full sample data with all FORMAT fields parsed
- `variant.GENOTYPES()` - returns just the GT strings (faster if that's all you
  need)
- `variant.processGenotypes(callback)` - calls a callback for each genotype
  without allocating strings (fastest for counting/iteration)

These methods lazily parse the genotype data, so they only do work when called.
This saves time especially if your VCF has many samples (e.g. 1000 Genomes).

The parser will try to convert the values in INFO and FORMAT to the proper types
using the header metadata. For example, if there is a header line like

```text
##INFO=<ID=ABC,Number=2,Type=Integer,Description="A description">
```

The parser will expect any INFO entry ABC to be an array of two integers, so it
would convert `ABC=12,20` to `{ ABC: [12, 20] }`.

Each INFO entry value will be an array unless `Type=Flag` is specified, in which
case it will be `true`. If no metadata can be found for the entry, it will
assume `Number=1` and `Type=String`.

Some fields are pre-defined by the
[VCF spec](https://samtools.github.io/hts-specs/VCFv4.3.pdf), which is why in
the variant object above "DP" was parsed as an integer (it is defined in the VCF
spec), but "XYZ" was left as a string (it is not defined in either the VCF spec
or the header).

Metadata can be accessed with the `getMetadata()` method, including all the
built-in metadata from the VCF spec. With no parameters it will return all the
data. Any parameters passed will further filter the metadata. For example, for a
VCF with this header:

```text
##INFO=<ID=ABC,Number=2,Type=Integer,Description="A description">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
```

you can access the VCF's header metadata like (some output omitted for clarity):

```typescript
> console.log(vcfParser.getMetadata())
{
  INFO: {
    AA: { Number: 1, Type: 'String', Description: 'Ancestral Allele' },
    ...
    ABC: { Number: 2, Type: 'Integer', Description: 'A description' }
  },
  FORMAT: {
    AD: { Number: 'R', Type: 'Integer', Description: 'Read depth for each allele' },
    ...
  },
  ALT: {
    DEL: { Description: 'Deletion relative to the reference' },
    ...
  },
  FILTER: { PASS: { Description: 'Passed all filters' } }
}

> console.log(vcfParser.getMetadata('INFO'))
{
  AA: { Number: 1, Type: 'String', Description: 'Ancestral Allele' },
  AC: { Number: 'A', Type: 'Integer', Description: 'Allele count in genotypes, for each ALT allele, in the same order as listed' },
  AD: { Number: 'R', Type: 'Integer', Description: 'Total read depth for each allele' },
  ...
  ABC: { Number: 2, Type: 'Integer', Description: 'A description' }
}

> console.log(vcfParser.getMetadata('INFO', 'DP'))
{ Number: 1, Type: 'Integer', Description: 'Total Depth' }

> console.log(vcfParser.getMetadata('INFO', 'DP', 'Number'))
1
```

A list of sample names is also available in the `samples` attribute of the
parser object:

```typescript
> console.log(vcfParser.samples)
[ 'HG00096' ]
```

## Breakends

We offer a helper function to parse breakend strings (previously parsed
automatically).

```typescript
import { parseBreakend } from '@gmod/vcf'
parseBreakend('C[2:321682[')

// output
//
//     {
//       "MateDirection": "right",
//       "Replacement": "C",
//       "MatePosition": "2:321682",
//       "Join": "right"
//     }
```

- `Join: "right"` — the replacement base C appears before the mate position in
  the ALT string, so the mate joins to the right
- `MateDirection: "right"` — `[` brackets mean the mate sequence extends
  rightward from the mate position; `]` brackets mean it extends leftward

All four bracket forms from the VCF spec:

| ALT form | Join  | MateDirection |
|----------|-------|---------------|
| `t[p[`   | right | right         |
| `t]p]`   | right | left          |
| `[p[t`   | left  | right         |
| `]p]t`   | left  | left          |

The two brackets in a single ALT always match (`[[` or `]]`).

For the above vcf line where chr13:123456->C\[2:321682\[ then we have this

        chr13:123456
      -------------C\
                     \
                      \
                       \
                        \
                         \
                          \
                           \
                            \--------------
                             chr2:321682

If the alt was instead chr13:123456->\[2:321682\[C then the "Join" would be
"left" since the "BND" is before "C" and then the breakend structure looks like
this

          chr13:123456

          |C--------------------
          |
          |
          |
          |
          |
          |
          |
          |
          |
          |
          ----------------------
           chr2:321682

### Single breakends

When the ALT starts or ends with `.` (no mate position), `parseBreakend`
returns a result with `SingleBreakend: true` and no `MatePosition`:

```typescript
parseBreakend('C.')
// { Join: 'right', Replacement: 'C', SingleBreakend: true }

parseBreakend('.ACGT')
// { Join: 'left', Replacement: 'ACGT', SingleBreakend: true }
```

## API

#### Table of Contents

- [VCFParser](#vcfparser)
  - [Parameters](#parameters)
  - [getMetadata](#getmetadata)
  - [parseLine](#parseline)
- [Variant](#variant)
  - [SAMPLES](#samples)
  - [GENOTYPES](#genotypes)
  - [processGenotypes](#processgenotypes)

### VCFParser

Class representing a VCF parser, instantiated with the VCF header.

#### Parameters

- `args.header` **string** - The VCF header. Supports both LF and CRLF newlines.
- `args.strict` **boolean** - Whether to parse in strict mode or not (default
  true). In strict mode an error is thrown if the INFO field is missing.

#### getMetadata

Get metadata filtered by the elements in args. For example, can pass ('INFO',
'DP') to only get info on a metadata tag that was like "##INFO=\<ID=DP,...>"

##### Parameters

- `...args` **string[]** - List of metadata filter strings.

Returns **object | string | number | undefined** depending on the filtering

#### parseLine

Parse a VCF line into a `Variant` object.

##### Parameters

- `line` **string** - A string of a line from a VCF

Returns **Variant** A Variant instance with the parsed data

### Variant

Class representing a parsed VCF variant line. Has data properties (CHROM, POS,
ID, REF, ALT, QUAL, FILTER, INFO, FORMAT) and methods for accessing sample data.

#### SAMPLES

Returns full sample data with all FORMAT fields parsed.

Returns **Record\<string, Record\<string, (string | number | undefined)[] |
undefined>>**

#### GENOTYPES

Returns just the GT strings for each sample (faster than SAMPLES if you only
need genotypes).

Returns **Record\<string, string>**

#### processGenotypes

Calls a callback for each genotype without allocating strings. Useful for
counting or iterating over genotypes with minimal memory allocation.

##### Parameters

- `callback` **(str: string, start: number, end: number) => unknown** - Called
  for each genotype with the raw string and indices.

```typescript
// count diploid homozygous ref (0|0 or 0/0) without allocating strings
let homRef = 0
variant.processGenotypes((str, start, end) => {
  if (
    end - start === 3 &&
    str.charCodeAt(start) === 48 &&
    str.charCodeAt(start + 2) === 48
  ) {
    homRef++
  }
})
```

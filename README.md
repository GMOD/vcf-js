# vcf-js

High performance Variant Call Format (VCF) parser in pure JavaScript.

## Status

[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/vcf)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/vcf-js/master.svg?style=flat-square)](https://codecov.io/gh/GMOD/vcf-js/branch/master)
[![Build Status](https://img.shields.io/github/workflow/status/GMOD/vcf-js/Push/master?logo=github&style=flat-query)](https://github.com/GMOD/vcf-js/actions?query=branch%3Amaster+workflow%3APush+)

## Usage

This module is best used when combined with some easy way of retrieving the
header and individual lines from a VCF, like the `@gmod/tabix` module.

```javascript
import { TabixIndexedFile } from '@gmod/tabix'

// with import
import VCF, { parseBreakend } from '@gmod/vcf'

// with require
const { default: VCF, parseBreakend } = require('@gmod/vcf')

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

```javascript
const fs = require('fs')
const VCF = require('@gmod/vcf').default
const { createGunzip } = require('zlib')
const readline = require('readline')

const rl = readline.createInterface({
  input: fs.createReadStream(process.argv[2]).pipe(createGunzip()),
})

let header = []
let elts = []
let parser = undefined

rl.on('line', function (line) {
  if (line.startsWith('#')) {
    header.push(line)
    return
  } else if (!parser) {
    parser = new VCF({ header: header.join('\n') })
  }
  const elt = parser.parseLine(line)
  elts.push(elt.INFO.AN[0])
})

rl.on('close', function () {
  console.log(elts.reduce((a, b) => a + b, 0) / elts.length)
})
```

This method is used to test @gmod/vcf in https://github.com/brentp/vcf-bench

## Methods


Given a VCF with a single variant line

```text
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	HG00096
contigA	3000	rs17883296	G	T,A	100	PASS	NS=3;DP=14;AF=0.5;DB;XYZ=5	GT:AP	0|0:0.000,0.000
```

The `variant` object returned by `parseLine()` would be

```javascript
{
  CHROM: 'contigA',
  POS: 3000,
  ID: ['rs17883296'],
  REF: 'G',
  ALT: ['T', 'A'],
  QUAL: 100,
  FILTER: 'PASS',
  INFO: {
    NS: [3],
    DP: [14],
    AF: [0.5],
    DB: true,
    XYZ: ['5'],
  },
}
```

The `variant` object will also have a lazy attribute called "`SAMPLES`" that
will not be evaluated unless it is called. This can save time if you only want
the variant information and not the sample-specific information, especially if
your VCF has a lot of samples in it. In the above case the `variant.SAMPLES`
object would look like

```javascript
{
  HG00096: {
    GT: ['0|0'],
    AP: ['0.000', '0.000'],
  },
}
```

The parser will try to convert the values in INFO and FORMAT to the proper types
using the header metadata. For example, if there is a header line like

```text
##INFO=<ID=ABC,Number=2,Type=Integer,Description="A description">
```

the parser will expect any INFO entry ABC to be an array of two integers, so it
would convert `ABC=12,20` to `{ ABC: [12, 20] }`. Each INFO entry value will be
an array unless `Type=Flag` is specified, in which case it will be `true`. If no
metadata can be found for the entry, it will assume `Number=1` and
`Type=String`.

_NOTE: the vcf specification allows percent-encoded characters. this library
does not decode them, an end-use library can call url-decode methods_

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

```javascript
> console.log(vcfParser.getMetadata())
{ INFO:
   { AA:
      { Number: 1, Type: 'String', Description: 'Ancestral Allele' },

...

     ABC: { Number: 2, Type: 'Integer', Description: 'A description' } },
  FORMAT:
   { AD:
      { Number: 'R',
        Type: 'Integer',
        Description: 'Read depth for each allele' },

...

  ALT:
   { DEL: { Description: 'Deletion relative to the reference' },

...

  FILTER: { PASS: { Description: 'Passed all filters' } } }

> console.log(vcfParser.getMetadata('INFO'))
{ AA:
   { Number: 1, Type: 'String', Description: 'Ancestral Allele' },
  AC:
   { Number: 'A',
     Type: 'Integer',
     Description:
      'Allele count in genotypes, for each ALT allele, in the same order as listed' },
  AD:
   { Number: 'R',
     Type: 'Integer',
     Description: 'Total read depth for each allele' },

...

  ABC: { Number: 2, Type: 'Integer', Description: 'A description' } }

> console.log(vcfParser.getMetadata('INFO', 'DP'))
{ Number: 1, Type: 'Integer', Description: 'Total Depth' }

> console.log(vcfParser.getMetadata('INFO', 'DP', 'Number'))
1
```

A list of sample names is also available in the `samples` attribute of the parser object:

```javascript
> console.log(vcfParser.samples)
[ 'HG00096' ]
```

## Breakends

We offer a helper function to parse breakend strings. We used to parse these
automatically but it is now a helper function

```js
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

- The C\[2:321682\[ parses as "Join": "right" because the BND is after the C
  base
- The C\[2:321682\[ also is given "MateDirection": "right" because the square
  brackets point to the right.
- The spec never has the square brackets pointing in different directions.
  Instead, the different types of joins can be imagined as follows

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

If the alt was instead chr13:123456->\[2:321682\[C then the the "Join" would be
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

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

- [VCF](#vcf)
  - [Parameters](#parameters)
  - [\_parseMetadata](#_parsemetadata)
    - [Parameters](#parameters-1)
  - [\_parseStructuredMetaVal](#_parsestructuredmetaval)
    - [Parameters](#parameters-2)
  - [getMetadata](#getmetadata)
    - [Parameters](#parameters-3)
  - [\_parseKeyValue](#_parsekeyvalue)
    - [Parameters](#parameters-4)
  - [parseLine](#parseline)
    - [Parameters](#parameters-5)

### VCF

Class representing a VCF parser, instantiated with the VCF header.

#### Parameters

- `args` **[object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)**

  - `args.header` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The VCF header. Supports both LF and CRLF
    newlines. (optional, default `''`)
  - `args.strict` **[boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Whether to parse in strict mode or not (default true) (optional, default `true`)

#### \_parseMetadata

Parse a VCF metadata line (i.e. a line that starts with "##") and add its
properties to the object.

##### Parameters

- `line` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** A line from the VCF. Supports both LF and CRLF
  newlines.

#### \_parseStructuredMetaVal

Parse a VCF header structured meta string (i.e. a meta value that starts
with "\<ID=...")

##### Parameters

- `metaVal` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The VCF metadata value

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)** Array with two entries, 1) a string of the metadata ID
and 2) an object with the other key-value pairs in the metadata

#### getMetadata

Get metadata filtered by the elements in args. For example, can pass
('INFO', 'DP') to only get info on an metadata tag that was like
"##INFO=\<ID=DP,...>"

##### Parameters

- `args` **...[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** List of metadata filter strings.

Returns **any** An object, string, or number, depending on the filtering

#### \_parseKeyValue

Sometimes VCFs have key-value strings that allow the separator within
the value if it's in quotes, like:
'ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129"'

Parse this at a low level since we can't just split at "," (or whatever
separator). Above line would be parsed to:
{ID: 'DB', Number: '0', Type: 'Flag', Description: 'dbSNP membership, build 129'}

##### Parameters

- `str` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** Key-value pairs in a string
- `pairSeparator` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** A string that separates sets of key-value
  pairs (optional, default `';'`)

Returns **[object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** An object containing the key-value pairs

#### parseLine

Parse a VCF line into an object like { CHROM POS ID REF ALT QUAL FILTER
INFO } with SAMPLES optionally included if present in the VCF

##### Parameters

- `line` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** A string of a line from a VCF. Supports both LF and
  CRLF newlines.

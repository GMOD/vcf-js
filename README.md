# vcf-js

High performance streaming VCF parser in pure JavaScript

## Status

[![Build Status](https://img.shields.io/travis/com/GMOD/vcf-js/master.svg?logo=travis&style=flat-square)](https://travis-ci.com/GMOD/vcf-js)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/vcf-js/master.svg?style=flat-square)](https://codecov.io/gh/GMOD/vcf-js/branch/master)
[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/cram)

## Usage

```javascript
const { TabixIndexedFile } = require('@gmod/tabix')
const { VCF } = require('@gmod/vcf')

const tbiIndexed = new TabixIndexedFile({ path: 'path/to/my/file.gz' })
const headerText = tbiIndexed.getHeader()
const tbiVCFParser = new VCF({ header: headerText })
const variants = []
tbiIndexed.getLines('ctgA', 200, 300, line =>
  variants.push(tbiVCFParser.parseLine(line)),
)
```

Given a VCF with a single variant line

```text
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	HG00096
contigA	3000	rs17883296	G	T,A	100	PASS	NS=3;DP=14;AF=0.5;DB;H2 GT:AP	0|0:0.000,0.000
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
    NS: '3',
    DP: '14',
    AF: '0.5',
    DB: null,
    H2: null,
  },
  SAMPLES: {
    HG00096: {
      GT: '0|0',
      AP: '0.000,0.000',
    },
  },
}
```

The parser will try to use metadata from the header if present to convert INFO
and FORMAT values to their proper type (int, float) or split them into an
array if they represent multiple values.

Metadata can be accessed with the `getMetadata()` method. With no paramters it
will return all the data. Any parameters passed will further filter the
metadata. For example, a VCF with this header:

```text
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of Samples With Data">
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##INFO=<ID=AA,Number=1,Type=String,Description="Ancestral Allele">
##INFO=<ID=DB,Number=0,Type=Flag,Description="dbSNP membership, build 129">
##INFO=<ID=H2,Number=0,Type=Flag,Description="HapMap2 membership">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
```

you can access the metadata like this:

```javascript
> console.log(this.getMetadata())
{ INFO:
  { NS:
    { Number: 1,
      Type: 'Integer',
      Description: 'Number of Samples With Data' },
    DP: { Number: 1, Type: 'Integer', Description: 'Total Depth' },
    AF: { Number: NaN, Type: 'Float', Description: 'Allele Frequency' },
    AA: { Number: 1, Type: 'String', Description: 'Ancestral Allele' },
    DB:
    { Number: 0,
      Type: 'Flag',
      Description: 'dbSNP membership, build 129' },
    H2: { Number: 0, Type: 'Flag', Description: 'HapMap2 membership' } },}
> console.log(this.getMetadata('INFO'))
{ NS:
  { Number: 1,
    Type: 'Integer',
    Description: 'Number of Samples With Data' },
  DP: { Number: 1, Type: 'Integer', Description: 'Total Depth' },
  AF: { Number: NaN, Type: 'Float', Description: 'Allele Frequency' },
  AA: { Number: 1, Type: 'String', Description: 'Ancestral Allele' },
  DB:
  { Number: 0,
    Type: 'Flag',
    Description: 'dbSNP membership, build 129' },
  H2: { Number: 0, Type: 'Flag', Description: 'HapMap2 membership' } }
> console.log(this.getMetadata('INFO', 'DP'))
{ Number: 1, Type: 'Integer', Description: 'Total Depth' }
> console.log(this.getMetadata('INFO', 'DP', 'Number'))
1
```

Samples are also available.

```javascript
> console.log(this.samples)
[ 'HG00096' ]
```

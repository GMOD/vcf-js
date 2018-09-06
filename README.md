# vcf-js

High performance streaming VCF parser in pure JavaScript

[![Build Status](https://img.shields.io/travis/com/GMOD/vcf-js/master.svg?logo=travis&style=flat-square)](https://travis-ci.com/GMOD/vcf-js)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/vcf-js/master.svg?style=flat-square)](https://codecov.io/gh/GMOD/vcf-js/branch/master)
[![NPM version](https://img.shields.io/npm/v/@gmod/vcf.svg?logo=npm&style=flat-square)](https://npmjs.org/package/@gmod/cram)

# Usage

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
  ID: 'rs17883296',
  REF: 'G',
  ALT: ['T', 'A'],
  QUAL: 100,
  FILTER: 'PASS',
  INFO: {
    NS: 3,
    DP: 14,
    AF: 0.5,
    DB: null,
    H2: null,
  },
  HG00096: {
    GT: '0|0',
    AP: '0.000,0.000',
  },
}
```

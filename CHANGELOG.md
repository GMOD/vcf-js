<a name="4.0.3"></a>
## [4.0.3](https://github.com/GMOD/vcf-js/compare/v4.0.1...v4.0.3) (2021-03-31)



- Include github automated fixes in release from before 4.0.2

<a name="4.0.2"></a>

## [4.0.2](https://github.com/GMOD/vcf-js/compare/v4.0.1...v4.0.2) (2021-03-31)

- Avoid modifying built-in exports with parseMetadata, fixes issue with using
  parseMetadata from jest tests (#63)

<a name="4.0.1"></a>

## [4.0.1](https://github.com/GMOD/vcf-js/compare/v4.0.0...v4.0.1) (2019-10-30)

- Add toString for Breakend ALTs so they are easily interpretable

## [4.0.0](https://github.com/GMOD/vcf-js/compare/v3.0.0...v4.0.0) (2019-06-14)

- Breaking change: INFO entries that are type Flag now evaluate to `true`
  instead of `null`

## [3.0.0](https://github.com/GMOD/vcf-js/compare/v2.0.3...v3.0.0) (2019-05-31)

- Breaking change: ALT entries in breakend format now parse into a breakend
  object instead of a string
- Performance improvements

## [2.0.3](https://github.com/GMOD/vcf-js/compare/v2.0.2...v2.0.3) (2019-02-23)

- Upgrade to Babel 7

## [2.0.2](https://github.com/GMOD/vcf-js/compare/v2.0.1...v2.0.2) (2018-11-26)

- Remove errant unused dependency

## [2.0.1](https://github.com/GMOD/vcf-js/compare/v2.0.0...v2.0.1) (2018-11-08)

- Bugfix for getMetadata()

## [2.0.0](https://github.com/GMOD/vcf-js/compare/v1.0.4...v2.0.0) (2018-11-07)

- Breaking change: SAMPLES attribute of the variant is now evaluated lazily

## [1.0.4](https://github.com/GMOD/vcf-js/compare/v1.0.3...v1.0.4) (2018-11-06)

- Decode %-encoded entries in INFO and FORMAT

## [1.0.3](https://github.com/GMOD/vcf-js/compare/v1.0.2...v1.0.3) (2018-11-05)

- Fix for parsing missing genotypes

## [1.0.2](https://github.com/GMOD/vcf-js/compare/v1.0.1...v1.0.2) (2018-10-11)

- Better handle filter metadata

## [1.0.1](https://github.com/GMOD/vcf-js/compare/v1.0.0...v1.0.1) (2018-10-05)

- Fix bug in interpreting "Number" in header metadata

## 1.0.0 (2018-10-05)

- Initial release

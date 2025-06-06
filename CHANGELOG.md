## [6.0.9](https://github.com/GMOD/vcf-js/compare/v6.0.8...v6.0.9) (2025-04-01)



## [6.0.8](https://github.com/GMOD/vcf-js/compare/v6.0.7...v6.0.8) (2025-02-13)

## [6.0.7](https://github.com/GMOD/vcf-js/compare/v6.0.6...v6.0.7) (2025-01-29)

## [6.0.6](https://github.com/GMOD/vcf-js/compare/v6.0.5...v6.0.6) (2025-01-16)

## [6.0.5](https://github.com/GMOD/vcf-js/compare/v6.0.4...v6.0.5) (2025-01-16)

## [6.0.4](https://github.com/GMOD/vcf-js/compare/v6.0.3...v6.0.4) (2025-01-16)

## [6.0.3](https://github.com/GMOD/vcf-js/compare/v6.0.2...v6.0.3) (2025-01-16)

## [6.0.2](https://github.com/GMOD/vcf-js/compare/v6.0.1...v6.0.2) (2025-01-07)

## [6.0.1](https://github.com/GMOD/vcf-js/compare/v6.0.0...v6.0.1) (2024-12-17)

# [6.0.0](https://github.com/GMOD/vcf-js/compare/v5.0.10...v6.0.0) (2024-11-30)

- Changes the default Variant object to have a SAMPLES() function call instead
  of a SAMPLES getter, to make it more abundantly clear that it is a lazy
  operation. Also adds a GENOTYPES() function that returns the raw string of
  genotype fields

## [5.0.10](https://github.com/GMOD/vcf-js/compare/v5.0.9...v5.0.10) (2022-12-17)

- Use es2015 for nodejs build

## [5.0.9](https://github.com/GMOD/vcf-js/compare/v5.0.8...v5.0.9) (2022-11-23)

- Fix erroneous parsing of symbolic alleles as breakends

## [5.0.8](https://github.com/GMOD/vcf-js/compare/v5.0.7...v5.0.8) (2022-11-20)

- Parse single breakends and large insertion shorthand notation (#95)

<a name="5.0.7"></a>

## [5.0.7](https://github.com/GMOD/vcf-js/compare/v5.0.6...v5.0.7) (2022-08-24)

- Don't throw error when there is a FORMAT column but no genotypes

<a name="5.0.6"></a>

## [5.0.6](https://github.com/GMOD/vcf-js/compare/v5.0.5...v5.0.6) (2022-03-30)

- Include src directory for better source maps

<a name="5.0.5"></a>

## [5.0.5](https://github.com/GMOD/vcf-js/compare/v5.0.4...v5.0.5) (2022-01-12)

- Add optimization related to better allocation of variant records, thanks to
  @bpow for contributing

<a name="5.0.4"></a>

## [5.0.4](https://github.com/GMOD/vcf-js/compare/v5.0.3...v5.0.4) (2021-12-23)

- Make the strict field in the constructor optional
- Export `Breakend` type for typescript users

<a name="5.0.3"></a>

## [5.0.3](https://github.com/GMOD/vcf-js/compare/v5.0.2...v5.0.3) (2021-12-14)

- Add typescripting and esm module build

<a name="5.0.2"></a>

## [5.0.2](https://github.com/GMOD/vcf-js/compare/v5.0.1...v5.0.2) (2021-11-13)

- Update package description to refer to variant call format

<a name="5.0.1"></a>

## [5.0.1](https://github.com/GMOD/vcf-js/compare/v5.0.0...v5.0.1) (2021-11-04)

- Add URI decoding to INFO field

<a name="5.0.0"></a>

# [5.0.0](https://github.com/GMOD/vcf-js/compare/v4.0.4...v5.0.0) (2021-09-06)

- Make parseBreakends an optional helper function, all ALTs are plain strings
  now instead of string|Breakend. This is a breaking change so a major version
  bump is applied

<a name="4.0.4"></a>

## [4.0.4](https://github.com/GMOD/vcf-js/compare/v4.0.1...v4.0.4) (2021-08-04)

- Fix issue when there is extra whitespace on the header line

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

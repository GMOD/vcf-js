## [7.0.10](https://github.com/GMOD/vcf-js/compare/v7.0.9...v7.0.10) (2026-07-25)


### Bug Fixes

* trailing line terminators and skipped genotype callbacks ([5900c05](https://github.com/GMOD/vcf-js/commit/5900c054024217caffe7a8e3dc5075371a98bf0f))

## [7.0.9](https://github.com/GMOD/vcf-js/compare/v7.0.8...v7.0.9) (2026-06-02)

### Bug Fixes

- remove stale workflow query link from CI badge
  ([0e39e60](https://github.com/GMOD/vcf-js/commit/0e39e603bec2042c85839c7e6fddd69c0a27080f))

## [7.0.8](https://github.com/GMOD/vcf-js/compare/v7.0.7...v7.0.8) (2026-05-19)

### Bug Fixes

- update CI badge to reference publish.yml workflow
  ([af3aac6](https://github.com/GMOD/vcf-js/commit/af3aac67365e691e5e0680aa3f8207232a8eaa5f))

### Features

- export Samples, InfoValue, MetaField, MetaMap types
  ([a58b195](https://github.com/GMOD/vcf-js/commit/a58b19565ce927a200eba3cdffd542a5394cb459))

## [7.0.7](https://github.com/GMOD/vcf-js/compare/v7.0.6...v7.0.7) (2026-05-19)

## [7.0.6](https://github.com/GMOD/vcf-js/compare/v7.0.5...v7.0.6) (2026-05-19)

## [7.0.5](https://github.com/GMOD/vcf-js/compare/v7.0.4...v7.0.5) (2026-05-18)

## [7.0.4](https://github.com/GMOD/vcf-js/compare/v7.0.3...v7.0.4) (2026-05-18)

### Features

- pass sample index to GenotypeCallback
  ([6b2a661](https://github.com/GMOD/vcf-js/commit/6b2a6610c526d5aeeaad7a309a00e5c1f00ad098))

## [7.0.3](https://github.com/GMOD/vcf-js/compare/v7.0.2...v7.0.3) (2026-05-08)

### Bug Fixes

- fix `getMetadata()` treating falsy-but-defined values (`0`, `''`, `false`)
  as missing; only `undefined` is now treated as missing
  ([ca49e2c](https://github.com/GMOD/vcf-js/commit/ca49e2cfb5f0519ac90af8a3ce6f3f9dd7b235f8))

## [7.0.2](https://github.com/GMOD/vcf-js/compare/v7.0.1...v7.0.2) (2026-04-27)

### Bug Fixes

- stop publishing a top-level `types` field; add `main` instead so
  TypeScript's `node10`/classic module resolution can still find the
  CommonJS type declarations
  ([6f32a5f](https://github.com/GMOD/vcf-js/commit/6f32a5fce4df5c7ca20d5040273002e98c14342b))

## [7.0.1](https://github.com/GMOD/vcf-js/compare/v7.0.0...v7.0.1) (2026-04-27)

# [7.0.0](https://github.com/GMOD/vcf-js/compare/v6.1.2...v7.0.0) (2026-01-18)

### Features

- **BREAKING**: `parseLine()` now returns a `Variant` class instance instead
  of a plain object literal, with `SAMPLES()`, `GENOTYPES()`, and
  `processGenotypes()` exposed as prototype methods (#123)
  ([2dd811d](https://github.com/GMOD/vcf-js/commit/2dd811d8561f431c544bd3cd3e83a7e598118107))

## [6.1.2](https://github.com/GMOD/vcf-js/compare/v6.1.1...v6.1.2) (2026-01-18)

### Bug Fixes

- remove the `processGenotypes()` callback added in 6.1.1; the author noted
  this is technically a breaking change
  ([b353821](https://github.com/GMOD/vcf-js/commit/b3538216814e5a56d88849242e70cafe4da378f9))

## [6.1.1](https://github.com/GMOD/vcf-js/compare/v6.1.0...v6.1.1) (2026-01-17)

### Features

- add `processGenotypes()` for per-record genotype iteration without
  intermediate object/string allocation, plus the `GenotypeCallback` type
  export
  ([a6e136c](https://github.com/GMOD/vcf-js/commit/a6e136c1ddc1eafa81415da460df8b312c6e50e0))

# [6.1.0](https://github.com/GMOD/vcf-js/compare/v6.0.9...v6.1.0) (2025-11-26)

### Performance Improvements

- various optimizations to VCF parsing, including faster parsing of large
  genotype arrays (#122)
  ([90a785e](https://github.com/GMOD/vcf-js/commit/90a785e1aa876d5adda8e501be17edfe1e62053d))

## [6.0.9](https://github.com/GMOD/vcf-js/compare/v6.0.8...v6.0.9) (2025-04-01)

### Bug Fixes

- better handling of variants that have a FORMAT column but are missing
  FORMAT fields (#113)
  ([e23ac28](https://github.com/GMOD/vcf-js/commit/e23ac28f112a3fa1a5fe74b0028bd18350484a24))

## [6.0.8](https://github.com/GMOD/vcf-js/compare/v6.0.7...v6.0.8) (2025-02-13)

### Bug Fixes

- fix header parsing when a `=` character appears inside a meta description
  (#110)
  ([b72f780](https://github.com/GMOD/vcf-js/commit/b72f780c2cf865d756fc78c312b74f63987a9783))

## [6.0.7](https://github.com/GMOD/vcf-js/compare/v6.0.6...v6.0.7) (2025-01-29)

### Features

- add FORMAT field to parsed records (#109)
  ([d8ed6cd](https://github.com/GMOD/vcf-js/commit/d8ed6cd18cbd9b6cc27d9fecbc8455e6d5e09355))

## [6.0.6](https://github.com/GMOD/vcf-js/compare/v6.0.5...v6.0.6) (2025-01-16)

### Bug Fixes

- add an explicit top-level `types` field to package.json, for TypeScript
  resolvers that don't support conditional `exports`
  ([f97ab0e](https://github.com/GMOD/vcf-js/commit/f97ab0e8fc6d04ee71ee3604f0cf3cc0f28e1efb))

## [6.0.5](https://github.com/GMOD/vcf-js/compare/v6.0.4...v6.0.5) (2025-01-16)

### Bug Fixes

- restore the per-condition `types` entries in package.json `exports`,
  fixing TypeScript resolution regressed in 6.0.4
  ([36e9575](https://github.com/GMOD/vcf-js/commit/36e95754742667c0a69487e200e5eb5c6567b0f6))

## [6.0.4](https://github.com/GMOD/vcf-js/compare/v6.0.3...v6.0.4) (2025-01-16)

### Features

- simplify package.json `exports` to flat `import`/`require` path strings,
  dropping the per-condition `types` entries
  ([1aacd89](https://github.com/GMOD/vcf-js/commit/1aacd894a1c6f9a110de963044a1ae953609e8c2))

## [6.0.3](https://github.com/GMOD/vcf-js/compare/v6.0.2...v6.0.3) (2025-01-16)

## [6.0.2](https://github.com/GMOD/vcf-js/compare/v6.0.1...v6.0.2) (2025-01-07)

### Features

- publish dual ESM/CommonJS builds via package.json `exports` conditions
  instead of separate `main`/`module` fields (#108)
  ([acf463c](https://github.com/GMOD/vcf-js/commit/acf463c94a8af776f790ba24cb98f5e678c0e509))

## [6.0.1](https://github.com/GMOD/vcf-js/compare/v6.0.0...v6.0.1) (2024-12-17)

### Bug Fixes

- fix parsing of header lines whose values contain square-bracket lists
  (#107)
  ([5950b41](https://github.com/GMOD/vcf-js/commit/5950b416fa855b6e2236b8887f29b4781eda9611))
- fix INFO keys with no value and no header `Type=Flag` declaration
  evaluating to `undefined` instead of `true`
  ([0fa6e43](https://github.com/GMOD/vcf-js/commit/0fa6e43a2481ddf81bed8e1f698ac5c2a444fa9c))

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

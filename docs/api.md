# API

## `new VCF({ header, strict })`

| arg      | type       | description                                                                                                    |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `header` | `string`   | The whole VCF header, `##` lines through the `#CHROM` line. Throws if empty, malformed, or missing `#CHROM`    |
| `strict` | `boolean?` | Default `true`. When true, `parseLine` throws on a line with no INFO column, which the spec requires to be `.` |

Parse the header once and reuse the parser for every line. The parser holds the
INFO/FORMAT/ALT/FILTER metadata it uses to type values, plus the sample list.

## `parser.parseLine(line): Variant`

Parses the first nine columns and returns a `Variant`. It leaves the sample
columns alone until you call a sample method; see
[optimizations.md](optimizations.md).

## `parser.samples: string[]`

Sample names from the `#CHROM` line, in column order. This is the order
`sampleIdx` counts against in the callback APIs. The array identity is stable
for the life of the parser.

## `parser.getMetadata(...keys)`

Header metadata, narrowed by each key in turn:

```typescript
parser.getMetadata('INFO', 'DP')
// { Number: 1, Type: 'Integer', Description: 'combined depth across samples' }

parser.getMetadata('INFO', 'DP', 'Number')
// 1
```

With no arguments, `getMetadata` returns all of it. Fields reserved by the
[VCF spec](https://samtools.github.io/hts-specs/VCFv4.3.pdf) are present even
when the header doesn't define them.

## `Variant`

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
  INFO: {
    NS: [3],
    DP: [14],
    AF: [0.5],
    DB: true,   // Type=Flag, a bare key, or KEY= with an empty value
    XYZ: ['5'], // unknown fields default to Number=1, Type=String
  },
}
```

The parser types the INFO and FORMAT values from the header metadata. Values
come back as arrays unless `Type=Flag`, where they are `true`. A `.` inside a
value becomes `undefined`, and the parser percent-decodes `%XX` escapes.

`JSON.stringify(variant)` serializes the columns above and leaves out the sample
data, because `toJSON()` returns an object of just those nine column fields.

Also on the instance: `line` (the whole input line), `restStart`/`restEnd` (the
sample columns' bounds within it), `rest` (a getter that slices them out), and
`sampleNames` (the parser's sample list).

### `variant.SAMPLES(): Record<string, Record<string, SampleValue>>`

Returns every FORMAT field of every sample, keyed by sample name then FORMAT
key. Values are numeric where the header declares a numeric `Type`, and `.` and
empty values become `undefined`.

`SAMPLES()` re-parses on every call and costs an object plus an array per
sample, so call it once and keep the result. Prefer `processFormatFields` when
you want particular fields.

For a record with VCF 4.5 local-allele fields, `SAMPLES()` also reports them
under their non-local keys, so a sample can hold an `AD` its FORMAT never
declared, expanded from `LAD`. Those keys are lazy accessors that reconstruct on
first read; the local keys stay alongside them. See
[docs/local-alleles.md](local-alleles.md).

### `variant.GENOTYPES(): Record<string, string>`

Returns only the GT strings, keyed by sample name, as a null-prototype object,
so use `Object.keys` / `in`, not `hasOwnProperty`.

### `variant.processGenotypes(callback)`

Calls `callback(str, start, end, sampleIdx)` once per sample, where the genotype
is `str.slice(start, end)`. The method reports the genotype as a range, so a
caller that only classifies it allocates nothing.

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

`processGenotypes` does nothing when FORMAT has no `GT`. A sample whose fields
stop before the GT column still gets a callback, with an empty range, so
`sampleIdx` always matches the sample's index in `parser.samples`.

### `variant.processFormatFields(keys, callback)`

`processFormatFields` works like `processGenotypes` for any FORMAT keys you
name. It calls `callback(str, ranges, sampleIdx)`, where key `k` spans
`ranges[2 * k]` to `ranges[2 * k + 1]`, both `-1` when that sample has no value
for it:

```typescript
// samples with a phase set, and their genotype
const phased: { sampleIdx: number; gt: string; ps: string }[] = []
variant.processFormatFields(['GT', 'PS'], (str, ranges, sampleIdx) => {
  if (ranges[2] !== -1) {
    phased.push({
      sampleIdx,
      gt: str.slice(ranges[0], ranges[1]),
      ps: str.slice(ranges[2], ranges[3]),
    })
  }
})
```

The method walks each sample once, so it costs the sample's length however many
keys you ask for. `ranges` is scratch, reused for every sample, so read it
inside the callback rather than retaining it. If FORMAT declares none of the
requested keys the callback never fires.

`processGenotypes` and `processFormatFields` ignore the callback's return value,
so they cannot stop early and always visit every sample.

## `parseBreakend(alt): Breakend | undefined`

Parses a breakend ALT string, returning `undefined` for anything that isn't one:

```typescript
import { parseBreakend } from '@gmod/vcf'

parseBreakend('C[2:321682[')
// { MateDirection: 'right', Replacement: 'C', MatePosition: '2:321682', Join: 'right' }
```

`parseBreakend` handles all four bracket forms from the spec. `Join` is whether
the replacement base comes before (`right`) or after (`left`) the mate position;
`MateDirection` is which way the mate sequence extends, `[` rightward and `]`
leftward:

| ALT form | Join  | MateDirection |
| -------- | ----- | ------------- |
| `t[p[`   | right | right         |
| `t]p]`   | right | left          |
| `[p[t`   | left  | right         |
| `]p]t`   | left  | left          |

In every form, `Replacement` is the ALT's own bases, without the brackets and
mate position, the `.`, or the symbol.

### Single breakends

When the ALT starts or ends with `.`, the result has `SingleBreakend: true` and
no `MatePosition`:

```typescript
parseBreakend('C.')
// { Join: 'right', Replacement: 'C', SingleBreakend: true }

parseBreakend('.ACGT')
// { Join: 'left', Replacement: 'ACGT', SingleBreakend: true }
```

### Symbolic alleles

An ALT containing `<...>` uses the symbol as the mate contig:

```typescript
parseBreakend('<DUP>ACGT')
// { Join: 'left', Replacement: 'ACGT', MateDirection: 'right', MatePosition: '<DUP>:1' }

parseBreakend('ACGT<DUP>')
// { Join: 'right', Replacement: 'ACGT', MateDirection: 'right', MatePosition: '<DUP>:1' }
```

## Local alleles

The exports below decode VCF 4.5's local-allele encoding. `SAMPLES()` already
decodes it, so use them only for sample data assembled some other way, or for a
whole-file pass where `SAMPLES()` costs too much.
[docs/local-alleles.md](local-alleles.md) has the reasoning, the costs and the
spec's edge cases.

| export                                                      | what it does                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `decodeLocalAlleles(sample, altCount)`                      | A copy of one sample with its local fields also reported under their non-local keys, expanded on first read |
| `localAlleles(laa)`                                         | The local allele list `[0, ...LAA]` from a parsed `LAA` value                                               |
| `localToGlobalR(values, alleles, alleleCount)`              | Expand a `Number=LR` field (`LAD`, `LADF`, `LADR`) to `Number=R`                                            |
| `localToGlobalA(values, alleles, altCount)`                 | Expand a `Number=LA` field (`LEC`) to `Number=A`                                                            |
| `localToGlobalG(values, alleles, alleleCount, ploidyHint?)` | Expand a `Number=LG` field (`LPL`, `LGL`, `LGP`, `LPP`) to `Number=G`                                       |
| `readLocalAlleles(str, start, end, out)`                    | Fill `out` from a `processFormatFields` range, returning the count — allocates nothing per sample           |
| `LocalAlleleGenotypeMaps`                                   | `.get(alleles, count, ploidy)` memoizes the local-to-global genotype permutation across samples             |

Wherever a function above takes `alleles`, it is the local allele list, REF
first, in the order `LAA` lists them. That order need not ascend, and local
genotypes are enumerated in it.

`localToGlobalG` takes ploidy from the value count where that is unambiguous,
falling back to `ploidyHint` (default 2) for a REF-only sample, which has one
genotype at every ploidy. Its output is `C(alleleCount + ploidy - 1, ploidy)`
long, so at a high-ploidy site with many ALTs the output is an array too large
for JS to allocate, while the local-allele encoding avoids that cost.

## Exports

`default` (the parser), `Variant`, `parseBreakend`, the local-allele exports
above (`decodeLocalAlleles`, `localAlleles`, `localToGlobalR`, `localToGlobalA`,
`localToGlobalG`, `readLocalAlleles`, `LocalAlleleGenotypeMaps`), and the types
`Breakend`, `Samples`, `SampleData`, `SampleValue`, `InfoValue`, `MetaMap`,
`MetaField`, `GenotypeCallback`, `FormatFieldsCallback`.

# API

## `new VCF({ header, strict })`

| Arg      | Type       | Description                                                                                                    |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `header` | `string`   | The whole VCF header, `##` lines through the `#CHROM` line. Throws if empty, malformed, or missing `#CHROM`    |
| `strict` | `boolean?` | Default `true`. When true, `parseLine` throws on a line with no INFO column, which the spec requires to be `.` |

Parse the header once and reuse the parser for every line — it holds the
INFO/FORMAT/ALT/FILTER metadata that types values, plus the sample list.

## `parser.parseLine(line): Variant`

Parses the first nine columns and returns a `Variant`. Sample columns are not
touched until a sample method is called; see
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

With no arguments, everything. Fields reserved by the
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

INFO and FORMAT values are typed from header metadata. Values are arrays unless
`Type=Flag`, in which case they are `true`. `.` inside a value becomes
`undefined`, and `%XX` escapes are percent-decoded.

`JSON.stringify(variant)` serializes the columns above only — sample data is not
included.

Also on the instance: `line` (the whole input line), `restStart`/`restEnd` (the
sample columns' bounds within it), `rest` (a getter that slices them out), and
`sampleNames` (the parser's sample list).

### `variant.SAMPLES(): Record<string, Record<string, SampleValue>>`

Every FORMAT field of every sample, keyed by sample name then FORMAT key.
Numeric per the header's `Type`; `.` and empty become `undefined`.

Re-parses on every call — call it once and keep the result — and costs an object
plus an array per sample. Prefer `processFormatFields` when you want particular
fields.

### `variant.GENOTYPES(): Record<string, string>`

GT strings only, keyed by sample name. Returns a null-prototype object, so use
`Object.keys` / `in`, not `hasOwnProperty`.

### `variant.processGenotypes(callback)`

`callback(str, start, end, sampleIdx)` per sample, where the genotype is
`str.slice(start, end)` — reported as a range so a caller that only classifies
it allocates nothing.

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

Does nothing when FORMAT has no `GT`. A sample whose fields stop before the GT
column gets an empty range rather than a skipped callback, so `sampleIdx` always
tracks `parser.samples`.

### `variant.processFormatFields(keys, callback)`

The same idea past GT. `callback(str, ranges, sampleIdx)`, where key `k` spans
`ranges[2 * k]` to `ranges[2 * k + 1]`, both `-1` when that sample has no value
for it:

```typescript
// samples carrying a phase set, and their genotype
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

Each sample is located in one pass, so the cost is the sample's length however
many keys you ask for. `ranges` is scratch, reused for every sample — read it
inside the callback rather than retaining it. If FORMAT declares none of the
requested keys the callback never fires.

Neither `process*` method reads the callback's return value, so there is no
early exit: both always visit every sample.

## `parseBreakend(alt): Breakend | undefined`

Parses a breakend ALT string, returning `undefined` for anything that isn't one:

```typescript
import { parseBreakend } from '@gmod/vcf'

parseBreakend('C[2:321682[')
// { MateDirection: 'right', Replacement: 'C', MatePosition: '2:321682', Join: 'right' }
```

All four bracket forms from the spec. `Join` is whether the replacement base
comes before (`right`) or after (`left`) the mate position; `MateDirection` is
which way the mate sequence extends, `[` rightward and `]` leftward:

| ALT form | Join  | MateDirection |
| -------- | ----- | ------------- |
| `t[p[`   | right | right         |
| `t]p]`   | right | left          |
| `[p[t`   | left  | right         |
| `]p]t`   | left  | left          |

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

## Exports

`default` (the parser), `Variant`, `parseBreakend`, and the types `Breakend`,
`Samples`, `SampleData`, `SampleValue`, `InfoValue`, `MetaMap`, `MetaField`,
`GenotypeCallback`, `FormatFieldsCallback`.

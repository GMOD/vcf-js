# Optimizations

[api.md](api.md) documents every method; this document explains why the parser
works the way it does.

In a VCF with many samples, the line is mostly sample columns. A record from
1000 Genomes has 2504 samples, so it holds a couple hundred bytes of variant and
tens of kilobytes of genotypes. The parser therefore tries to touch as little of
the sample data as it can, and to walk what you do ask for without allocating
memory per sample.

## About the numbers in this document

Two kinds of measurement appear below, and they are not comparable.

Figures written as a ratio, such as **1.3x**, come from
`benchmark/parse.bench.ts` and time a single scan against an alternative
implementation of that same scan. Run them with `pnpm benchonly`. Figures in
milliseconds and megabytes measure a whole operation end to end, so they include
work this parser does not do.

Whole runs drift by around 40% when the machine is busy, and the first benchmark
declared in a group runs 10-30% slow even against identical code (the benchmark
file explains why). Compare within a run, and swap the declaration order before
you believe a small difference.

## Parsing a line

### The parser splits only the first nine columns

`new Variant(line, ...)` counts tabs until it reaches the ninth. Then it slices
that prefix and splits it. It never splits or slices the sample columns. Instead
the constructor keeps the whole `line`, plus `restStart` and `restEnd` offsets
that mark where the sample columns begin and end. A line from a 3000-sample file
therefore takes about as long to parse as a sites-only line.

A line with fewer than nine tabs has no sample columns. In that case `restStart`
is at or past `restEnd`, so every scan below finds nothing and needs no special
case.

### The constructor strips the line terminator first

If you split a CRLF file on `\n`, a `\r` stays behind at the end of the line.
The `\r` would become part of the last field and turn a genotype into `0/0\r`.
The constructor trims the trailing CR and LF before it does anything else, so no
later scan has to handle it.

### INFO is the one thing parsed eagerly

The parser reads INFO on every line whether you use it or not. INFO is a column
rather than sample data, and typing its values needs header metadata that only
the parser holds. A file with a large INFO column incurs this cost even when you
only want `CHROM` and `POS`. The parser keeps the cost down by skipping
percent-decoding unless the raw string contains a `%`, and by skipping `split()`
on a value that has no comma.

## Reading sample data

The parser does none of the work below until you call one of the four sample
methods. The table lists what each one allocates per sample.

| method                  | allocates per sample                    |
| ----------------------- | --------------------------------------- |
| `processGenotypes()`    | nothing — indices into the line         |
| `processFormatFields()` | nothing — indices into the line         |
| `GENOTYPES()`           | one string                              |
| `SAMPLES()`             | one object plus an array per FORMAT key |

The `process*` pair reports each value as a range into the line, so a caller
that only classifies a genotype never builds the substring.

### The scans walk the flat line instead of a `rest` slice

A `Variant` that stored `rest = line.slice(restStart, restEnd)` would hold a V8
`SlicedString`, and every `charCodeAt` call on one has to unwrap it first. The
unwrapping takes real time here, because `charCodeAt` is essentially all these
scans do. Passing the flat line through with offsets instead of a stored `rest`
ran **1.3x** faster on a 3202-sample record.

`rest` is a public getter that builds the slice only when something reads it.
Use it if you want the sample columns as a string, but on a file with many
samples, reading it allocates the copy that the flat-line optimization above
avoids.

The offsets in the callbacks point into whichever string the parser passed you,
so calling `str.slice(start, end)` in your own code still works the same way.

### Long hops use `indexOf`, short ones do not

Once the scan has read a sample's genotype, the rest of that sample is unused.
On the FORMAT layout 1000 Genomes uses, `GT:AB:AD:DP:GQ:PGT:PID:PL` at roughly
30 characters per sample, that unused portion is most of the line.
`indexOf('\t')` skips it using V8's vectorized memchr, and that ran **2.3x**
faster than walking the same bytes one at a time. `processFormatFields` makes
the same jump once it has answered every key you asked for, which ran **1.7x**
faster on a `GT:PS:AD:DP:GQ:PL` record queried for GT and PS.

The short scans use `charCodeAt` loops on purpose. Reading the genotype itself
has nothing to skip, and neither does the `format === 'GT'` fast path. There the
call to `indexOf` costs more than it saves, and it measured **0.86x**. tabix-js
reached the same conclusion for its `Uint8Array` scans in
[ADR 0003](https://github.com/GMOD/tabix-js/blob/main/agent-docs/architecture-decision-records/0003-keep-indexof-based-byte-scans.md).

`indexOf` searches all the way to the end of the string, so the scan clamps
every hit back to `restEnd`. The clamp is the cost of passing the scans the
whole line rather than a slice of it.

### The parser finds FORMAT columns once, and matches them exactly

The parser works out the column index of GT, or of each key you asked for, once
per record rather than once per sample. It matches on exact length and exact
characters. That way it does not mistake GATK's `PGT` for `GT`, or its `PID` for
`ID`, the way a substring test would.

### One pass per sample, however many keys you ask for

As `processFormatFields` walks a sample, at each colon it closes the range of
any requested key whose value ends there. A call for five fields therefore makes
the same single walk as a call for one, and the bounds for all of them come back
in one reused `Int32Array`; see
[api.md](api.md#variantprocessformatfieldskeys-callback) for its layout.

### `SAMPLES()` is the fallback, and it costs like one

`SAMPLES()` parses every field of every sample into an object, with an array for
each FORMAT key. Reading two fields that way from a 2504-sample `GT:AD:DP:GQ:PL`
set took **1985ms and 2095MB**. Reading the same two fields through
`processFormatFields` took **180ms and 1MB**. `SAMPLES()` also re-parses the
line every time you call it, so call it once and hold onto the result.

`SAMPLES()` skips `split()` on fields with a single value, which is the common
case, and `split()` is most of what remains of the method's cost.

## What the consumer has to do

The parser can only make sample data cheap to reach; the rest is up to the
caller.

### Applies to any consumer

- Build one parser per file, once, from the header, and not one per record. The
  header holds the INFO, FORMAT, ALT and FILTER metadata, plus a sample list
  that can run to thousands of names. The parser keeps the same array of sample
  names for its whole life, so your own code can compare the arrays to tell that
  two features came from the same header.
- Read named fields with `processFormatFields`, not `SAMPLES()`. To return one
  field, `SAMPLES()` first parses every other FORMAT field of every sample.
- Do all your work in one callback. If you walk the samples once to classify
  them and again to draw them, that is two traversals for an intermediate result
  the final output never needs.
- Key off `sampleIdx` rather than a counter of your own. A sample whose fields
  run out before the requested column still gets a callback, with an empty range
  or `-1` bounds.
- Do not hold onto `Variant`s from a file with many samples, though streaming
  them is fine. Each `Variant` keeps its whole input line, which lets the scans
  stay lazy, so an array holding a region's worth of them keeps every one of
  those lines in memory. Serializing a feature with `toJSON` is the one
  operation that builds everything at once.

### A worked example: jbrowse-components

Two of those rules made a measured difference in
[jbrowse-components](https://github.com/GMOD/jbrowse-components).

- **`processFormatFields` instead of `SAMPLES()`.** Coloring by phase set needs
  GT and PS. Reading them through the samples object took 343ms and 239MB per
  fetch on a 100-sample phased long-read callset across 2k variants, against
  33ms and 4MB through `processFormatFields`. At 500 samples the gap was 1686ms
  and 1.17GB against 113ms and 4MB.
- **Doing the work in one callback.** jbrowse used to send the genotypes across
  the RPC boundary as a `Record<sampleName, genotype>`, built by `GENOTYPES()`
  and then walked three more times: once for the legend flags, once for the cell
  colors, and once to encode them for transfer. That made four traversals and
  F×S string allocations, all to rebuild a payload the worker only ever sends as
  integer codes. jbrowse now does the work in a single `processGenotypes`
  callback, which cut the analyze and paint step from **613ms to 168ms** on 2504
  samples across 400 variants, and the 168ms covers painting that the 613ms did
  not.

jbrowse's genotype code uses two more techniques that help a workload like this
one.

- Memoize per site, not globally. A single site holds only a handful of distinct
  genotypes across thousands of samples. A linear scan over the ranges you have
  already seen at that site matches almost every sample, and it never builds the
  substring. Genotypes of four characters or fewer, which covers every diploid
  call an ordinary VCF spells out, pack whole into one integer, so spotting a
  repeat is a single integer comparison.
- Do not close over mutated primitives on the hot path. jbrowse's allele counter
  accumulates into an object instead of into captured local variables. A closure
  that mutates a captured primitive forces V8 to allocate a `Context` on the
  per-sample callback. The counter's non-callback version uses plain locals,
  which are faster there, so the two versions are duplicated on purpose.

[tabix-js's optimizations doc](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md)
covers the layer underneath this one: the index, the chunks, the decompression,
and the line scan that produces the strings you pass to `parseLine`.

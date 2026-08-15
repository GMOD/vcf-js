# Optimizations

This is why the parser works the way it does. [api.md](api.md) documents every
method; this document explains the reasoning behind them.

One fact drives all of it. In a VCF with many samples, the line is mostly sample
columns. A record from 1000 Genomes has 2504 samples, so it carries a couple
hundred bytes of variant and tens of kilobytes of genotypes. The parser tries to
touch as little of that as it can, and to walk what you do ask for without
allocating memory per sample.

**If you read nothing else:** on a file with many samples, read sample data with
`processGenotypes` or `processFormatFields`. Use `SAMPLES()` only when you
really want every field, and then call it once and keep what it returns.

## Parsing a line

### The parser splits only the first nine columns

`new Variant(line, ...)` counts tabs until it reaches the ninth. Then it slices
that prefix and splits it. It never splits or slices the sample columns. Instead
the constructor keeps the whole `line`, plus `restStart` and `restEnd` offsets
that mark where the sample columns begin and end. Parsing a line from a
3000-sample file therefore costs about what a sites-only line costs.

A line with fewer than nine tabs has no sample columns. In that case `restStart`
lands at or past `restEnd`, so every scan below finds nothing and no special
case is needed.

### The constructor strips the line terminator first

If you split a CRLF file on `\n`, a `\r` stays behind at the end of the line. It
would land inside the last field and turn a genotype into `0/0\r`. The
constructor trims the trailing CR and LF before it does anything else, so no
later scan has to worry about it.

### INFO is the one thing parsed eagerly

The parser reads INFO on every line whether you use it or not. INFO is a column
rather than sample data, and typing its values needs header metadata that only
the parser holds. A file with a large INFO column pays for this even when you
only want `CHROM` and `POS`. Two shortcuts keep the cost down. The parser skips
percent-decoding unless the raw string contains a `%`, and it skips `split()` on
a value that has no comma.

## Reading sample data

None of the work below happens until you call one of the four sample methods.
Here is what each one allocates per sample.

| method                  | allocates per sample                    |
| ----------------------- | --------------------------------------- |
| `processGenotypes()`    | nothing — indices into the line         |
| `processFormatFields()` | nothing — indices into the line         |
| `GENOTYPES()`           | one string                              |
| `SAMPLES()`             | one object plus an array per FORMAT key |

The two `process*` methods hand you the line itself and report each value as a
`start` and `end` range into it. If you only need to classify a genotype, such
as counting its alleles or picking a color, you never have to build the
substring.

### The scans walk the flat line instead of a `rest` slice

`Variant` used to store `rest = line.slice(restStart, restEnd)`. V8 represents
that as a `SlicedString`, and every `charCodeAt` call on one has to unwrap it
first. Unwrapping costs real time here because `charCodeAt` is essentially all
these scans do. Passing the flat line through with offsets instead ran **1.3x**
faster on a 3202-sample record. `rest` still exists as a getter, and it builds
the slice only if you ask for it.

The offsets in the callbacks point into whichever string the parser passed you,
so calling `str.slice(start, end)` in your own code still works the same way.

### Long hops use `indexOf`, short ones do not

Once the scan has read a sample's genotype, the rest of that sample is dead
weight. On the shape 1000 Genomes uses, `GT:AB:AD:DP:GQ:PGT:PID:PL` at roughly
30 characters per sample, that dead weight is most of the line. `indexOf('\t')`
skips it using V8's vectorized memchr, and that ran **2.3x** faster than walking
the same bytes one at a time. `processFormatFields` makes the same jump once it
has answered every key you asked for, which ran **1.7x** faster on a
`GT:PS:AD:DP:GQ:PL` record queried for GT and PS.

The short scans still use `charCodeAt` loops, and that is deliberate. Reading
the genotype itself has nothing to skip, and neither does the `format === 'GT'`
fast path. There the call to `indexOf` costs more than it saves, and it measured
**0.86x**. tabix-js reached the same conclusion for its `Uint8Array` scans in
[ADR 0003](https://github.com/GMOD/tabix-js/blob/main/agent-docs/adr/0003-keep-indexof-based-byte-scans.md).
How many bytes you touch does not tell you how long the work will take.

`indexOf` searches all the way to the end of the string, so the scan clamps
every hit back to `restEnd`. That is the price of handing the scans the whole
line rather than a slice of it.

### The parser finds FORMAT columns once, and matches them exactly

The parser works out the column index of GT, or of each key you asked for, once
per record rather than once per sample. It matches on exact length and exact
characters. That way it does not mistake GATK's `PGT` for `GT`, or its `PID` for
`ID`, the way a substring test would.

### One pass per sample, however many keys you ask for

As `processFormatFields` walks a sample, it closes out whichever of your keys
land on each colon. Asking for five fields therefore costs the same walk as
asking for one. The bounds come back in a single `Int32Array` that the parser
reuses for every sample, so treat it as scratch space. Read it inside the
callback rather than holding onto it.

If FORMAT declares none of the keys you asked for, the callback never fires,
which matches how `processGenotypes` behaves on a record with no GT.

### `SAMPLES()` is the fallback, and it costs like one

`SAMPLES()` parses every field of every sample into an object, with an array for
each FORMAT key. Reading two fields that way from a 2504-sample `GT:AD:DP:GQ:PL`
set took **1985ms and 2095MB**. Reading the same two fields through
`processFormatFields` took **180ms and 1MB**. `SAMPLES()` also re-parses the
line every time you call it, so call it once and hold onto the result.

One thing keeps it from being worse. Fields with a single value, which is the
common case, skip `split()`, and `split()` is most of what remains of the
method's cost.

### A sample that stops short still gets a callback

Sometimes a sample's colon-separated fields run out before the column you asked
for. The callback still fires, with an empty range or with `-1` bounds. The
parser never silently skips a sample. That is what makes `sampleIdx` reliable:
it always follows the sample order from the header. Key off it rather than
counting the callbacks yourself.

## What the consumer has to do

The parser can only make sample data cheap to reach. What you do with it after
that is up to the code above this library.

### Applies to any consumer

- **Build one parser per file, from the header, once.** Parsing the header
  covers the INFO, FORMAT, ALT and FILTER metadata, plus a sample list that can
  run to thousands of names. Do that per file, not per record. The array of
  sample names also keeps its identity, so your own code can compare it to tell
  that two features came from the same header.
- **Read named fields with `processFormatFields`, not `SAMPLES()`.** Getting one
  field out of the samples object means parsing every other FORMAT field of
  every sample first.
- **Do all your work in one callback.** If you walk the samples once to classify
  them and again to draw them, you have paid twice for a traversal whose
  intermediate result nobody wants.
- **Key off `sampleIdx` rather than a counter of your own,** as above.
- **Do not hold onto `Variant`s from a file with many samples.** Each `Variant`
  keeps its whole input line, which is exactly what lets the scans stay lazy.
  Streaming is fine. Collecting a region's worth into an array keeps every one
  of those lines in memory. Serializing a feature with `toJSON` is the one
  operation that builds everything at once.

### A worked example: jbrowse-components

Here is what two of those rules were worth in
[jbrowse-components](https://github.com/GMOD/jbrowse-components).

- **`processFormatFields` instead of `SAMPLES()`.** Coloring by phase set needs
  GT and PS. Reading them through the samples object took 343ms and 239MB per
  fetch on a 100-sample phased long-read callset across 2k variants, against
  33ms and 4MB the other way. At 500 samples the gap was 1686ms and 1.17GB
  against 113ms and 4MB.
- **Doing the work in one callback.** The genotypes used to cross the RPC
  boundary as a `Record<sampleName, genotype>`, built by `GENOTYPES()` and then
  walked three more times: once for the legend flags, once for the cell colors,
  and once to encode them for transfer. That is four traversals and F×S string
  allocations, all to rebuild a payload the worker only ever ships as integer
  codes. Moving it into a single `processGenotypes` callback took the analyze
  and paint step from **613ms to 168ms** on 2504 samples across 400 variants,
  and the 168ms covers painting that the 613ms did not.

Two more tricks from the same code. They are worth knowing if your workload
looks like this one.

- **Memoize per site, not globally.** A single site holds only a handful of
  distinct genotypes across thousands of samples. A linear scan over the ranges
  you have already seen at that site answers almost every sample, and it never
  builds the substring. Genotypes of four characters or fewer, which covers
  every diploid call an ordinary VCF spells out, pack whole into one integer, so
  spotting a repeat is a single integer comparison.
- **Do not close over mutated primitives on the hot path.** jbrowse's allele
  counter accumulates into an object instead of into captured local variables. A
  closure that mutates a captured primitive forces V8 to allocate a `Context` on
  the per-sample callback. Its non-callback twin does use plain locals, which
  are faster there. The two versions are not duplicated by accident.

The layer underneath this one covers the index, the chunks, the decompression,
and the line scan that produces the strings you pass to `parseLine`. That is
[tabix-js's own optimizations doc](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md).

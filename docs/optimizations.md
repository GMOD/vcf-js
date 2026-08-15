# Optimizations

Why the parser looks the way it does. Every method is documented in
[api.md](api.md); this is the reasoning behind them.

**The premise:** in a many-sample VCF the line is almost entirely sample columns
— a 2504-sample 1000 Genomes record is a couple hundred bytes of variant and
tens of kilobytes of genotypes. So: touch only what the caller asked for, and
walk it without allocating per sample.

## Parsing a line

### Only the first nine columns are split

`new Variant(line, ...)` counts tabs to the ninth, then slices and splits just
that prefix. Sample columns are never split or sliced; the constructor keeps
`line` plus `restStart`/`restEnd` offsets. A 3000-sample line costs about what a
sites-only line costs.

Fewer than nine tabs means no sample columns: `restStart` lands at or past
`restEnd`, so every scan below reports nothing rather than needing a special
case.

### The line terminator is stripped once, up front

Splitting a CRLF file on `\n` leaves a `\r` that would otherwise make a GT read
as `0/0\r`. The constructor trims it before anything else, so no downstream scan
has to think about it.

### INFO is the one eager cost

INFO is a column, not sample data, and typing it needs header metadata only the
parser holds — so it is parsed even for a `CHROM`/`POS` scan. Two things keep
the bill down: percent-decoding is skipped unless the raw string contains `%`,
and a value with no comma skips `split()`.

## Reading sample data

Nothing below runs until you call a sample method. Cost per sample:

| method                  | allocates per sample                    |
| ----------------------- | --------------------------------------- |
| `processGenotypes()`    | nothing — indices into the line         |
| `processFormatFields()` | nothing — indices into the line         |
| `GENOTYPES()`           | one string                              |
| `SAMPLES()`             | one object plus an array per FORMAT key |

The two `process*` methods report each value as a `(start, end)` range plus the
line itself, so a caller that only needs to _classify_ a genotype never
materializes the substring.

### The scans walk the flat line, not a `rest` slice

`Variant` used to hold `rest = line.slice(restStart, restEnd)`. In V8 that is a
`SlicedString`, and every `charCodeAt` on one pays an extra unwrap — which is
the entire operation these scans consist of. Passing the flat line with offsets
measured **1.3x** on a 3202-sample record. `rest` survives as a getter.

Reported offsets are into whatever string was passed, so `str.slice(start, end)`
in a consumer is unaffected.

### Long hops use `indexOf`; short ones deliberately don't

- Once GT is read, the rest of the sample is dead weight — on the 1000G shape
  (`GT:AB:AD:DP:GQ:PGT:PID:PL`, ~30 chars/sample) that's most of the line.
  `indexOf('\t')` skips it with V8's vectorized memchr: **2.3x** over walking
  byte by byte. `processFormatFields` takes the same hop once every requested
  key is answered: **1.7x** on `GT:PS:AD:DP:GQ:PL` asked for GT and PS.
- Short scans keep `charCodeAt` loops on purpose. Reading GT itself, and the
  `format === 'GT'` fast path, have nothing to skip, and the call costs more
  than it saves — **0.86x**. Same lesson tabix-js records in
  [ADR 0003](https://github.com/GMOD/tabix-js/blob/main/agent-docs/adr/0003-keep-indexof-based-byte-scans.md):
  bytes touched does not predict time.
- `indexOf` searches to the end of the whole string, so every hit is clamped
  back to `restEnd`.

### FORMAT columns are located once, and matched exactly

The column index of GT (or of each requested key) is computed from the FORMAT
string once per record, not per sample. Matching is by exact length and
characters, so GATK's `PGT` and `PID` are not mistaken for `GT` or `ID` by a
substring test.

### One pass per sample, however many keys you ask for

`processFormatFields` closes out whichever requested keys land on each colon as
it walks, so five fields cost the same walk as one. Bounds come back in a single
`Int32Array` reused for every sample — scratch, read inside the callback, not
retained.

If FORMAT declares none of the requested keys, the callback never fires at all,
matching `processGenotypes` on a GT-less record.

### `SAMPLES()` is the fallback, and it prices like one

It parses every field of every sample into an object with an array per FORMAT
key. Two fields from a 2504-sample `GT:AD:DP:GQ:PL` set: **1985ms / 2095MB**,
against **180ms / 1MB** through `processFormatFields`. It also re-parses on
every call — call it once and keep the result. Single-valued fields, the common
case, skip `split()`, which is the bulk of the remaining cost.

### A sample that stops short still gets a callback

When a sample's fields end before the requested column, the callback fires with
an empty range (or `-1` bounds) rather than being skipped. That is what makes
`sampleIdx` trustworthy: it always tracks the header's sample order, so a
consumer must key off it rather than counting callbacks.

## What the consumer has to do

The parser can only make sample data cheap to _reach_. What
[jbrowse-components](https://github.com/GMOD/jbrowse-components) does, as the
worked example:

- **One parser per file, constructed from the header once.** The header parse —
  INFO/FORMAT/ALT/FILTER metadata plus a sample list running to thousands of
  names — is per file, not per record. The sample names array is
  identity-stable, which downstream code uses to detect two features from the
  same header.
- **Read named fields through `processFormatFields`, never `SAMPLES()`.**
  Phase-set coloring needs GT and PS; reaching PS through the samples object
  parses every other FORMAT field of every sample to get there. On a 100-sample
  phased long-read callset over 2k variants: 343ms / 239MB per fetch against
  33ms / 4MB; at 500 samples, 1686ms / 1.17GB against 113ms / 4MB.
- **Fuse the passes into one callback.** Genotypes used to cross the RPC
  boundary as a `Record<sampleName, genotype>` built by `GENOTYPES()`, then
  walked three more times — legend flags, cell colors, transfer encoding. Four
  traversals and F×S string allocations for a payload the worker only ships as
  integer codes. Doing it all in one `processGenotypes` callback took
  analyze-plus-paint from **613ms to 168ms** on 2504 samples × 400 variants —
  and the 168ms includes painting the 613ms did not.
- **Memoize per site, not globally.** A site carries a handful of distinct
  genotypes across thousands of samples, so a linear scan over ranges already
  seen at this site answers almost every sample without materializing its
  substring. Genotypes of four characters or fewer — every diploid call an
  ordinary VCF spells — pack whole into one int, so recognizing a repeat is one
  integer compare.
- **Don't close over mutated primitives on the hot path.** The allele counter
  accumulates into an object, because a closure mutating a captured primitive
  forces a V8 `Context` allocation on the per-sample callback. The non-callback
  version uses plain locals, which are faster there. Not accidental duplication.
- **Key off `sampleIdx`, not a running counter** — see above.
- **Don't retain `Variant`s from a many-sample file.** A `Variant` holds its
  whole input line, which is what makes the lazy scans possible. Streaming is
  fine; collecting a region into an array keeps every line in memory.
  Serializing a feature (`toJSON`) is the one operation that materializes
  everything.

The read path underneath — index, chunks, decompression, and the line scan that
feeds `parseLine` — is
[tabix-js's own optimizations doc](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md).

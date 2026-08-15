# Optimizations

Why the parser looks the way it does. Every method it exposes is documented in
[api.md](api.md); this is the argument behind them.

One fact shapes all of it: in a many-sample VCF the line is almost entirely
sample columns. A 2504-sample 1000 Genomes record is a couple of hundred bytes
of variant and tens of kilobytes of genotypes. So the parser's job is to touch
as little of that as the caller actually asked for, and — where the caller does
want it — to walk it without allocating per sample.

## Parsing a line

### Only the first nine columns are split

`new Variant(line, ...)` counts tabs until the ninth, then slices and splits
just that prefix. The sample columns are never split, never sliced, and never
looked at; the constructor keeps the whole `line` plus `restStart`/`restEnd`
offsets marking where they begin and end. Parsing a line from a 3000-sample file
therefore costs about what parsing a sites-only line costs.

A line with fewer than nine tabs has no sample columns at all, and then
`restStart` lands at or past `restEnd`, so every scan below reports nothing
rather than needing a special case.

### The line terminator is stripped once, up front

A caller that splits a CRLF file on `\n` leaves a `\r` behind, which would
otherwise end up inside the last field and make a GT read as `0/0\r`. The
constructor trims trailing CR/LF before it does anything else, so no downstream
scan has to think about it.

### INFO is the one eager cost

INFO is parsed for every line whether or not you read it — it is a column, not
sample data, and typing it needs the header metadata that only the parser holds.
Files with large INFO columns pay that even for a `CHROM`/`POS` scan. Two things
keep the bill down: percent-decoding is skipped entirely unless the raw string
contains a `%`, and a value with no comma skips `split()`.

## Reading sample data

Nothing below runs until you call one of the four sample methods. What they
cost, per sample:

| method                  | allocates per sample                    |
| ----------------------- | --------------------------------------- |
| `processGenotypes()`    | nothing — indices into the line         |
| `processFormatFields()` | nothing — indices into the line         |
| `GENOTYPES()`           | one string                              |
| `SAMPLES()`             | one object plus an array per FORMAT key |

The two `process*` methods report each value as a `(start, end)` range into the
line and hand you the line itself, so a caller that only needs to _classify_ a
genotype — count alleles, decide a color — never materializes the substring.

### The scans walk the flat line, not a `rest` slice

`Variant` used to hold `rest = line.slice(restStart, restEnd)`. In V8 that is a
`SlicedString`, and every `charCodeAt` on one pays an extra unwrap — which is
the entire operation these scans consist of. Passing the flat line through with
offsets instead measured **1.3x** on a 3202-sample record. `rest` survives as a
getter, materializing only for a caller that asks.

The offsets the callbacks report are into whatever string was passed, so
`str.slice(start, end)` in a consumer is unaffected by this.

### Long hops use `indexOf`; short ones deliberately don't

Once GT has been read out of a sample, the rest of that sample is dead weight —
on the 1000G shape (`GT:AB:AD:DP:GQ:PGT:PID:PL`, ~30 characters a sample) it is
most of the line. `indexOf('\t')` skips it with V8's vectorized memchr, and that
branch measured **2.3x** against walking the same bytes one at a time.
`processFormatFields` takes the same hop once every requested key is answered:
**1.7x** on a `GT:PS:AD:DP:GQ:PL` record asked for GT and PS.

The short scans keep their `charCodeAt` loops on purpose. Reading GT itself, and
the whole `format === 'GT'` fast path, have nothing to skip, and there the call
costs more than it saves — measured **0.86x**. This is the same lesson tabix-js
records for `Uint8Array` scans in its
[ADR 0003](https://github.com/GMOD/tabix-js/blob/main/agent-docs/adr/0003-keep-indexof-based-byte-scans.md):
bytes touched does not predict time.

`indexOf` searches to the end of the whole string, so every hit is clamped back
to `restEnd` — a consequence of handing the scans the whole line rather than a
slice of it.

### FORMAT columns are located once, and matched exactly

The column index of GT (or of each requested key) is computed from the FORMAT
string once per record, not per sample. Matching is by exact length and
characters, so GATK's `PGT` and `PID` are not mistaken for `GT` or `ID` by a
substring test.

### One pass per sample, however many keys you ask for

`processFormatFields` closes out whichever requested keys land on each colon as
it walks, so asking for five fields costs the same walk as asking for one. The
bounds come back in a single `Int32Array` that is reused for every sample —
scratch, to be read inside the callback rather than retained.

If FORMAT declares none of the requested keys, the callback never fires at all,
matching `processGenotypes` on a GT-less record.

### `SAMPLES()` is the fallback, and it prices like one

It parses every field of every sample into an object with an array per FORMAT
key. Reading two fields that way from a 2504-sample `GT:AD:DP:GQ:PL` set
measured **1985ms and 2095MB**, against **180ms and 1MB** for the same two
fields through `processFormatFields`. It also re-parses on every call, so a
caller that does want it should call it once and keep the result.

What keeps it from being worse: single-valued fields — the common case — skip
`split()`, which is the bulk of the method's remaining cost.

### A sample that stops short still gets a callback

When a sample's colon-separated fields end before the requested column, the
callback fires with an empty range (or `-1` bounds) rather than being skipped.
That is what makes `sampleIdx` trustworthy: it always tracks the header's sample
order, and a consumer must key off it rather than counting callbacks.

## What the consumer has to do

The parser can only make sample data cheap to _reach_. Whether a consumer then
throws that away is a decision above this library. What
[jbrowse-components](https://github.com/GMOD/jbrowse-components) does, as the
worked example:

- **One parser per file, constructed from the header once** and reused for every
  line. The header parse — INFO/FORMAT/ALT/FILTER metadata, and a sample list
  that runs to thousands of names — is per file, not per record, and the sample
  names array is identity-stable, which downstream code uses to detect that two
  features came from the same header.
- **Read named fields through `processFormatFields`, never through
  `SAMPLES()`.** Phase-set coloring needs GT and PS; reaching PS through the
  samples object parses every other FORMAT field of every sample to get there.
  On a 100-sample phased long-read callset over 2k variants that is 343ms and
  239MB per fetch against 33ms and 4MB, and at 500 samples 1686ms and 1.17GB
  against 113ms and 4MB.
- **Fuse the passes into one callback.** The genotypes used to cross the RPC
  boundary as a `Record<sampleName, genotype>` per feature, built by
  `GENOTYPES()` and then walked three more times — for the legend flags, for the
  cell colors, and once more to encode it for transfer. Four traversals and F×S
  string allocations to reproduce a payload the worker only ever ships as
  integer codes. Doing all of it inside one `processGenotypes` callback took the
  analyze-plus-paint stage from **613ms to 168ms** on 2504 samples × 400
  variants — and the 168ms covers the painting the 613ms did not.
- **Memoize per site, not globally.** A site carries a handful of distinct
  genotypes across thousands of samples, so a linear scan over the ranges
  already seen at this site answers almost every sample without materializing
  its substring. Genotypes of four characters or fewer — every diploid call an
  ordinary VCF spells — pack whole into one int, so recognizing a repeat is a
  single integer compare.
- **Don't close over mutated primitives on the hot path.** The allele counter
  accumulates into an object rather than into captured locals, because a closure
  that mutates a captured primitive forces a V8 `Context` allocation on the
  per-sample callback. The non-callback version of the same counter uses plain
  locals, which are faster there. The two are not accidental duplication.
- **Key off `sampleIdx`, not a running counter** — see above.
- **Don't retain `Variant`s from a many-sample file.** A `Variant` holds its
  whole input line, which is exactly what makes the lazy scans possible.
  Streaming is fine; collecting a region's worth into an array keeps every line
  in memory. Note that serializing a feature (`toJSON`) is the one operation
  that materializes everything.

The read path underneath — index, chunks, decompression, and the line scan that
produces the strings fed to `parseLine` — is
[tabix-js's own optimizations doc](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md).

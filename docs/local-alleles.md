# Local alleles

VCF 4.5 lets a sample give its FORMAT values against a subset of the site's
alleles instead of all of them. At a site with 60 ALTs a sample that only saw
two of them writes three `LAD` values rather than 61, and six `LPL` values
rather than 1891 — `Number=G` is quadratic in the allele count, so this is the
difference between a readable file and an unreadable one once a callset grows to
many samples.

`FORMAT/LAA` names the subset, as 1-based indices into ALT. Those are already
global allele indices, since global allele 0 is REF and 1..n are the ALTs, so
the full local allele list is `[0, ...LAA]` and REF is always local allele 0.
The local-allele keys are `LAD`, `LADF`, `LADR` (`Number=LR`), `LEC`
(`Number=LA`), and `LPL`, `LGL`, `LGP`, `LPP` (`Number=LG`).

## Reading a record

`GT` is unaffected — it keeps global allele indices whether or not the record
uses local alleles, so anything that reads only genotypes needs no changes at
all.

Everything else `SAMPLES()` reports under both keys. The spec requires that
"local allele encoding can be abstracted away from the API consumer and values
accessed through their corresponding non-local key", so a consumer that has
never heard of local alleles reads `AD` and gets the right thing:

```typescript
const sample = variant.SAMPLES().NA00001!
sample.AD // from the record's AD, or expanded from its LAD
sample.PL // from the record's PL, or expanded from its LPL
sample.LAD // the local field is kept alongside
```

`decodeLocalAlleles` does the same to sample data assembled some other way.

Where a sample carries both a field and its local equivalent, the global one
wins. The spec has the pair encode identical information anyway, and offers
MISSING as the way to say which to ignore — so the test is on the value, not on
whether FORMAT declares the column: a sample whose `AD` is `.` still defers to
its `LAD`, and the sample beside it with a real `AD` does not.

## What decodes when

Decoding is lazy: each expanded field is an accessor that reconstructs on first
read and then replaces itself with the value, so a panel showing depths never
builds the likelihoods sitting beside them. Enumerating a sample (spreading it,
`Object.keys`, `JSON.stringify`) reads every key and materializes everything,
exactly what a view listing the whole sample needs.

Two costs, both incurred only by records that use local alleles. Whether to
attach the accessors at all is decided once per record from its FORMAT keys, so
a file without local fields is untouched — measured at 5000 samples, `SAMPLES()`
on a `GT:AD:DP:GQ:PL` record is unchanged. On a record that does use them,
attaching the accessors costs about 1.5x (7.9ms to 12.1ms at 5000 samples); the
getters themselves are built once for the record and shared by every sample, so
only the property slots remain rather than a closure apiece.

The second cost is the expansion, and it is why the accessors are lazy:
`Number=G` is quadratic in the allele count — a diploid 60-ALT site has 1891
genotypes against 61 for `Number=R`. Measured over
`benchmark/localAlleles.bench.ts` at 5000 samples, reading only `AD` stays flat
as the ALT count grows, while also reading `PL` does not:

| 5000 samples                               | 4 ALTs | 20 ALTs | 60 ALTs |
| ------------------------------------------ | ------ | ------- | ------- |
| `processFormatFields` + `readLocalAlleles` | 0.8ms  | 0.9ms   | 1.0ms   |
| `SAMPLES()`, reading `AD`                  | 23ms   | 26ms    | 26ms    |
| `SAMPLES()`, reading `AD` and `PL`         | 29ms   | 34ms    | 83ms    |

## Reading many samples

Even reading one field, `SAMPLES()` is ~30x the cost of scanning, because it
builds an object and an array per FORMAT key before any of this starts. Use it
for detail panels and per-record inspection, and for a whole-file pass map the
few indices you need instead. `readLocalAlleles` fills a reusable `Int32Array`
from a `processFormatFields` range, allocating nothing per sample:

```typescript
const alleles = new Int32Array(altCount + 1)
variant.processFormatFields(['LAA', 'LAD'], (str, ranges, sampleIdx) => {
  const count = readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
  // alleles[0..count) are this sample's global allele indices, REF first;
  // the k'th LAD value belongs to allele alleles[k]
})
```

For `Number=LG` fields the local-to-global permutation depends only on the
allele set and the ploidy, never on the values, so `LocalAlleleGenotypeMaps`
memoizes it across samples — it checks the last map by content before it keys
anything, which is free across the runs of identical `LAA` that real files come
in.

```typescript
const maps = new LocalAlleleGenotypeMaps()
const count = readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
const map = maps.get(alleles, count, 2)
// map[i] is the global PL index of the i'th LPL value
```

## Edge cases

Ploidy comes from the value count first, then GT. `GT` can be MISSING while the
likelihoods are not, so `localToGlobalG` solves `C(n + ploidy - 1, ploidy)`
against the field's length. A REF-only sample is the one case that cannot be
solved — it has exactly one genotype at every ploidy — and there `GT` settles
it, falling back to diploid only when `GT` is MISSING too. Guessing diploid
outright would widen a haploid chrY or chrM reference block to 15 entries where
it should have 5.

Sorting the mapped tuple is not the same question as whether `LAA` is sorted.
Two orderings get conflated here, so they are worth separating.

The first is settled: `LAA` need not ascend. The 4.5 draft did require it — "a
sorted list of n distinct integers", "the strictly increasing index into REF and
ALT" — and hts-specs commit `be3b990` deleted every such phrase before #758
merged, replacing them with "the order in which they are interpreted", a clause
it added twice. So the shipped text permits `LAA=4,2` and makes its stated order
required: local genotypes are enumerated over local _indices_, so `LAA=4,2` and
`LAA=2,4` order the same six `LPL` values differently.

The second is not a spec question at all. `Index(k1/.../kP)` is defined only for
ascending arguments, and a genotype is an unordered multiset of alleles, so
mapping local `1/2` under `LAA=4,2` to global `{4,2}` and asking for its index
means asking for the index of `2/4`. The formula requires sorting, not a reading
of anything — and where `LAA` already ascends it is a no-op.

What the spec genuinely leaves open is narrower than either, and only affects
`Number=LG`: having permitted an unsorted `LAA`, it never says how a local
genotype's alleles land in the _global_ genotype ordering. `Number=LR` and
`Number=LA` have no such gap, since they are indexed by allele identity.

bcftools 1.24 resolves it the other way — it feeds the mapped tuple to the
formula unsorted. Both samples below carry the same information, differing only
in the order `LAA` names the alleles:

```
GT:LAA:LAD:LPL  2/4:4,2:5,6,7:11,22,33,44,55,66
GT:LAA:LAD:LPL  2/4:2,4:5,7,6:11,44,66,22,55,33
```

Through `bcftools +tag2tag -- --LXX-to-XX` the `AD`s agree (`5,.,7,.,6` for
both, so bcftools does honour an unsorted `LAA` for `Number=LR`), while the
`PL`s do not: the cross term lands at global index 7 (genotype `1/3`) for the
unsorted spelling and 12 (`2/4`) for the sorted one. This implementation gives
12 for both: two spellings of one genotype decode alike.

The divergence is therefore confined to `Number=LG` fields whose `LAA` does not
ascend, and it is where the ecosystem was already unsure: pd3 called unsorted
`LAA` in DRAGEN's UK Biobank VCFs a writer bug against the draft's then-standing
ascending requirement (hts-specs#758, eight days before that requirement was
removed), while requiring sorted `LAA` had been argued against as "annoying when
merging files" (hts-specs#434).

`LAA` is not necessarily early in FORMAT. The spec says it "must precede all
fields other than GT", but `bcftools merge -L` writes it last —
`GT:LAD:LPL:GQ:LAA` — so this implementation does not depend on its position.

`GT` can name alleles outside `LAA`. `bcftools merge -L N` caps the local set at
N alts and does not narrow `GT` to match, so a truncated record can carry
`GT=3/4` with `LAA=3`.

Headers may declare `Number=.` rather than `Number=LR`/`LG` — bcftools writes
`.` — so local fields have to be recognised by key name, not by cardinality. The
reserved-key table carries the spec's cardinalities for files that declare
nothing at all.

## Test data

`test/data/local-alleles.vcf` is real `bcftools merge -L 2` output, and
`test/data/local-alleles.expanded.vcf` is that same file put back through
`bcftools +tag2tag -- --LXX-to-XX`. The test suite decodes the first and checks
it against the second, so the implementation is pinned to the reference
implementation's own expansion rather than to hand-computed values.

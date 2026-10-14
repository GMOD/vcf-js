# Local alleles

VCF 4.5 lets a sample give its FORMAT values against a subset of the site's
alleles instead of all of them. At a site with 60 ALTs a sample that only saw
two of them writes three `LAD` values rather than 61, and six `LPL` values
rather than 1891. `Number=G` is quadratic in the allele count, so the saving is
the difference between a readable file and an unreadable one once a callset
grows to many samples.

`FORMAT/LAA` names the subset, as 1-based indices into ALT. Those are already
global allele indices, since global allele 0 is REF and 1..n are the ALTs, so
the full local allele list is `[0, ...LAA]` and REF is always local allele 0.
The local-allele keys are `LAD`, `LADF`, `LADR` (`Number=LR`), `LEC`
(`Number=LA`), and `LPL`, `LGL`, `LGP`, `LPP` (`Number=LG`).

## Reading a record

`GT` keeps global allele indices whether or not the record uses local alleles,
so anything that reads only genotypes needs no changes at all.

`SAMPLES()` reports every other local field under both keys. The spec requires
that "local allele encoding can be abstracted away from the API consumer and
values accessed through their corresponding non-local key", so a consumer that
has never heard of local alleles reads `AD` and gets the global values:

```typescript
const sample = variant.SAMPLES().NA00001!
sample.AD // from the record's AD, or expanded from its LAD
sample.PL // from the record's PL, or expanded from its LPL
sample.LAD // the local field is kept alongside
```

`decodeLocalAlleles` does the same to sample data assembled some other way.

Where a sample has both a field and its local equivalent, `SAMPLES()` reports
the global one. The spec has the pair encode identical information anyway, and
offers MISSING as the way to say which to ignore. This implementation therefore
checks the value, not whether FORMAT declares the column, so a sample whose `AD`
is `.` still defers to its `LAD`, and the sample beside it with a real `AD` does
not.

## Expanded fields decode on first read, not in `SAMPLES()`

Each expanded field is a lazy accessor that reconstructs on first read and then
replaces itself with the value, so a panel showing depths never builds the
likelihoods beside them. Code that enumerates a sample (spreading it,
`Object.keys`, `JSON.stringify`) reads every key and materializes everything,
which is what a view listing the whole sample needs.

Local alleles add two costs, both incurred only by records that use them.
`SAMPLES()` decides once per record, from its FORMAT keys, whether to attach the
accessors at all, so a file without local fields is untouched — measured at 5000
samples, `SAMPLES()` on a `GT:AD:DP:GQ:PL` record is unchanged. On a record that
does use local alleles, attaching the accessors makes `SAMPLES()` about 1.5x
slower (7.9ms to 12.1ms at 5000 samples). This implementation builds the getters
once per record and shares them across every sample, so each sample adds
property slots and no closure.

The second cost is the expansion, which is why the accessors are lazy.
`Number=G` is quadratic in the allele count, and a diploid 60-ALT site has 1891
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
builds an object and an array per FORMAT key before any local-allele decoding
starts. Use it for detail panels and per-record inspection, and for a whole-file
pass map the few indices you need instead. `readLocalAlleles` fills a reusable
`Int32Array` from a `processFormatFields` range, allocating nothing per sample:

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
memoizes it across samples. Before it builds a cache key, it compares the allele
list with the last one it saw, so in the runs of identical `LAA` that real files
contain, a lookup builds no key at all.

```typescript
const maps = new LocalAlleleGenotypeMaps()
const count = readLocalAlleles(str, ranges[0]!, ranges[1]!, alleles)
const map = maps.get(alleles, count, 2)
// map[i] is the global PL index of the i'th LPL value
```

## Edge cases

Ploidy comes from the value count first, then GT. `GT` can be MISSING while the
likelihoods are not, so `localToGlobalG` solves `C(n + ploidy - 1, ploidy)`
against the field's length. That equation has no unique solution for a REF-only
sample, which has exactly one genotype at every ploidy, so there
`localToGlobalG` takes the ploidy from `GT`, falling back to diploid only when
`GT` is MISSING too. Guessing diploid outright would widen a haploid chrY or
chrM reference block to 15 entries where it should have 5.

Two orderings are easy to conflate here: whether `LAA` is sorted, and whether
the mapped tuple is sorted before indexing.

The spec settles the order of `LAA`, which need not ascend. The 4.5 draft did
require ascending order ("a sorted list of n distinct integers", "the strictly
increasing index into REF and ALT"), and hts-specs commit `be3b990` deleted
every such phrase before #758 merged, replacing them with "the order in which
they are interpreted", a clause it added twice. The shipped text therefore
permits `LAA=4,2` and makes its stated order required. Local genotypes are
enumerated over local _indices_, so `LAA=4,2` and `LAA=2,4` order the same six
`LPL` values differently.

Sorting the mapped tuple is not a spec question. `Index(k1/.../kP)` is defined
only for ascending arguments, and a genotype is an unordered multiset of
alleles, so mapping local `1/2` under `LAA=4,2` to global `{4,2}` and asking for
its index means asking for the index of `2/4`. The sort follows from the formula
rather than from any reading of the spec, and where `LAA` already ascends it is
a no-op.

The spec leaves open one question narrower than either ordering, and it affects
only `Number=LG`. Having permitted an unsorted `LAA`, the spec never says how a
local genotype's alleles map into the _global_ genotype ordering. `Number=LR`
and `Number=LA` have no such gap, since they are indexed by allele identity.

bcftools 1.24 resolves the question the other way — it feeds the mapped tuple to
the formula unsorted. Both samples below hold the same information, differing
only in the order `LAA` names the alleles:

```
GT:LAA:LAD:LPL  2/4:4,2:5,6,7:11,22,33,44,55,66
GT:LAA:LAD:LPL  2/4:2,4:5,7,6:11,44,66,22,55,33
```

Through `bcftools +tag2tag -- --LXX-to-XX` the `AD`s agree (`5,.,7,.,6` for
both, so bcftools does honour an unsorted `LAA` for `Number=LR`), while the
`PL`s do not. The cross term goes to global index 7 (genotype `1/3`) for the
unsorted spelling and 12 (`2/4`) for the sorted one. This implementation gives
12 for both: two spellings of one genotype decode alike.

The divergence is therefore confined to `Number=LG` fields whose `LAA` does not
ascend, a case the ecosystem was already unsure about. pd3 called unsorted `LAA`
in DRAGEN's UK Biobank VCFs a writer bug against the draft's then-standing
ascending requirement (hts-specs#758, eight days before that requirement was
removed), while requiring sorted `LAA` had been argued against as "annoying when
merging files" (hts-specs#434).

The spec says `LAA` "must precede all fields other than GT", but
`bcftools merge -L` writes it last (`GT:LAD:LPL:GQ:LAA`), so this implementation
does not depend on its position.

`GT` can name alleles outside `LAA`. `bcftools merge -L N` caps the local set at
N alts and does not narrow `GT` to match, so a truncated record can have
`GT=3/4` with `LAA=3`.

Headers may declare `Number=.` rather than `Number=LR`/`LG`, and bcftools writes
`.`, so this implementation recognises local fields by key name, not by
cardinality. The reserved-key table lists the spec's cardinalities for files
that declare nothing at all.

## Test data

`test/data/local-alleles.vcf` is real `bcftools merge -L 2` output, and
`test/data/local-alleles.expanded.vcf` is that same file put back through
`bcftools +tag2tag -- --LXX-to-XX`. The test suite decodes the first and checks
it against the second, so the tests hold the implementation to bcftools'
expansion rather than to hand-computed values.

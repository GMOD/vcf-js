import type { SampleData, SampleValue } from './Variant.ts'

const COMMA = 44
const SLASH = 47
const ZERO = 48
const PIPE = 124
const NINE = 57

const MAX_PLOIDY = 12

function binomial(n: number, k: number) {
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i
  }
  return result
}

/** Number of distinct genotypes over `alleleCount` alleles at `ploidy`. */
export function genotypeCount(alleleCount: number, ploidy: number) {
  return binomial(alleleCount + ploidy - 1, ploidy)
}

/**
 * Position of a genotype in the GL/PL ordering, per the spec's
 * `Index(k1/.../kP) = sum C(km + m - 1, m)`. That formula holds only for
 * ascending `alleles`, which is why every caller here sorts first: LAA may be
 * given in any order, and feeding the formula an unsorted pair silently returns
 * the index of a different genotype.
 */
export function genotypeIndex(alleles: ArrayLike<number>) {
  let index = 0
  for (let m = 0; m < alleles.length; m++) {
    index += binomial(alleles[m]! + m, m + 1)
  }
  return index
}

/**
 * Ploidy a local `Number=LG` field was written at, from its length. Undefined
 * when no ploidy fits, and when `localAlleleCount` is 1: a REF-only sample has
 * exactly one genotype at every ploidy, so its LPL cannot say which.
 */
export function ploidyForLocalGenotypes(
  localAlleleCount: number,
  valueCount: number,
) {
  let ploidy: number | undefined
  if (localAlleleCount > 1) {
    for (let p = 1; p <= MAX_PLOIDY && ploidy === undefined; p++) {
      if (genotypeCount(localAlleleCount, p) === valueCount) {
        ploidy = p
      }
    }
  }
  return ploidy
}

/**
 * Read a sample's LAA field into `out` as the full local allele list
 * `[0, ...LAA]` — REF is always local allele 0 — returning its length. LAA
 * entries are 1-based indices into ALT, which are already global allele
 * indices, so no shift is needed. A MISSING LAA yields `[0]`, the REF-only
 * site the spec calls for.
 *
 * Takes a range rather than a string so the per-sample loop under
 * `processFormatFields` allocates nothing; `out` is scratch, sized once at
 * `ALT.length + 1` and reused for every sample.
 */
export function readLocalAlleles(
  str: string,
  start: number,
  end: number,
  out: Int32Array,
) {
  out[0] = 0
  let count = 1
  if (start >= 0 && end > start) {
    let value = 0
    let digits = 0
    for (let i = start; i <= end; i++) {
      const c = i === end ? COMMA : str.charCodeAt(i)
      if (c === COMMA) {
        if (digits > 0 && count < out.length) {
          out[count] = value
          count++
        }
        value = 0
        digits = 0
      } else if (c >= ZERO && c <= NINE) {
        value = value * 10 + (c - ZERO)
        digits++
      } else {
        // '.' is the MISSING entry, anything else is malformed; either way the
        // partially read number is dropped rather than half-counted
        digits = 0
      }
    }
  }
  return count
}

/**
 * Map from local genotype index to global genotype index for one local allele
 * set. Depends only on the alleles and the ploidy, never on the values, so a
 * caller reading many samples should build it once per distinct LAA — that is
 * what `LocalAlleleGenotypeMaps` is for.
 */
export function localGenotypeMap(
  alleles: ArrayLike<number>,
  localAlleleCount: number,
  ploidy: number,
) {
  const map = new Int32Array(genotypeCount(localAlleleCount, ploidy))
  const tuple = new Int32Array(ploidy)
  const globals = new Int32Array(ploidy)
  let next = 0
  const recurse = (m: number, max: number) => {
    if (m === 0) {
      for (let i = 0; i < ploidy; i++) {
        globals[i] = alleles[tuple[i]!]!
      }
      globals.sort()
      map[next] = genotypeIndex(globals)
      next++
    } else {
      for (let a = 0; a <= max; a++) {
        tuple[m - 1] = a
        recurse(m - 1, a)
      }
    }
  }
  recurse(ploidy, localAlleleCount - 1)
  return map
}

/**
 * Memoizes `localGenotypeMap` across samples. Long runs of samples share a
 * local allele set, so the last map is checked by content first and the Map
 * behind it is only consulted — and only keyed, which is the sole allocation
 * here — when that run ends.
 */
export class LocalAlleleGenotypeMaps {
  private cache = new Map<string, Int32Array>()
  private lastAlleles: Int32Array = new Int32Array(0)
  private lastCount = -1
  private lastPloidy = -1
  private lastMap: Int32Array = new Int32Array(0)

  get(alleles: Int32Array, localAlleleCount: number, ploidy: number) {
    let hit = localAlleleCount === this.lastCount && ploidy === this.lastPloidy
    for (let i = 0; hit && i < localAlleleCount; i++) {
      hit = this.lastAlleles[i] === alleles[i]
    }
    if (!hit) {
      let key = `${ploidy}`
      for (let i = 0; i < localAlleleCount; i++) {
        key += `,${alleles[i]}`
      }
      let map = this.cache.get(key)
      if (map === undefined) {
        map = localGenotypeMap(alleles, localAlleleCount, ploidy)
        this.cache.set(key, map)
      }
      this.lastAlleles = alleles.slice(0, localAlleleCount)
      this.lastCount = localAlleleCount
      this.lastPloidy = ploidy
      this.lastMap = map
    }
    return this.lastMap
  }
}

/** The local allele list `[0, ...LAA]` from an already-parsed LAA value. */
export function localAlleles(laa: SampleValue) {
  const alleles = [0]
  if (laa) {
    for (const entry of laa) {
      const value = typeof entry === 'string' ? Number(entry) : entry
      if (value !== undefined && Number.isInteger(value)) {
        alleles.push(value)
      }
    }
  }
  return alleles
}

/** Expand a `Number=LR` field (LAD, LADF, LADR) to its `Number=R` form. */
export function localToGlobalR(
  values: SampleValue,
  alleles: ArrayLike<number>,
  alleleCount: number,
) {
  const out = new Array<string | number | undefined>(alleleCount).fill(
    undefined,
  )
  if (values) {
    const len = Math.min(values.length, alleles.length)
    for (let i = 0; i < len; i++) {
      const global = alleles[i]!
      if (global < alleleCount) {
        out[global] = values[i]
      }
    }
  }
  return out
}

/**
 * Expand a `Number=LA` field (LEC) to its `Number=A` form. An A field is
 * indexed over ALT alone, so allele `g` lands at `g - 1`, and the local list's
 * leading REF has no slot at all.
 */
export function localToGlobalA(
  values: SampleValue,
  alleles: ArrayLike<number>,
  altCount: number,
) {
  const out = new Array<string | number | undefined>(altCount).fill(undefined)
  if (values) {
    const len = Math.min(values.length, alleles.length - 1)
    for (let i = 0; i < len; i++) {
      const global = alleles[i + 1]!
      if (global >= 1 && global - 1 < altCount) {
        out[global - 1] = values[i]
      }
    }
  }
  return out
}

/**
 * Expand a `Number=LG` field (LPL, LGL, LGP, LPP) to its `Number=G` form.
 * Ploidy is read off the value count where it can be, since GT may be MISSING
 * while the likelihoods are not; `ploidyHint` settles the REF-only case that
 * carries one value at every ploidy.
 */
export function localToGlobalG(
  values: SampleValue,
  alleles: ArrayLike<number>,
  alleleCount: number,
  ploidyHint: number | undefined = 2,
) {
  const localCount = alleles.length
  const ploidy =
    ploidyForLocalGenotypes(localCount, values ? values.length : 0) ??
    ploidyHint
  const out = new Array<string | number | undefined>(
    genotypeCount(alleleCount, ploidy),
  ).fill(undefined)
  if (values) {
    const map = localGenotypeMap(alleles, localCount, ploidy)
    const len = Math.min(values.length, map.length)
    for (let i = 0; i < len; i++) {
      const global = map[i]!
      if (global < out.length) {
        out[global] = values[i]
      }
    }
  }
  return out
}

const LOCAL_R = { LAD: 'AD', LADF: 'ADF', LADR: 'ADR' }
const LOCAL_A = { LEC: 'EC' }
const LOCAL_G = { LPL: 'PL', LGL: 'GL', LGP: 'GP', LPP: 'PP' }

const LOCAL_KEYS = new Set([
  ...Object.keys(LOCAL_R),
  ...Object.keys(LOCAL_A),
  ...Object.keys(LOCAL_G),
])

/** Whether any of a record's FORMAT keys is a local-allele field. */
export function hasLocalAlleleFields(formatKeys: string[]) {
  return formatKeys.some(key => LOCAL_KEYS.has(key))
}

/**
 * Ploidy of a parsed GT, by counting its allele separators. Used only to settle
 * a `Number=LG` field whose own length cannot: a REF-only sample has exactly one
 * genotype at every ploidy, so its LPL says nothing, and a diploid guess would
 * expand a haploid chrY or chrM record to the wrong width.
 */
function ploidyFromGenotype(gt: SampleValue) {
  const value = gt === undefined ? undefined : gt[0]
  let ploidy: number | undefined
  if (typeof value === 'string' && value.length > 0) {
    ploidy = 1
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i)
      if (c === SLASH || c === PIPE) {
        ploidy++
      }
    }
  }
  return ploidy
}

export interface LocalAlleleField {
  local: string
  global: string
  descriptor: PropertyDescriptor
}

/**
 * The accessors a record's local-allele fields need, built once for the record
 * and then attached to each sample. Every sample shares these getters — they
 * read the sample through `this` rather than through a capture — so a record
 * with many samples allocates no closures here, only the property slots.
 *
 * Each getter replaces itself with the value it computed, which both memoizes
 * it and leaves an ordinary data property behind.
 */
export function localAlleleFields(formatKeys: string[], altCount: number) {
  const alleleCount = altCount + 1
  const fields: LocalAlleleField[] = []
  const add = (
    local: string,
    global: string,
    compute: (
      sample: SampleData,
      values: SampleValue,
      list: number[],
    ) => SampleValue,
  ) => {
    if (formatKeys.includes(local)) {
      fields.push({
        local,
        global,
        descriptor: {
          configurable: true,
          enumerable: true,
          get(this: SampleData) {
            const value = compute(this, this[local], localAlleles(this.LAA))
            Object.defineProperty(this, global, {
              configurable: true,
              enumerable: true,
              writable: true,
              value,
            })
            return value
          },
          set(this: SampleData, value: SampleValue) {
            Object.defineProperty(this, global, {
              configurable: true,
              enumerable: true,
              writable: true,
              value,
            })
          },
        },
      })
    }
  }
  for (const [local, global] of Object.entries(LOCAL_R)) {
    add(local, global, (sample, values, list) =>
      localToGlobalR(values, list, alleleCount),
    )
  }
  for (const [local, global] of Object.entries(LOCAL_A)) {
    add(local, global, (sample, values, list) =>
      localToGlobalA(values, list, altCount),
    )
  }
  for (const [local, global] of Object.entries(LOCAL_G)) {
    add(local, global, (sample, values, list) =>
      localToGlobalG(values, list, alleleCount, ploidyFromGenotype(sample.GT)),
    )
  }
  return fields
}

/**
 * Attach a record's local-allele accessors to one sample.
 *
 * A global field the sample already carries wins over the local one it
 * duplicates — the spec has them encode identical information anyway — but the
 * test is on the value rather than the key, since the escape hatch it offers is
 * for one of the pair to be MISSING, and a MISSING field still has a FORMAT
 * column and so still has a key. That makes this per-sample rather than
 * per-record: one sample can carry a real AD while the next leaves it MISSING
 * and means its LAD.
 */
export function applyLocalAlleleFields(
  sample: SampleData,
  fields: LocalAlleleField[],
) {
  for (const { local, global, descriptor } of fields) {
    if (sample[local] !== undefined && sample[global] === undefined) {
      Object.defineProperty(sample, global, descriptor)
    }
  }
}

/**
 * The abstraction the spec asks libraries to provide: one sample's local-allele
 * fields reported under their non-local keys, against the record's full allele
 * list. Local keys are kept alongside.
 *
 * `SAMPLES()` already applies this to a record whose FORMAT declares local
 * fields, so reach for it only on sample data assembled some other way.
 *
 * Each expanded field is reconstructed on first read rather than up front. A
 * `Number=G` field costs `C(alleleCount + ploidy - 1, ploidy)` entries — 1891 of
 * them for a diploid 60-ALT site — and a caller reading depths should not pay
 * for likelihoods it never looks at. Enumerating the result (spreading it,
 * `Object.values`, `JSON.stringify`) reads every key and so materializes
 * everything, which is what a panel listing the whole sample wants anyway.
 */
export function decodeLocalAlleles(sample: SampleData, altCount: number) {
  const out: SampleData = { ...sample }
  applyLocalAlleleFields(out, localAlleleFields(Object.keys(sample), altCount))
  return out
}

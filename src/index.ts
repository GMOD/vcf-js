export { Variant } from './Variant.ts'
export type { SampleData, SampleValue, Samples } from './Variant.ts'
export type { GenotypeCallback } from './processGenotypes.ts'
export type { FormatFieldsCallback } from './processFormatFields.ts'
export type { InfoValue, MetaField, MetaMap } from './parseInfo.ts'
// The local-allele surface a consumer needs. The genotype-ordering maths behind
// them (genotypeIndex, localGenotypeMap, ploidyForLocalGenotypes and the field
// wiring SAMPLES() uses) stays internal to ./localAlleles.ts.
export {
  LocalAlleleGenotypeMaps,
  decodeLocalAlleles,
  localAlleles,
  localToGlobalA,
  localToGlobalG,
  localToGlobalR,
  readLocalAlleles,
} from './localAlleles.ts'

export { default } from './parse.ts'
export * from './parseBreakend.ts'

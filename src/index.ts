export { Variant } from './Variant.ts'
export type { SampleData, SampleValue, Samples } from './Variant.ts'
export type { GenotypeCallback } from './processGenotypes.ts'
export type { FormatFieldsCallback } from './processFormatFields.ts'
export type { InfoValue, MetaField, MetaMap } from './parseInfo.ts'
export {
  LocalAlleleGenotypeMaps,
  decodeLocalAlleles,
  genotypeCount,
  genotypeIndex,
  localAlleles,
  localGenotypeMap,
  localToGlobalA,
  localToGlobalG,
  localToGlobalR,
  ploidyForLocalGenotypes,
  readLocalAlleles,
} from './localAlleles.ts'

export { default } from './parse.ts'
export * from './parseBreakend.ts'

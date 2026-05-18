import { processGenotypes } from './processGenotypes.ts'

export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = Object.create(null) as Record<string, string>
  processGenotypes(format, prerest, samples.length, (str, start, end, idx) => {
    genotypes[samples[idx] ?? ''] = str.slice(start, end)
  })
  return genotypes
}

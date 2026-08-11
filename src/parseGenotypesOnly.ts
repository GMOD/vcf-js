import { processGenotypes } from './processGenotypes.ts'

export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
  from = 0,
  to = prerest.length,
) {
  const genotypes = Object.create(null) as Record<string, string>
  processGenotypes(
    format,
    prerest,
    samples.length,
    (str, start, end, idx) => {
      genotypes[samples[idx] ?? ''] = str.slice(start, end)
    },
    from,
    to,
  )
  return genotypes
}

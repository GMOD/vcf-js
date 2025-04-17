export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  const rest = prerest.split('\t')
  const genotypes = {} as Record<string, string>
  const len = samples.length
  if (format.includes('GT')) {
    if (format === 'GT') {
      for (let i = 0; i < len; i++) {
        genotypes[samples[i]!] = rest[i]!
      }
    } else {
      if (format.startsWith('GT')) {
        for (let i = 0; i < len; i++) {
          const idx = rest[i]!.indexOf(':')
          genotypes[samples[i]!] =
            idx !== -1 ? rest[i]!.slice(0, idx) : rest[i]!
        }
      } else {
        // according to vcf spec, GT should be first, so shouldn't even get
        // here, but just added to beware
        const formatSplit = format.split(':')
        const gtIndex = formatSplit.indexOf('GT')
        for (let i = 0; i < len; i++) {
          const val = rest[i]!.split(':')
          genotypes[samples[i]!] = val[gtIndex]!
        }
      }
    }
  }

  return genotypes
}

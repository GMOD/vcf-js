export function parseGenotypesOnly(
  format: string,
  prerest: string,
  samples: string[],
) {
  const rest = prerest.split('\t')
  const genotypes = {} as Record<string, string>
  let i = 0
  if (format.includes('GT')) {
    const formatSplit = format.split(':')
    if (formatSplit.length === 1) {
      for (const sample of samples) {
        genotypes[sample] = rest[i++]!
      }
    } else {
      const gtIndex = formatSplit.indexOf('GT')
      if (gtIndex === 0) {
        for (const sample of samples) {
          const idx = rest[i++]!.indexOf(':')
          genotypes[sample] = idx !== -1 ? rest[i++]!.slice(0, idx) : rest[i++]!
        }
      } else {
        for (const sample of samples) {
          const val = rest[i++]!.split(':')
          genotypes[sample] = val[gtIndex]!
        }
      }
    }
  }

  return genotypes
}

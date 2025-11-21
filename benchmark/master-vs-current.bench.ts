import { bench, describe } from 'vitest'
import { parseGenotypesOnly as currentVersion } from '../src/parseGenotypesOnly'

function parseGenotypesOnlyMaster(
  format: string,
  prerest: string,
  samples: string[],
) {
  const genotypes = {} as Record<string, string>
  const gtIdx = format.indexOf('GT')
  if (gtIdx === -1) {
    return genotypes
  }

  const rest = prerest.split('\t')
  let i = 0

  if (format.length === 2) {
    for (const sample of samples) {
      genotypes[sample] = rest[i++]!
    }
  } else if (gtIdx === 0) {
    for (const sample of samples) {
      const val = rest[i++]!
      const colonIdx = val.indexOf(':')
      genotypes[sample] = colonIdx !== -1 ? val.slice(0, colonIdx) : val
    }
  } else {
    let colonCount = 0
    for (let j = 0; j < gtIdx; j++) {
      if (format[j] === ':') colonCount++
    }
    for (const sample of samples) {
      const val = rest[i++]!
      let colons = 0
      let start = 0
      for (let j = 0; j <= val.length; j++) {
        if (j === val.length || val[j] === ':') {
          if (colons === colonCount) {
            genotypes[sample] = val.slice(start, j)
            break
          }
          colons++
          start = j + 1
        }
      }
    }
  }

  return genotypes
}

function generateTestData(numSamples: number, format: string) {
  const samples = Array.from({ length: numSamples }, (_, i) => `SAMPLE_${i}`)

  let genotypeData: string
  if (format === 'GT') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  } else if (format === 'GT:DP:GQ') {
    genotypeData = Array.from({ length: numSamples }, () => '0/1:23:99').join(
      '\t',
    )
  } else if (format === 'DP:GQ:GT') {
    genotypeData = Array.from({ length: numSamples }, () => '23:99:0/1').join(
      '\t',
    )
  } else {
    genotypeData = Array.from({ length: numSamples }, () => '0/1').join('\t')
  }

  return { samples, genotypeData, format }
}

describe('10 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(10, 'GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('10 samples - GT:DP:GQ', () => {
  const { samples, genotypeData, format } = generateTestData(10, 'GT:DP:GQ')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('10 samples - DP:GQ:GT', () => {
  const { samples, genotypeData, format } = generateTestData(10, 'DP:GQ:GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('100 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('100 samples - GT:DP:GQ', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'GT:DP:GQ')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('100 samples - DP:GQ:GT', () => {
  const { samples, genotypeData, format } = generateTestData(100, 'DP:GQ:GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('1000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('1000 samples - GT:DP:GQ', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'GT:DP:GQ')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('1000 samples - DP:GQ:GT', () => {
  const { samples, genotypeData, format } = generateTestData(1000, 'DP:GQ:GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('5000 samples - GT only', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('5000 samples - GT:DP:GQ', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'GT:DP:GQ')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

describe('5000 samples - DP:GQ:GT', () => {
  const { samples, genotypeData, format } = generateTestData(5000, 'DP:GQ:GT')

  bench(
    'master',
    () => {
      parseGenotypesOnlyMaster(format, genotypeData, samples)
    },
    { time: 1000 },
  )

  bench(
    'current',
    () => {
      currentVersion(format, genotypeData, samples)
    },
    { time: 1000 },
  )
})

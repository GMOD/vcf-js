import fs from 'fs'
import { createGunzip } from 'zlib'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runBenchmark(vcfModule, label) {
  return new Promise((resolve, reject) => {
    const VCF = vcfModule.default || vcfModule
    const startTime = process.hrtime.bigint()

    const rl = readline.createInterface({
      input: fs.createReadStream(process.argv[2]).pipe(createGunzip()),
    })

    let header = []
    let elts = []
    let parser = undefined
    let lineCount = 0

    rl.on('line', function (line) {
      if (line.startsWith('#')) {
        header.push(line)
        return
      } else if (!parser) {
        parser = new VCF({ header: header.join('\n') })
      }
      const elt = parser.parseLine(line)
      elts.push(elt.INFO.AN[0])
      lineCount++
    })

    rl.on('close', function () {
      const endTime = process.hrtime.bigint()
      const durationMs = Number(endTime - startTime) / 1_000_000
      const avg = elts.reduce((a, b) => a + b, 0) / elts.length

      resolve({
        label,
        durationMs,
        lineCount,
        avg,
      })
    })

    rl.on('error', reject)
  })
}

async function main() {
  if (!process.argv[2]) {
    console.error('Usage: node benchmark.js <vcf.gz file>')
    console.error(
      'Example: node benchmark.js /home/cdiesh/data/1kg.chr1.subset.vcf.gz',
    )
    process.exit(1)
  }

  const vcfFile = process.argv[2]
  if (!fs.existsSync(vcfFile)) {
    console.error(`File not found: ${vcfFile}`)
    process.exit(1)
  }

  console.log('VCF Parser Performance Benchmark')
  console.log('=================================')
  console.log(`File: ${vcfFile}`)
  console.log()

  // Check if both versions exist
  const optimizedPath = path.join(__dirname, 'esm', 'index.js')
  const masterPath = path.join(__dirname, 'esm-master', 'index.js')

  if (!fs.existsSync(optimizedPath)) {
    console.error(`Optimized build not found at: ${optimizedPath}`)
    console.error('Run: yarn build')
    process.exit(1)
  }

  if (!fs.existsSync(masterPath)) {
    console.error(`Master build not found at: ${masterPath}`)
    console.error('Run the setup script first to build master branch')
    process.exit(1)
  }

  // Run benchmarks
  console.log('Running benchmark with MASTER version...')
  const masterResult = await runBenchmark(await import(masterPath), 'master')

  console.log('Running benchmark with OPTIMIZED version...')
  const optimizedResult = await runBenchmark(
    await import(optimizedPath),
    'optimized',
  )

  // Display results
  console.log()
  console.log('Results:')
  console.log('--------')
  console.log(`Master:`)
  console.log(`  Lines parsed: ${masterResult.lineCount}`)
  console.log(`  Time: ${masterResult.durationMs.toFixed(2)} ms`)
  console.log(`  Avg value: ${masterResult.avg.toFixed(2)}`)
  console.log()
  console.log(`Optimized:`)
  console.log(`  Lines parsed: ${optimizedResult.lineCount}`)
  console.log(`  Time: ${optimizedResult.durationMs.toFixed(2)} ms`)
  console.log(`  Avg value: ${optimizedResult.avg.toFixed(2)}`)
  console.log()

  const speedup =
    ((masterResult.durationMs - optimizedResult.durationMs) /
      masterResult.durationMs) *
    100
  const faster = optimizedResult.durationMs < masterResult.durationMs

  console.log('Summary:')
  console.log('--------')
  if (faster) {
    console.log(
      `✅ Optimized version is ${Math.abs(speedup).toFixed(2)}% FASTER`,
    )
    console.log(
      `   (${masterResult.durationMs.toFixed(2)} ms → ${optimizedResult.durationMs.toFixed(2)} ms)`,
    )
  } else {
    console.log(
      `⚠️  Optimized version is ${Math.abs(speedup).toFixed(2)}% SLOWER`,
    )
    console.log(
      `   (${masterResult.durationMs.toFixed(2)} ms → ${optimizedResult.durationMs.toFixed(2)} ms)`,
    )
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})

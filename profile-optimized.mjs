import fs from 'fs'
import { createGunzip } from 'zlib'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import inspector from 'inspector'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  if (!process.argv[2]) {
    console.error('Usage: node profile-optimized.mjs <vcf.gz file>')
    console.error(
      'Example: node profile-optimized.mjs /home/cdiesh/data/1kg.chr1.subset.vcf.gz',
    )
    process.exit(1)
  }

  const vcfFile = process.argv[2]
  if (!fs.existsSync(vcfFile)) {
    console.error(`File not found: ${vcfFile}`)
    process.exit(1)
  }

  const optimizedPath = path.join(__dirname, 'esm', 'index.js')
  if (!fs.existsSync(optimizedPath)) {
    console.error(`Optimized build not found at: ${optimizedPath}`)
    console.error('Run: yarn build:esm')
    process.exit(1)
  }

  console.log('Profiling OPTIMIZED version')
  console.log('===========================')
  console.log(`File: ${vcfFile}`)
  console.log()

  const session = new inspector.Session()
  session.connect()

  // Start profiling
  session.post('Profiler.enable')
  session.post('Profiler.start')

  const vcfModule = await import(optimizedPath)
  const VCF = vcfModule.default || vcfModule

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(vcfFile).pipe(createGunzip()),
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
      // Stop profiling
      session.post('Profiler.stop', (err, { profile }) => {
        session.disconnect()

        if (err) {
          reject(err)
          return
        }

        // Write profile to file
        const outputFile = 'profile-optimized.cpuprofile'
        fs.writeFileSync(outputFile, JSON.stringify(profile))

        const avg = elts.reduce((a, b) => a + b, 0) / elts.length
        console.log(`✅ Profiling complete`)
        console.log(`   Lines parsed: ${lineCount}`)
        console.log(`   Average value: ${avg.toFixed(2)}`)
        console.log(`   Profile saved to: ${outputFile}`)
        console.log()
        console.log('Analyze with:')
        console.log('  - Chrome DevTools: chrome://inspect -> Load profile')
        console.log('  - speedscope: https://www.speedscope.app/')

        resolve()
      })
    })

    rl.on('error', reject)
  })
}

main().catch(err => {
  console.error('Profiling failed:', err)
  process.exit(1)
})

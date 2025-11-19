import fs from 'fs'

const profilePath = process.argv[2] || 'profile-optimized.cpuprofile'
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))

// Extract nodes from the profile
const nodes = profile.nodes

// Build function name lookup
const strings = profile.strings || []

// Calculate self time and total time for each node
const nodeStats = nodes.map((node, index) => {
  const functionName =
    strings[node.callFrame.functionName] ||
    node.callFrame.functionName ||
    '(anonymous)'
  const url = strings[node.callFrame.url] || node.callFrame.url || ''
  const lineNumber = node.callFrame.lineNumber
  const columnNumber = node.callFrame.columnNumber

  // Get self time (time spent in this function, not in callees)
  const selfTime = node.hitCount || 0

  return {
    id: node.id,
    functionName,
    url,
    lineNumber,
    columnNumber,
    selfTime,
    children: node.children || [],
  }
})

// Filter to only VCF-related functions and sort by self time
const vcfFunctions = nodeStats
  .filter(
    node =>
      node.url.includes('vcf-js') &&
      !node.url.includes('node_modules') &&
      node.selfTime > 0,
  )
  .sort((a, b) => b.selfTime - a.selfTime)

console.log('CPU Profile Analysis - Top Hotspots')
console.log('====================================\n')

const totalSamples = nodeStats.reduce((sum, node) => sum + node.selfTime, 0)
console.log(`Total samples: ${totalSamples}\n`)

console.log('Top 20 functions by self time:\n')
vcfFunctions.slice(0, 20).forEach((node, index) => {
  const percentage = ((node.selfTime / totalSamples) * 100).toFixed(2)
  const urlParts = node.url.split('/')
  const file = urlParts[urlParts.length - 1]

  console.log(`${index + 1}. ${node.functionName}`)
  console.log(`   File: ${file}:${node.lineNumber}:${node.columnNumber}`)
  console.log(`   Self time: ${node.selfTime} samples (${percentage}%)`)
  console.log()
})

// Also show all functions grouped by file
console.log('\nHotspots grouped by file:\n')
const byFile = {}
vcfFunctions.forEach(node => {
  const urlParts = node.url.split('/')
  const file = urlParts[urlParts.length - 1]
  if (!byFile[file]) {
    byFile[file] = []
  }
  byFile[file].push(node)
})

Object.entries(byFile)
  .sort((a, b) => {
    const aTotal = a[1].reduce((sum, n) => sum + n.selfTime, 0)
    const bTotal = b[1].reduce((sum, n) => sum + n.selfTime, 0)
    return bTotal - aTotal
  })
  .forEach(([file, functions]) => {
    const total = functions.reduce((sum, n) => sum + n.selfTime, 0)
    const percentage = ((total / totalSamples) * 100).toFixed(2)
    console.log(`${file}: ${total} samples (${percentage}%)`)
    functions.slice(0, 5).forEach(node => {
      const pct = ((node.selfTime / totalSamples) * 100).toFixed(2)
      console.log(
        `  - ${node.functionName}:${node.lineNumber} - ${node.selfTime} samples (${pct}%)`,
      )
    })
    console.log()
  })

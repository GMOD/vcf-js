const fs = require('fs')

const profile = JSON.parse(
  fs.readFileSync('profile-optimized.cpuprofile', 'utf8'),
)

// Extract nodes and build a map
const nodes = profile.nodes || []
const samples = profile.samples || []
const timeDeltas = profile.timeDeltas || []

// Count samples per function
const functionTime = new Map()
const functionHitCount = new Map()

// Build function name map
const functionNames = []
for (const node of nodes) {
  const funcName = node.callFrame
    ? `${node.callFrame.functionName || '(anonymous)'} [${node.callFrame.url}:${node.callFrame.lineNumber}]`
    : '(unknown)'
  functionNames[node.id] = funcName
}

// Count samples
for (let i = 0; i < samples.length; i++) {
  const nodeId = samples[i]
  const funcName = functionNames[nodeId] || '(unknown)'
  const timeDelta = timeDeltas[i] || 0

  functionTime.set(funcName, (functionTime.get(funcName) || 0) + timeDelta)
  functionHitCount.set(funcName, (functionHitCount.get(funcName) || 0) + 1)
}

// Sort by time
const sorted = Array.from(functionTime.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)

console.log('\n=== Top 30 Functions by CPU Time ===\n')
console.log('Time (μs)   | Samples | Function')
console.log(
  '------------|---------|----------------------------------------------------',
)

for (const [func, time] of sorted) {
  const hitCount = functionHitCount.get(func)
  const timeStr = time.toString().padStart(11)
  const hitStr = hitCount.toString().padStart(7)

  // Truncate long function names
  let displayFunc = func
  if (displayFunc.length > 50) {
    displayFunc = displayFunc.substring(0, 47) + '...'
  }

  console.log(`${timeStr} | ${hitStr} | ${displayFunc}`)
}

const totalTime = Array.from(functionTime.values()).reduce((a, b) => a + b, 0)
console.log('\nTotal CPU time:', (totalTime / 1000).toFixed(2), 'ms')

// Find VCF-specific functions
console.log('\n=== VCF Parser Functions ===\n')
const vcfFunctions = sorted.filter(
  ([func]) =>
    func.includes('parse') ||
    func.includes('Parse') ||
    func.includes('VCF') ||
    func.includes('vcf'),
)

console.log('% Time     | Time (μs)  | Function')
console.log(
  '-----------|------------|----------------------------------------------------',
)
for (const [func, time] of vcfFunctions.slice(0, 15)) {
  const hitCount = functionHitCount.get(func)
  const percentage = ((time / totalTime) * 100).toFixed(2)
  let displayFunc = func
  if (displayFunc.length > 50) {
    displayFunc = displayFunc.substring(0, 47) + '...'
  }
  console.log(
    `${percentage.padStart(6)}% | ${time.toString().padStart(10)} | ${displayFunc}`,
  )
}

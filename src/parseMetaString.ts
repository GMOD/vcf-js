// constructed with the assistance of claude AI
//
// I first prompted it with a regex that splits a comma separated string with
// awareness of quotation from this stackoverflow queston
// https://stackoverflow.com/a/18893443/2129219, and asked it to add support
// for square brackets
//
// the result was this function
function customSplit(str: string) {
  const result = []
  let current = ''
  let inQuotes = false
  let inBrackets = false

  for (const char of str) {
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === '[') {
      inBrackets = true
      current += char
    } else if (char === ']') {
      inBrackets = false
      current += char
    } else if (char === ',' && !inQuotes && !inBrackets) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    result.push(current.trim())
  }

  return result
}

export function parseMetaString(metaString: string) {
  const inside = metaString.replace(/^<|>$/g, '')
  return Object.fromEntries(
    customSplit(inside).map(f => {
      const [key, val] = f.split('=').map(f => f.trim())
      if (val && val.startsWith('[') && val.endsWith(']')) {
        return [
          key,
          val
            .slice(1, -1)
            .split(',')
            .map(f => f.trim()),
        ]
      } else if (val && val.startsWith('"') && val.endsWith('"')) {
        return [key, val.slice(1, -1)]
      } else {
        return [key, val?.replaceAll(/^"|"$/g, '')]
      }
    }),
  )
}
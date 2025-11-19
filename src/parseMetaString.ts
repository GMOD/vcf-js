// constructed with the assistance of claude AI
//
// I first prompted it with a regex that splits a comma separated string with
// awareness of quotation from this stackoverflow question
// https://stackoverflow.com/a/18893443/2129219, and asked it to add support
// for square brackets
//
// it undid the regex into serial logic and the result was this function
function customSplit(str: string) {
  const result = []
  let current = ''
  let inQuotes = false
  let inBrackets = false
  const strLen = str.length

  for (let i = 0; i < strLen; i++) {
    const char = str[i]!
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

function splitFirst(str: string, split: string) {
  const index = str.indexOf(split)
  return [str.slice(0, index), str.slice(index + 1)]
}

export function parseMetaString(metaString: string) {
  const inside = metaString.replace(/^<|>$/g, '')
  const parts = customSplit(inside)
  const entries: [string, any][] = []
  for (let i = 0; i < parts.length; i++) {
    const f = parts[i]!
    const [key, val] = splitFirst(f, '=')
    if (val && val.startsWith('[') && val.endsWith(']')) {
      const items = val.slice(1, -1).split(',')
      const trimmed: string[] = []
      for (let j = 0; j < items.length; j++) {
        trimmed.push(items[j]!.trim())
      }
      entries.push([key, trimmed])
    } else if (val && val.startsWith('"') && val.endsWith('"')) {
      entries.push([key, val.slice(1, -1)])
    } else {
      entries.push([key, val?.replaceAll(/^"|"$/g, '')])
    }
  }
  return Object.fromEntries(entries)
}

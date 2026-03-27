function customSplit(str: string) {
  const result = []
  const chars = []
  let inQuotes = false
  let inBrackets = false
  const strLen = str.length

  for (let i = 0; i < strLen; i++) {
    const char = str[i]!
    if (char === '"') {
      inQuotes = !inQuotes
      chars.push(char)
    } else if (char === '[') {
      inBrackets = true
      chars.push(char)
    } else if (char === ']') {
      inBrackets = false
      chars.push(char)
    } else if (char === ',' && !inQuotes && !inBrackets) {
      result.push(chars.join('').trim())
      chars.length = 0
    } else {
      chars.push(char)
    }
  }

  if (chars.length > 0) {
    result.push(chars.join('').trim())
  }

  return result
}

function splitFirst(str: string, split: string) {
  const index = str.indexOf(split)
  return [str.slice(0, index), str.slice(index + 1)] as const
}

export function parseMetaString(metaString: string) {
  const inside = metaString.slice(1, -1)
  const parts = customSplit(inside)
  const entries: [string, string | string[]][] = []
  for (const f of parts) {
    const [key, val] = splitFirst(f, '=')
    if (val && val.startsWith('[') && val.endsWith(']')) {
      entries.push([
        key,
        val
          .slice(1, -1)
          .split(',')
          .map(s => s.trim()),
      ])
    } else if (val && val.startsWith('"') && val.endsWith('"')) {
      entries.push([key, val.slice(1, -1)])
    } else {
      entries.push([key, val])
    }
  }
  return Object.fromEntries(entries)
}

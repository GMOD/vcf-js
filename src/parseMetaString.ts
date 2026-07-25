// Split on commas that are not inside quotes or square brackets
function customSplit(str: string) {
  const result = []
  let inQuotes = false
  let inBrackets = false
  let start = 0
  const strLen = str.length

  for (let i = 0; i < strLen; i++) {
    const char = str[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === '[') {
      inBrackets = true
    } else if (char === ']') {
      inBrackets = false
    } else if (char === ',' && !inQuotes && !inBrackets) {
      result.push(str.slice(start, i).trim())
      start = i + 1
    }
  }

  if (start < strLen) {
    result.push(str.slice(start).trim())
  }

  return result
}

function splitFirst(str: string, split: string) {
  const index = str.indexOf(split)
  return index === -1
    ? ([str, ''] as const)
    : ([str.slice(0, index), str.slice(index + 1)] as const)
}

export function parseStructuredMetaVal(metaVal: string) {
  const keyVals: Record<string, string | string[] | number> =
    parseMetaString(metaVal)
  const id = keyVals.ID
  delete keyVals.ID
  if ('Number' in keyVals) {
    const n = Number(keyVals.Number)
    if (!Number.isNaN(n)) {
      keyVals.Number = n
    }
  }
  return [id, keyVals] as const
}

export function parseMetaString(metaString: string) {
  const inside = metaString.slice(1, -1)
  const parts = customSplit(inside)
  const result: Record<string, string | string[]> = {}
  for (const f of parts) {
    const [key, val] = splitFirst(f, '=')
    if (val && val.startsWith('[') && val.endsWith(']')) {
      result[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim())
    } else if (val && val.startsWith('"') && val.endsWith('"')) {
      result[key] = val.slice(1, -1)
    } else {
      result[key] = val
    }
  }
  return result
}

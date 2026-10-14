// The VCF spec's only escapes inside a quoted value; any other backslash is a
// literal, as in Description="matches \d+"
function isEscape(str: string, i: number) {
  const next = str[i + 1]
  return str[i] === '\\' && (next === '"' || next === '\\')
}

// Split on commas outside double quotes and square brackets. Returns undefined
// when honouring escapes leaves a quote open, as a pre-4.3 value ending in an
// unescaped backslash ("C:\data\") does.
function splitTopLevel(str: string, escapes: boolean) {
  const result = []
  let inQuotes = false
  let inBrackets = false
  let start = 0
  const strLen = str.length

  for (let i = 0; i < strLen; i++) {
    const char = str[i]
    if (inQuotes) {
      if (escapes && isEscape(str, i)) {
        i++
      } else if (char === '"') {
        inQuotes = false
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === '[') {
      inBrackets = true
    } else if (char === ']') {
      inBrackets = false
    } else if (char === ',' && !inBrackets) {
      result.push(str.slice(start, i).trim())
      start = i + 1
    }
  }

  if (start < strLen) {
    result.push(str.slice(start).trim())
  }

  return escapes && inQuotes ? undefined : result
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
  const escaped = splitTopLevel(inside, true)
  const result: Record<string, string | string[]> = {}
  for (const f of escaped ?? splitTopLevel(inside, false) ?? []) {
    const eq = f.indexOf('=')
    const key = eq === -1 ? f : f.slice(0, eq)
    const val = eq === -1 ? '' : f.slice(eq + 1)
    if (val.startsWith('[') && val.endsWith(']')) {
      result[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim())
    } else if (val.length > 1 && val.startsWith('"') && val.endsWith('"')) {
      const quoted = val.slice(1, -1)
      result[key] = escaped ? quoted.replaceAll(/\\(["\\])/g, '$1') : quoted
    } else {
      result[key] = val
    }
  }
  return result
}

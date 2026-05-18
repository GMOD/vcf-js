function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch {
    return uri
  }
}

export function parseInfo(
  infoStr: string,
  infoMeta: Record<string, { Type?: string }>,
) {
  const result: Record<string, unknown> = {}
  const hasDecode = infoStr.includes('%')
  const infoPairs = infoStr.split(';')
  const pairsLen = infoPairs.length

  for (let i = 0; i < pairsLen; i++) {
    const pair = infoPairs[i] ?? ''
    const eqIdx = pair.indexOf('=')
    const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx)
    const val = eqIdx === -1 ? undefined : pair.slice(eqIdx + 1)
    const itemType = infoMeta[key]?.Type

    if (itemType === 'Flag' || !val) {
      result[key] = true
    } else {
      const isNumber = itemType === 'Integer' || itemType === 'Float'
      const rawItems = val.split(',')
      const itemsLen = rawItems.length

      const items: (string | number | undefined)[] = []
      for (let j = 0; j < itemsLen; j++) {
        const v = rawItems[j] ?? ''
        if (v === '.') {
          items.push(undefined)
        } else {
          const w = hasDecode ? decodeURIComponentNoThrow(v) : v
          items.push(isNumber ? Number(w) : w)
        }
      }
      result[key] = items
    }
  }
  return result
}

export function parseMetaString(metaString: string) {
  return Object.fromEntries(
    [
      // split string on comma except when in square bracket
      // https://stackoverflow.com/questions/74238461/
      ...metaString.replace(/^<|>$/g, '').matchAll(/(?:\[[^\][]*\]|[^,])+/g),
    ].map(f => {
      const [key, val] = f[0].split('=').map(f => f.trim())
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
        return [key, val]
      }
    }),
  )
}

export function appendSuffixToFileName(name: string, suffix: string) {
  if (!suffix) return name
  const dot = name.lastIndexOf('.')
  if (dot === -1) return `${name}${suffix}`
  const base = name.slice(0, dot)
  const ext = name.slice(dot)
  return `${base}${suffix}${ext}`
}

export default appendSuffixToFileName

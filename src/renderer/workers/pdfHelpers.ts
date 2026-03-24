/** Convert a hex color string to a [0-1, 0-1, 0-1] RGB tuple for MuPDF. */
export function hexToColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

/** Compute an axis-aligned bounding box from MuPDF quad arrays. */
export function quadsToBbox(hitQuads: number[][]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const quad of hitQuads) {
    for (let i = 0; i < quad.length; i += 2) {
      minX = Math.min(minX, quad[i])
      minY = Math.min(minY, quad[i + 1])
      maxX = Math.max(maxX, quad[i])
      maxY = Math.max(maxY, quad[i + 1])
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

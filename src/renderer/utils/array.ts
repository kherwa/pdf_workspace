/** Move an item from startIndex to finishIndex, returning a new array. */
export function reorder<T>(list: T[], startIndex: number, finishIndex: number): T[] {
  const result = [...list]
  const [removed] = result.splice(startIndex, 1)
  result.splice(finishIndex, 0, removed)
  return result
}

/** Create a 1-based page order array: [1, 2, ..., numPages] */
export function createPageOrder(numPages: number): number[] {
  return Array.from({ length: numPages }, (_, i) => i + 1)
}

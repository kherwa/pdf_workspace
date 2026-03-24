import { reorder, createPageOrder } from './array'

describe('reorder', () => {
  it('moves item forward', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves item backward', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('is no-op when indices are equal', () => {
    expect(reorder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('works with single-element array', () => {
    expect(reorder(['x'], 0, 0)).toEqual(['x'])
  })

  it('returns a new array (does not mutate)', () => {
    const original = [1, 2, 3]
    const result = reorder(original, 0, 2)
    expect(result).not.toBe(original)
    expect(original).toEqual([1, 2, 3])
  })
})

describe('createPageOrder', () => {
  it('creates 1-based page array', () => {
    expect(createPageOrder(5)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns empty array for 0 pages', () => {
    expect(createPageOrder(0)).toEqual([])
  })

  it('returns [1] for a single page', () => {
    expect(createPageOrder(1)).toEqual([1])
  })
})

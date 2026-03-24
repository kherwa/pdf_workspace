import { hasOrganiseChanges } from './useMenuEvents'
import { makeTab } from './useFileSystem'

describe('hasOrganiseChanges', () => {
  it('returns false for a fresh tab with default order and no rotations', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 5 })
    expect(hasOrganiseChanges(tab)).toBe(false)
  })

  it('returns true when page order differs (reordered)', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 3 })
    tab.pageOrder = [3, 1, 2]
    expect(hasOrganiseChanges(tab)).toBe(true)
  })

  it('returns true when pages have been deleted (shorter pageOrder)', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 5 })
    tab.pageOrder = [1, 3, 5]
    expect(hasOrganiseChanges(tab)).toBe(true)
  })

  it('returns true when any rotation is non-zero', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 3 })
    tab.rotations = { 2: 90 }
    expect(hasOrganiseChanges(tab)).toBe(true)
  })

  it('returns false when all rotations are explicitly 0', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 3 })
    tab.rotations = { 1: 0, 2: 0, 3: 0 }
    expect(hasOrganiseChanges(tab)).toBe(false)
  })

  it('returns true when both order and rotations are changed', () => {
    const tab = makeTab({ id: 't', fileName: 'a.pdf', numPages: 3 })
    tab.pageOrder = [2, 1, 3]
    tab.rotations = { 1: 180 }
    expect(hasOrganiseChanges(tab)).toBe(true)
  })
})

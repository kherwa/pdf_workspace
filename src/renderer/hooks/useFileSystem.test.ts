import { makeTab } from './useFileSystem'

describe('makeTab', () => {
  it('returns a tab with all defaults populated', () => {
    const tab = makeTab({ id: 'tab-1', fileName: 'test.pdf', numPages: 3 })
    expect(tab.currentPage).toBe(1)
    expect(tab.scale).toBe(1.0)
    expect(tab.editMode).toBe(false)
    expect(tab.activeTool).toBeNull()
    expect(tab.activeColor).toBe('#f59e0b')
    expect(tab.isLoading).toBe(false)
    expect(tab.rotations).toEqual({})
    expect(tab.annotations).toEqual({})
    expect(tab.redactions).toEqual({})
  })

  it('sets fileHandle to null by default', () => {
    const tab = makeTab({ id: 'tab-1', fileName: 'a.pdf', numPages: 1 })
    expect(tab.fileHandle).toBeNull()
    expect(tab.filePath).toBeNull()
  })

  it('creates correct pageOrder from numPages', () => {
    const tab = makeTab({ id: 'tab-1', fileName: 'a.pdf', numPages: 4 })
    expect(tab.pageOrder).toEqual([1, 2, 3, 4])
  })

  it('applies overrides', () => {
    const tab = makeTab({ id: 'tab-1', fileName: 'a.pdf', numPages: 2, scale: 2.5, isLoading: true })
    expect(tab.scale).toBe(2.5)
    expect(tab.isLoading).toBe(true)
    expect(tab.id).toBe('tab-1')
  })

  it('preserves required fields', () => {
    const tab = makeTab({ id: 'my-id', fileName: 'doc.pdf', numPages: 10 })
    expect(tab.id).toBe('my-id')
    expect(tab.fileName).toBe('doc.pdf')
    expect(tab.numPages).toBe(10)
  })
})

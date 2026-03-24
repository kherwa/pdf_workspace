import { reducer, initialState } from './AppContext'
import { makeTab } from '../hooks/useFileSystem'
import type { AppState, Tab, MergeSource, Action } from '../types/app'
import type { HighlightAnnotation, RedactionAnnotation } from '../types/annotations'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function testTab(overrides: Partial<Tab> = {}): Tab {
  return makeTab({ id: 'tab-1', fileName: 'test.pdf', numPages: 5, ...overrides })
}

function stateWithTab(tabOverrides: Partial<Tab> = {}): AppState {
  const tab = testTab(tabOverrides)
  return { ...initialState, tabs: [tab], activeTabId: tab.id, drawerView: 'all' }
}

function stateWithTwoTabs(): AppState {
  const t1 = testTab({ id: 'tab-1', fileName: 'a.pdf' })
  const t2 = testTab({ id: 'tab-2', fileName: 'b.pdf' })
  return { ...initialState, tabs: [t1, t2], activeTabId: 'tab-2', drawerView: 'all' }
}

function makeAnnotation(id: string): HighlightAnnotation {
  return { id, type: 'highlight', page: 1, x: 0, y: 0, width: 100, height: 20, color: '#ff0', opacity: 0.4 }
}

function makeRedaction(id: string): RedactionAnnotation {
  return { id, type: 'redaction', page: 1, x: 0, y: 0, width: 100, height: 20 }
}

/* ── Tab Lifecycle ────────────────────────────────────────────────────── */

describe('OPEN_TAB', () => {
  it('adds tab to state.tabs', () => {
    const tab = testTab()
    const next = reducer(initialState, { type: 'OPEN_TAB', payload: tab })
    expect(next.tabs).toHaveLength(1)
    expect(next.tabs[0]).toBe(tab)
  })

  it('sets activeTabId to the new tab', () => {
    const tab = testTab()
    const next = reducer(initialState, { type: 'OPEN_TAB', payload: tab })
    expect(next.activeTabId).toBe(tab.id)
  })

  it('switches drawerView from home to all', () => {
    const state = { ...initialState, drawerView: 'home' as const }
    const next = reducer(state, { type: 'OPEN_TAB', payload: testTab() })
    expect(next.drawerView).toBe('all')
  })

  it('does not change drawerView when already non-home', () => {
    const state = { ...initialState, drawerView: 'edit' as const }
    const next = reducer(state, { type: 'OPEN_TAB', payload: testTab() })
    expect(next.drawerView).toBe('edit')
  })
})

describe('CLOSE_TAB', () => {
  it('removes the specified tab', () => {
    const state = stateWithTwoTabs()
    const next = reducer(state, { type: 'CLOSE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.tabs).toHaveLength(1)
    expect(next.tabs[0].id).toBe('tab-2')
  })

  it('activates last remaining tab when closing the active tab', () => {
    const state = stateWithTwoTabs() // activeTabId = tab-2
    const next = reducer(state, { type: 'CLOSE_TAB', payload: { tabId: 'tab-2' } })
    expect(next.activeTabId).toBe('tab-1')
  })

  it('sets activeTabId to null when closing the only tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'CLOSE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.activeTabId).toBeNull()
  })

  it('resets mode and drawerView when closing last tab', () => {
    const state = { ...stateWithTab(), mode: 'organise' as const, drawerView: 'edit' as const }
    const next = reducer(state, { type: 'CLOSE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.mode).toBe('view')
    expect(next.drawerView).toBe('home')
  })

  it('keeps activeTabId unchanged when closing a non-active tab', () => {
    const state = stateWithTwoTabs() // activeTabId = tab-2
    const next = reducer(state, { type: 'CLOSE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.activeTabId).toBe('tab-2')
  })
})

describe('SET_ACTIVE_TAB', () => {
  it('sets activeTabId', () => {
    const state = stateWithTwoTabs()
    const next = reducer(state, { type: 'SET_ACTIVE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.activeTabId).toBe('tab-1')
  })

  it('switches drawerView from home to all when setting a non-null tab', () => {
    const state = { ...stateWithTwoTabs(), drawerView: 'home' as const }
    const next = reducer(state, { type: 'SET_ACTIVE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.drawerView).toBe('all')
  })

  it('does not change drawerView from edit', () => {
    const state = { ...stateWithTwoTabs(), drawerView: 'edit' as const }
    const next = reducer(state, { type: 'SET_ACTIVE_TAB', payload: { tabId: 'tab-1' } })
    expect(next.drawerView).toBe('edit')
  })
})

describe('UPDATE_TAB', () => {
  it('merges partial payload into matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'UPDATE_TAB', payload: { tabId: 'tab-1', numPages: 10, isLoading: false } })
    expect(next.tabs[0].numPages).toBe(10)
    expect(next.tabs[0].isLoading).toBe(false)
  })

  it('does not modify other tabs', () => {
    const state = stateWithTwoTabs()
    const next = reducer(state, { type: 'UPDATE_TAB', payload: { tabId: 'tab-1', scale: 3 } })
    expect(next.tabs[1].scale).toBe(1.0) // tab-2 unchanged
  })
})

/* ── Page / Scale ─────────────────────────────────────────────────────── */

describe('SET_PAGE', () => {
  it('sets currentPage on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'SET_PAGE', payload: { tabId: 'tab-1', page: 3 } })
    expect(next.tabs[0].currentPage).toBe(3)
  })

  it('does not modify other tabs', () => {
    const state = stateWithTwoTabs()
    const next = reducer(state, { type: 'SET_PAGE', payload: { tabId: 'tab-1', page: 5 } })
    expect(next.tabs[1].currentPage).toBe(1)
  })
})

describe('SET_SCALE', () => {
  it('sets scale on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'SET_SCALE', payload: { tabId: 'tab-1', scale: 2.5 } })
    expect(next.tabs[0].scale).toBe(2.5)
  })

  it('does not modify other tabs', () => {
    const state = stateWithTwoTabs()
    const next = reducer(state, { type: 'SET_SCALE', payload: { tabId: 'tab-1', scale: 0.5 } })
    expect(next.tabs[1].scale).toBe(1.0)
  })
})

/* ── Edit Mode ────────────────────────────────────────────────────────── */

describe('SET_EDIT_MODE', () => {
  it('sets editMode on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'SET_EDIT_MODE', payload: { tabId: 'tab-1', editMode: true } })
    expect(next.tabs[0].editMode).toBe(true)
  })

  it('clears activeTool when changing edit mode', () => {
    const state = stateWithTab({ activeTool: 'highlight' })
    const next = reducer(state, { type: 'SET_EDIT_MODE', payload: { tabId: 'tab-1', editMode: false } })
    expect(next.tabs[0].activeTool).toBeNull()
  })
})

describe('SET_ACTIVE_TOOL', () => {
  it('sets activeTool on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'SET_ACTIVE_TOOL', payload: { tabId: 'tab-1', tool: 'freehand' } })
    expect(next.tabs[0].activeTool).toBe('freehand')
  })
})

describe('SET_COLOR', () => {
  it('sets activeColor on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'SET_COLOR', payload: { tabId: 'tab-1', color: '#ff0000' } })
    expect(next.tabs[0].activeColor).toBe('#ff0000')
  })
})

/* ── Annotations ──────────────────────────────────────────────────────── */

describe('ADD_ANNOTATION', () => {
  it('creates annotation array for a new page', () => {
    const state = stateWithTab()
    const ann = makeAnnotation('a1')
    const next = reducer(state, { type: 'ADD_ANNOTATION', payload: { tabId: 'tab-1', page: 1, ann } })
    expect(next.tabs[0].annotations[1]).toEqual([ann])
  })

  it('appends to existing annotations on the page', () => {
    const ann1 = makeAnnotation('a1')
    const state = stateWithTab({ annotations: { 1: [ann1] } })
    const ann2 = makeAnnotation('a2')
    const next = reducer(state, { type: 'ADD_ANNOTATION', payload: { tabId: 'tab-1', page: 1, ann: ann2 } })
    expect(next.tabs[0].annotations[1]).toHaveLength(2)
    expect(next.tabs[0].annotations[1][1]).toBe(ann2)
  })

  it('does not affect other pages', () => {
    const state = stateWithTab({ annotations: { 2: [makeAnnotation('a1')] } })
    const next = reducer(state, { type: 'ADD_ANNOTATION', payload: { tabId: 'tab-1', page: 1, ann: makeAnnotation('a2') } })
    expect(next.tabs[0].annotations[2]).toHaveLength(1)
  })
})

describe('UNDO_ANNOTATION', () => {
  it('removes the last annotation', () => {
    const state = stateWithTab({ annotations: { 1: [makeAnnotation('a1'), makeAnnotation('a2')] } })
    const next = reducer(state, { type: 'UNDO_ANNOTATION', payload: { tabId: 'tab-1', page: 1 } })
    expect(next.tabs[0].annotations[1]).toHaveLength(1)
    expect(next.tabs[0].annotations[1][0].id).toBe('a1')
  })

  it('returns empty array when undoing the only annotation', () => {
    const state = stateWithTab({ annotations: { 1: [makeAnnotation('a1')] } })
    const next = reducer(state, { type: 'UNDO_ANNOTATION', payload: { tabId: 'tab-1', page: 1 } })
    expect(next.tabs[0].annotations[1]).toEqual([])
  })

  it('handles undo on a page with no annotations', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'UNDO_ANNOTATION', payload: { tabId: 'tab-1', page: 99 } })
    expect(next.tabs[0].annotations[99]).toEqual([])
  })
})

/* ── Organise ─────────────────────────────────────────────────────────── */

describe('REORDER_PAGES', () => {
  it('replaces pageOrder on matching tab', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'REORDER_PAGES', payload: { tabId: 'tab-1', newOrder: [5, 4, 3, 2, 1] } })
    expect(next.tabs[0].pageOrder).toEqual([5, 4, 3, 2, 1])
  })
})

describe('ROTATE_PAGE', () => {
  it('adds rotation delta', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'ROTATE_PAGE', payload: { tabId: 'tab-1', page: 1, delta: 90 } })
    expect(next.tabs[0].rotations[1]).toBe(90)
  })

  it('accumulates rotations', () => {
    const state = stateWithTab({ rotations: { 1: 90 } })
    const next = reducer(state, { type: 'ROTATE_PAGE', payload: { tabId: 'tab-1', page: 1, delta: 90 } })
    expect(next.tabs[0].rotations[1]).toBe(180)
  })

  it('wraps 360 back to 0', () => {
    const state = stateWithTab({ rotations: { 1: 270 } })
    const next = reducer(state, { type: 'ROTATE_PAGE', payload: { tabId: 'tab-1', page: 1, delta: 90 } })
    expect(next.tabs[0].rotations[1]).toBe(0)
  })

  it('handles negative delta (counter-clockwise)', () => {
    const state = stateWithTab({ rotations: {} })
    const next = reducer(state, { type: 'ROTATE_PAGE', payload: { tabId: 'tab-1', page: 1, delta: -90 } })
    expect(next.tabs[0].rotations[1]).toBe(270)
  })
})

describe('DELETE_PAGES', () => {
  it('removes specified pages from pageOrder', () => {
    const state = stateWithTab() // pageOrder = [1,2,3,4,5]
    const next = reducer(state, { type: 'DELETE_PAGES', payload: { tabId: 'tab-1', pages: [2, 4] } })
    expect(next.tabs[0].pageOrder).toEqual([1, 3, 5])
  })

  it('does not remove pages not in the list', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'DELETE_PAGES', payload: { tabId: 'tab-1', pages: [99] } })
    expect(next.tabs[0].pageOrder).toEqual([1, 2, 3, 4, 5])
  })
})

/* ── Redactions ────────────────────────────────────────────────────────── */

describe('ADD_REDACTION', () => {
  it('adds redaction rect to specified page', () => {
    const state = stateWithTab()
    const rect = makeRedaction('r1')
    const next = reducer(state, { type: 'ADD_REDACTION', payload: { tabId: 'tab-1', page: 1, rect } })
    expect(next.tabs[0].redactions[1]).toEqual([rect])
  })

  it('creates page array for first redaction', () => {
    const state = stateWithTab()
    const rect = makeRedaction('r1')
    const next = reducer(state, { type: 'ADD_REDACTION', payload: { tabId: 'tab-1', page: 3, rect } })
    expect(next.tabs[0].redactions[3]).toHaveLength(1)
  })
})

describe('UNDO_REDACTION', () => {
  it('removes the last redaction', () => {
    const state = stateWithTab({ redactions: { 1: [makeRedaction('r1'), makeRedaction('r2')] } })
    const next = reducer(state, { type: 'UNDO_REDACTION', payload: { tabId: 'tab-1', page: 1 } })
    expect(next.tabs[0].redactions[1]).toHaveLength(1)
  })

  it('handles empty page', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'UNDO_REDACTION', payload: { tabId: 'tab-1', page: 1 } })
    expect(next.tabs[0].redactions[1]).toEqual([])
  })
})

describe('CLEAR_REDACTIONS', () => {
  it('resets redactions to empty object', () => {
    const state = stateWithTab({ redactions: { 1: [makeRedaction('r1')], 2: [makeRedaction('r2')] } })
    const next = reducer(state, { type: 'CLEAR_REDACTIONS', payload: { tabId: 'tab-1' } })
    expect(next.tabs[0].redactions).toEqual({})
  })
})

/* ── Merge ─────────────────────────────────────────────────────────────── */

describe('ADD_MERGE_SOURCE', () => {
  it('appends source to mergeSources', () => {
    const src: MergeSource = { tabId: 'tab-1', fileName: 'a.pdf', numPages: 5, selectedPages: [1, 2, 3, 4, 5] }
    const next = reducer(initialState, { type: 'ADD_MERGE_SOURCE', payload: { source: src } })
    expect(next.mergeSources).toHaveLength(1)
    expect(next.mergeSources[0]).toBe(src)
  })
})

describe('REMOVE_MERGE_SOURCE', () => {
  it('removes source with matching tabId', () => {
    const src: MergeSource = { tabId: 'tab-1', fileName: 'a.pdf', numPages: 5, selectedPages: [1, 2] }
    const state = { ...initialState, mergeSources: [src] }
    const next = reducer(state, { type: 'REMOVE_MERGE_SOURCE', payload: { tabId: 'tab-1' } })
    expect(next.mergeSources).toHaveLength(0)
  })
})

describe('REORDER_MERGE', () => {
  it('replaces mergeSources with provided array', () => {
    const s1: MergeSource = { tabId: 'tab-1', fileName: 'a.pdf', numPages: 3, selectedPages: [1, 2, 3] }
    const s2: MergeSource = { tabId: 'tab-2', fileName: 'b.pdf', numPages: 2, selectedPages: [1, 2] }
    const next = reducer(initialState, { type: 'REORDER_MERGE', payload: { sources: [s2, s1] } })
    expect(next.mergeSources[0].tabId).toBe('tab-2')
    expect(next.mergeSources[1].tabId).toBe('tab-1')
  })
})

describe('TOGGLE_MERGE_PAGE', () => {
  it('adds page to selectedPages if not present', () => {
    const src: MergeSource = { tabId: 'tab-1', fileName: 'a.pdf', numPages: 3, selectedPages: [1, 2] }
    const state = { ...initialState, mergeSources: [src] }
    const next = reducer(state, { type: 'TOGGLE_MERGE_PAGE', payload: { tabId: 'tab-1', page: 3 } })
    expect(next.mergeSources[0].selectedPages).toEqual([1, 2, 3])
  })

  it('removes page from selectedPages if already present', () => {
    const src: MergeSource = { tabId: 'tab-1', fileName: 'a.pdf', numPages: 3, selectedPages: [1, 2, 3] }
    const state = { ...initialState, mergeSources: [src] }
    const next = reducer(state, { type: 'TOGGLE_MERGE_PAGE', payload: { tabId: 'tab-1', page: 2 } })
    expect(next.mergeSources[0].selectedPages).toEqual([1, 3])
  })
})

/* ── Settings ─────────────────────────────────────────────────────────── */

describe('SET_COMPRESSION', () => {
  it('merges partial settings into compression', () => {
    const next = reducer(initialState, { type: 'SET_COMPRESSION', payload: { imageQuality: 50 } })
    expect(next.compression.imageQuality).toBe(50)
  })

  it('does not overwrite unrelated settings', () => {
    const next = reducer(initialState, { type: 'SET_COMPRESSION', payload: { imageQuality: 50 } })
    expect(next.compression.subsetFonts).toBe(true) // unchanged default
    expect(next.compression.garbageCollect).toBe(true)
  })
})

describe('TOGGLE_DRAWER', () => {
  it('flips drawerCollapsed', () => {
    expect(reducer(initialState, { type: 'TOGGLE_DRAWER' }).drawerCollapsed).toBe(true)
    const collapsed = { ...initialState, drawerCollapsed: true }
    expect(reducer(collapsed, { type: 'TOGGLE_DRAWER' }).drawerCollapsed).toBe(false)
  })
})

describe('SET_DRAWER_VIEW', () => {
  it('sets drawerView', () => {
    const next = reducer(initialState, { type: 'SET_DRAWER_VIEW', payload: { view: 'convert' } })
    expect(next.drawerView).toBe('convert')
  })
})

describe('SET_HOME_SECTION', () => {
  it('sets homeSection', () => {
    const next = reducer(initialState, { type: 'SET_HOME_SECTION', payload: { section: 'computer' } })
    expect(next.homeSection).toBe('computer')
  })
})

describe('SET_COMPUTER_FOLDER', () => {
  it('sets computerFolder', () => {
    const next = reducer(initialState, { type: 'SET_COMPUTER_FOLDER', payload: { folder: 'downloads' } })
    expect(next.computerFolder).toBe('downloads')
  })

  it('also sets homeSection to computer', () => {
    const next = reducer(initialState, { type: 'SET_COMPUTER_FOLDER', payload: { folder: 'desktop' } })
    expect(next.homeSection).toBe('computer')
  })
})

describe('SET_ORGANISE_PAGE', () => {
  it('sets selectedOrganisePage', () => {
    const next = reducer(initialState, { type: 'SET_ORGANISE_PAGE', payload: { page: 3 } })
    expect(next.selectedOrganisePage).toBe(3)
  })
})

describe('SET_MODE', () => {
  it('sets app mode', () => {
    const next = reducer(initialState, { type: 'SET_MODE', payload: { mode: 'merge' } })
    expect(next.mode).toBe('merge')
  })
})

/* ── Default ──────────────────────────────────────────────────────────── */

describe('default case', () => {
  it('returns state unchanged for unknown action', () => {
    const state = stateWithTab()
    const next = reducer(state, { type: 'UNKNOWN_ACTION' } as any)
    expect(next).toBe(state)
  })
})

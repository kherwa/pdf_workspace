import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../hooks/useTheme'
import { makeTab, useFileSystem } from '../../hooks/useFileSystem'
import { useDialog } from '../../context/DialogContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useThumbnails } from '../../hooks/useThumbnails'
import { useClickOutside } from '../../hooks/useClickOutside'
import { appendSuffixToFileName } from '../../utils/file'
import type { AppMode, ComputerFolder } from '../../types/app'
import type { ToolName } from '../../types/annotations'
import {
  PenIcon, GridIcon, ShieldIcon,
  CompressIcon, MergeIcon,
  ClockIcon, MonitorIcon, FolderIcon, DownloadIcon,
  SunIcon, MoonIcon, XIcon,
  HighlightIcon, TypeIcon, SquareIcon, CircleIcon, UndoIcon,
  RotateCCWIcon, RotateCWIcon, TrashIcon, ScissorsIcon, FilePlusIcon, FileBlankIcon, ChevronDownIcon,
} from '../shared/Icons'

type ActionItem = { id: string; label: string; Icon: React.FC<{ size?: number; className?: string }> }

const EDIT_ACTIONS: ActionItem[] = [
  { id: 'annotate', label: 'Annotate', Icon: PenIcon },
  { id: 'organise', label: 'Organise', Icon: GridIcon },
  { id: 'redact', label: 'Redact', Icon: ShieldIcon },
]

const CONVERT_ACTIONS: ActionItem[] = [
  { id: 'merge', label: 'Merge', Icon: MergeIcon },
  { id: 'compress', label: 'Compress', Icon: CompressIcon },
]

const ALL_ACTIONS: ActionItem[] = [...EDIT_ACTIONS, ...CONVERT_ACTIONS]

const HOME_ACTIONS: ActionItem[] = [
  { id: 'recent', label: 'Recent Files', Icon: ClockIcon },
  { id: 'computer', label: 'Your Computer', Icon: MonitorIcon },
]

const FOLDER_ACTIONS: ActionItem[] = [
  { id: 'desktop', label: 'Desktop', Icon: MonitorIcon },
  { id: 'downloads', label: 'Downloads', Icon: DownloadIcon },
  { id: 'documents', label: 'Documents', Icon: FolderIcon },
]

const ANNOTATION_TOOLS: { id: ToolName; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'highlight', label: 'Highlight', Icon: HighlightIcon },
  { id: 'text',      label: 'Text',      Icon: TypeIcon },
  { id: 'freehand',  label: 'Draw',      Icon: PenIcon },
  { id: 'rect',      label: 'Rectangle', Icon: SquareIcon },
  { id: 'ellipse',   label: 'Ellipse',   Icon: CircleIcon },
]

const ANNOTATION_COLORS = [
  { value: '#FFFF00', label: 'Yellow' },
  { value: '#00FF00', label: 'Green' },
  { value: '#FF0000', label: 'Red' },
  { value: '#0000FF', label: 'Blue' },
  { value: '#8B4513', label: 'Brown' },
]

export default function ModeBar() {
  const { state, activeTab, dispatch } = useApp()
  const { theme, toggle } = useTheme()
  const { snackbar, confirm, select } = useDialog()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()
  const { invalidate } = useThumbnails()
  const collapsed = state.drawerCollapsed
  const { mode, drawerView, homeSection, computerFolder } = state

  // Organise state
  const [rangeInput, setRangeInput] = useState('')
  const [showRange, setShowRange] = useState(false)
  const [showInsert, setShowInsert] = useState(false)
  const insertRef = useRef<HTMLDivElement>(null)
  const closeInsert = useCallback(() => setShowInsert(false), [])
  useClickOutside(insertRef, showInsert, closeInsert)

  const isHome = drawerView === 'home'
  const actions = isHome ? HOME_ACTIONS : drawerView === 'edit' ? EDIT_ACTIONS : drawerView === 'convert' ? CONVERT_ACTIONS : ALL_ACTIONS
  const EDIT_IDS = ['annotate', 'organise', 'redact']
  const CONVERT_IDS = ['merge', 'compress']

  function isItemActive(id: string): boolean {
    if (isHome) return homeSection === id
    if (id === 'annotate') return mode === 'view' && !!activeTab?.editMode
    return mode === id
  }

  function handleActionClick(id: string) {
    if (isHome) {
      dispatch({ type: 'SET_HOME_SECTION', payload: { section: id as 'recent' | 'computer' } })
      if (id === 'computer' && !computerFolder) {
        dispatch({ type: 'SET_COMPUTER_FOLDER', payload: { folder: 'desktop' } })
      }
      return
    }

    const view = EDIT_IDS.includes(id) ? 'edit' : CONVERT_IDS.includes(id) ? 'convert' : drawerView
    dispatch({ type: 'SET_DRAWER_VIEW', payload: { view } })

    if (id === 'merge') {
      // Create or activate the "New Document" tab for merge
      const existing = state.tabs.find(t => t.fileName === 'New Document')
      if (!existing) {
        const tabId = crypto.randomUUID()
        dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName: 'New Document', numPages: 0 }) })
      } else {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
      }
      dispatch({ type: 'SET_MODE', payload: { mode: 'merge' } })
      if (!collapsed) dispatch({ type: 'TOGGLE_DRAWER' })
      return
    }

    if (id === 'annotate') {
      if (!activeTab) return
      if (isItemActive('annotate')) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
        dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
      } else {
        if (mode !== 'view') dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: true } })
      }
    } else {
      const isDeactivating = mode === id
      const newMode = (isDeactivating ? 'view' : id) as AppMode
      dispatch({ type: 'SET_MODE', payload: { mode: newMode } })

      if (activeTab?.editMode) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
      }
      if (isDeactivating) {
        dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
      }
    }
  }

  function handleFolderClick(folder: ComputerFolder) {
    dispatch({ type: 'SET_COMPUTER_FOLDER', payload: { folder } })
  }

  function handleToolClick(tool: ToolName) {
    if (!activeTab) return
    const { id: tabId, activeTool } = activeTab
    dispatch({ type: 'SET_ACTIVE_TOOL', payload: { tabId, tool: activeTool === tool ? null : tool } })
  }

  function handleColorClick(color: string) {
    if (!activeTab) return
    dispatch({ type: 'SET_COLOR', payload: { tabId: activeTab.id, color } })
  }

  function handleUndo() {
    if (!activeTab) return
    dispatch({ type: 'UNDO_ANNOTATION', payload: { tabId: activeTab.id, page: activeTab.currentPage } })
  }

  /* ── Organise handlers ──────────────────────────────────────────── */
  const sel = state.selectedOrganisePage
  const hasSelection = sel !== null && !!activeTab && activeTab.pageOrder.includes(sel)

  function parseRange(input: string): number[] {
    if (!activeTab) return []
    const pages: number[] = []
    for (const part of input.split(',')) {
      const trimmed = part.trim()
      const dash = trimmed.indexOf('-')
      if (dash > 0) {
        const start = parseInt(trimmed.slice(0, dash), 10)
        const end = parseInt(trimmed.slice(dash + 1), 10)
        for (let i = start; i <= end; i++) pages.push(i)
      } else {
        const n = parseInt(trimmed, 10)
        if (!isNaN(n)) pages.push(n)
      }
    }
    return [...new Set(pages)].filter(p => p >= 1 && p <= activeTab.pageOrder.length)
  }

  async function handleExtractRange() {
    if (!activeTab) return
    const pages = parseRange(rangeInput)
    if (!pages.length) { snackbar('No valid pages in range.', 'error'); return }
    const bytes = await mupdf.extractPages(activeTab.id, pages)
    const suggested = appendSuffixToFileName(activeTab.fileName, '_extracted')
    await saveBytes(bytes, suggested, null, null)
    setShowRange(false)
    setRangeInput('')
  }

  function handleRotate(delta: 90 | -90) {
    if (!activeTab || !hasSelection) return
    dispatch({ type: 'ROTATE_PAGE', payload: { tabId: activeTab.id, page: sel!, delta } })
  }

  async function handleDeletePage() {
    if (!activeTab || !hasSelection) return
    const ok = await confirm({
      title: 'Delete page?',
      message: `Delete page ${sel}? This change is staged until you Save.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    dispatch({ type: 'DELETE_PAGES', payload: { tabId: activeTab.id, pages: [sel!] } })
    dispatch({ type: 'SET_ORGANISE_PAGE', payload: { page: null } })
  }

  async function askInsertPosition(): Promise<number | null> {
    if (!activeTab) return null
    const { pageOrder } = activeTab
    const refPage = hasSelection ? sel! : pageOrder[pageOrder.length - 1]
    const refIndex = pageOrder.indexOf(refPage)
    const choice = await select({
      title: 'Insert position',
      message: `Insert relative to page ${refPage}:`,
      options: [
        { label: `Before page ${refPage}`, value: 'before' },
        { label: `After page ${refPage}`, value: 'after' },
      ],
    })
    if (!choice) return null
    return choice === 'before' ? refIndex : refIndex + 1
  }

  async function handleInsertBlankPage() {
    if (!activeTab) return
    const insertAt = await askInsertPosition()
    if (insertAt === null) return
    const { id: tabId, numPages, pageOrder } = activeTab
    await mupdf.insertBlankPage(tabId, numPages)
    const newPageNum = numPages + 1
    const newOrder = [...pageOrder]
    newOrder.splice(insertAt, 0, newPageNum)
    dispatch({ type: 'UPDATE_TAB', payload: { tabId, numPages: numPages + 1, pageOrder: newOrder, dirty: true } })
    invalidate(tabId)
  }

  async function handleInsertPages() {
    let handles: FileSystemFileHandle[]
    try {
      handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      })
    } catch { return }
    if (!activeTab) return
    const insertAt = await askInsertPosition()
    if (insertAt === null) return
    const { id: tabId, numPages, pageOrder } = activeTab
    const file = await handles[0].getFile()
    const buffer = await file.arrayBuffer()
    const { insertedCount } = await mupdf.insertPages(tabId, buffer, numPages)
    const newPageNumbers = Array.from({ length: insertedCount }, (_, i) => numPages + 1 + i)
    const newOrder = [...pageOrder]
    newOrder.splice(insertAt, 0, ...newPageNumbers)
    dispatch({ type: 'UPDATE_TAB', payload: { tabId, numPages: numPages + insertedCount, pageOrder: newOrder, dirty: true } })
    invalidate(tabId)
  }

  /* ── Redact handlers ────────────────────────────────────────────── */
  const totalRedactions = activeTab
    ? Object.values(activeTab.redactions).reduce((n, arr) => n + arr.length, 0)
    : 0

  async function handleApplyRedactions() {
    if (!activeTab || !totalRedactions) return
    if (!totalRedactions) { snackbar('No redactions marked.', 'error'); return }
    const ok = await confirm({
      title: 'Apply redactions?',
      message: `Apply ${totalRedactions} redaction(s)? This permanently removes content and cannot be undone.`,
      confirmLabel: 'Apply',
      danger: true,
    })
    if (!ok) return
    try {
      await mupdf.applyRedactions(activeTab.id, activeTab.redactions, activeTab.scale)
      dispatch({ type: 'CLEAR_REDACTIONS', payload: { tabId: activeTab.id } })
      dispatch({ type: 'MARK_DIRTY', payload: { tabId: activeTab.id } })
      snackbar('Redactions applied (unsaved). Use File → Save to save changes.', 'info')
    } catch (err) {
      console.error('Apply redactions failed:', err)
      snackbar(`Redaction failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  /* ── Shared action item renderer ──────────────────────────────────── */
  function renderExpandedItem(item: ActionItem, active: boolean, onClick: () => void, indent = false) {
    return (
      <button
        key={item.id}
        onClick={onClick}
        className={`nav-item ${active ? 'active' : ''} ${indent ? 'indent' : ''}`}
        aria-label={item.label}
      >
        <item.Icon size={24} />
        <span className="text-label-large">{item.label}</span>
      </button>
    )
  }

  /* ── Collapsed or merge mode: hide drawer entirely ──────────────────── */
  if (collapsed || mode === 'merge') return null

  const title = isHome ? 'Home' : drawerView === 'edit' ? 'Edit Tools' : drawerView === 'convert' ? 'Convert Tools' : 'All Tools'

  /* ── Expanded: MD3 Navigation Drawer ─────────────────────────────────── */
  return (
    <nav className="nav-drawer" aria-label="Navigation drawer">
      {/* Header with title and close button */}
      <div className="nav-drawer-header">
        <span className="text-title-small">{title}</span>
        {!isHome && (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DRAWER' })}
            className="btn-icon-xs"
            aria-label="Close drawer"
            title="Close"
          >
            <XIcon size={20} />
          </button>
        )}
      </div>

      {/* Action items */}
      <div className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        {actions.map(item => {
          const active = isItemActive(item.id)
          return renderExpandedItem(item, active, () => handleActionClick(item.id))
        })}

        {!isHome && activeTab?.editMode && (
          <>
            <div className="divider-h-inset" />
            {ANNOTATION_TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleToolClick(id)}
                className={`nav-item indent ${activeTab.activeTool === id ? 'active' : ''}`}
                aria-label={label}
              >
                <Icon size={20} />
                <span className="text-label-large">{label}</span>
              </button>
            ))}
            <div className="divider-h-inset" />
            <div className="annotation-colors-row" role="group" aria-label="Color picker">
              {ANNOTATION_COLORS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleColorClick(value)}
                  className={`color-swatch ${activeTab.activeColor === value ? 'color-swatch-active' : ''}`}
                  style={{ backgroundColor: value }}
                  title={label}
                  aria-label={label}
                />
              ))}
            </div>
            <div className="divider-h-inset" />
            <button
              onClick={handleUndo}
              className="nav-item indent"
              aria-label="Undo last annotation"
            >
              <UndoIcon size={20} />
              <span className="text-label-large">Undo</span>
            </button>
          </>
        )}

        {!isHome && mode === 'organise' && activeTab && (
          <>
            <div className="divider-h-inset" />
            <div className="relative" ref={insertRef}>
              <button
                onClick={() => setShowInsert(!showInsert)}
                className="nav-item indent"
                aria-label="Insert page"
              >
                <FilePlusIcon size={20} />
                <span className="text-label-large">Insert</span>
                <ChevronDownIcon size={16} />
              </button>
              {showInsert && (
                <div className="dropdown min-w-[200px]" style={{ left: 48 }}>
                  <button
                    onClick={() => { setShowInsert(false); handleInsertPages() }}
                    className="dropdown-item"
                  >
                    <FilePlusIcon size={18} />
                    <span className="text-label-large">From File</span>
                  </button>
                  <button
                    onClick={() => { setShowInsert(false); handleInsertBlankPage() }}
                    className="dropdown-item"
                  >
                    <FileBlankIcon size={18} />
                    <span className="text-label-large">Blank Page</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => handleRotate(-90)}
              disabled={!hasSelection}
              className="nav-item indent"
              aria-label="Rotate left"
            >
              <RotateCCWIcon size={20} />
              <span className="text-label-large">Rotate Left</span>
            </button>
            <button
              onClick={() => handleRotate(90)}
              disabled={!hasSelection}
              className="nav-item indent"
              aria-label="Rotate right"
            >
              <RotateCWIcon size={20} />
              <span className="text-label-large">Rotate Right</span>
            </button>
            <button
              onClick={handleDeletePage}
              disabled={!hasSelection}
              className={`nav-item indent ${hasSelection ? 'text-error' : ''}`}
              aria-label="Delete page"
            >
              <TrashIcon size={20} />
              <span className="text-label-large">Delete</span>
            </button>
            <div className="divider-h-inset" />
            <button
              onClick={() => setShowRange(!showRange)}
              className="nav-item indent"
              aria-label="Extract range"
            >
              <ScissorsIcon size={20} />
              <span className="text-label-large">Extract Range</span>
            </button>
            {showRange && (
              <div className="flex flex-col gap-2 px-6 py-2" style={{ paddingLeft: 48 }}>
                <input
                  type="text"
                  placeholder="e.g. 1, 3, 5-8"
                  value={rangeInput}
                  onChange={e => setRangeInput(e.target.value)}
                  className="input-sm"
                />
                <button onClick={handleExtractRange} className="btn-save btn-compact">
                  Extract
                </button>
              </div>
            )}
          </>
        )}

        {!isHome && mode === 'redact' && activeTab && (
          <>
            <div className="divider-h-inset" />
            <div className="text-body-small text-on-surface-muted" style={{ paddingLeft: 48, paddingRight: 24, paddingTop: 4, paddingBottom: 4 }}>
              Draw rectangles to redact &middot; {totalRedactions} marked
            </div>
            {totalRedactions > 0 && (
              <button
                onClick={() => dispatch({ type: 'UNDO_REDACTION', payload: { tabId: activeTab.id, page: activeTab.currentPage } })}
                className="nav-item indent"
                aria-label="Undo last redaction"
              >
                <UndoIcon size={20} />
                <span className="text-label-large">Undo</span>
              </button>
            )}
            <button
              onClick={handleApplyRedactions}
              disabled={!totalRedactions}
              className={`nav-item indent ${totalRedactions ? 'text-error' : ''}`}
              aria-label="Apply redactions"
            >
              <ShieldIcon size={20} />
              <span className="text-label-large">Apply Redactions</span>
            </button>
          </>
        )}

        {isHome && homeSection === 'computer' && (
          <>
            <div className="divider-h-inset" />
            {FOLDER_ACTIONS.map(item => {
              const active = computerFolder === item.id
              return renderExpandedItem(item, active, () => handleFolderClick(item.id as ComputerFolder), true)
            })}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="divider-h-inset" />

      {/* Bottom section */}
      <div className="flex flex-col gap-1 p-2">
        <button
          onClick={toggle}
          className="nav-item"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <MoonIcon size={24} /> : <SunIcon size={24} />}
          <span className="text-label-large">
            {theme === 'dark' ? 'Dark theme' : 'Light theme'}
          </span>
        </button>
      </div>
    </nav>
  )
}

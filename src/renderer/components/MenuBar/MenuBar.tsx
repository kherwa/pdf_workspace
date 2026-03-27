import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useDialog } from '../../context/DialogContext'
import { makeTab } from '../../hooks/useFileSystem'
import { useMupdf } from '../../hooks/useMupdf'
import { useRecentFiles } from '../../hooks/useRecentFiles'
import { useClickOutside } from '../../hooks/useClickOutside'
import { createPageOrder } from '../../utils/array'
import { MenuIcon, HomeIcon, XIcon, PlusIcon, MergeIcon, ChevronDownIcon, FileIcon, FolderOpenIcon } from '../shared/Icons'

const api = (window as any).electronAPI
const platform: string = api?.platform ?? 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'
const mod = isMac ? '⌘' : 'Ctrl+'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
}

interface MenuDef {
  label: string
  items: MenuItem[]
}

const MENUS: MenuDef[] = [
  {
    label: 'Menu',
    items: [
      { label: 'Open File...', shortcut: `${mod}O`, action: () => api.triggerMenuOpen() },
      { separator: true, label: '' },
      { label: 'Save', shortcut: `${mod}S`, action: () => api.triggerMenuSave() },
      { label: 'Save As...', shortcut: `${isMac ? '⇧⌘' : 'Ctrl+Shift+'}S`, action: () => api.triggerMenuSaveAs() },
      { separator: true, label: '' },
      { label: 'Close File', shortcut: `${mod}W`, action: () => api.triggerMenuCloseTab() },
    ],
  },
]

/** File types MuPDF can convert to PDF */
const CONVERTIBLE_TYPES = [
  { description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.svg'] } },
  { description: 'Documents', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
  { description: 'Presentations', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } },
  { description: 'Text Files', accept: { 'text/plain': ['.txt'], 'text/html': ['.html', '.htm'] } },
  { description: 'Other', accept: { 'application/epub+zip': ['.epub'], 'application/xps': ['.xps'] } },
]

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = useApp()
  const { snackbar, confirm } = useDialog()
  const mupdf = useMupdf()
  const { addRecent } = useRecentFiles()
  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null

  useEffect(() => {
    api?.onFullscreenChanged?.((fs: boolean) => setIsFullscreen(fs))
    return () => api?.removeAllListeners?.('fullscreen:changed')
  }, [])

  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const closeCreateMenu = useCallback(() => setShowCreateMenu(false), [])
  useClickOutside(createMenuRef, showCreateMenu, closeCreateMenu)

  function handleMerge() {
    setShowCreateMenu(false)
    // Create or activate a "New Document" tab for the merge
    const existing = state.tabs.find(t => t.fileName === 'New Document')
    if (!existing) {
      const tabId = crypto.randomUUID()
      dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName: 'New Document', numPages: 0 }) })
    } else {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
    }
    dispatch({ type: 'SET_MODE', payload: { mode: 'merge' } })
    // Collapse the nav drawer so merge gets full space
    if (!state.drawerCollapsed) dispatch({ type: 'TOGGLE_DRAWER' })
  }

  async function handleCreate() {
    setShowCreateMenu(false)
    let handles: FileSystemFileHandle[]
    try {
      handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: CONVERTIBLE_TYPES,
      })
    } catch { return }

    const file = await handles[0].getFile()
    const buffer = await file.arrayBuffer()
    const pdfName = file.name.replace(/\.[^.]+$/, '.pdf')

    const tabId = crypto.randomUUID()
    dispatch({
      type: 'OPEN_TAB',
      payload: makeTab({ id: tabId, fileName: pdfName, numPages: 1, isLoading: true }),
    })

    try {
      const pdfBytes = await mupdf.convertToPdf(buffer, file.name)
      const { numPages } = await mupdf.openDocument(tabId, pdfBytes.buffer)
      dispatch({
        type: 'UPDATE_TAB',
        payload: {
          tabId, numPages,
          pageOrder: createPageOrder(numPages),
          isLoading: false,
        },
      })
      addRecent(pdfName, null, null)
    } catch (err) {
      console.error('Convert failed:', err)
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
      snackbar(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  async function handleCloseTab(tabId: string, e: React.MouseEvent) {
    e.stopPropagation()

    // Check for unsaved changes
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab?.dirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        message: `"${tab.fileName}" has unsaved changes. Close without saving?`,
        confirmLabel: 'Close without saving',
        danger: true,
      })
      if (!ok) return
    }

    const isMergeSource = state.mergeSources.some(s => s.tabId === tabId)
    if (isMergeSource) {
      const ok = await confirm({
        title: 'Close merge source?',
        message: 'This file is used in a merge. Closing it will remove it from the merge sources.',
        confirmLabel: 'Close',
        danger: true,
      })
      if (!ok) return
      dispatch({ type: 'REMOVE_MERGE_SOURCE', payload: { tabId } })
    }
    // If closing the merge tab, clean up merge mode
    const tab2 = state.tabs.find(t => t.id === tabId)
    if (tab2?.fileName === 'New Document' && state.mode === 'merge') {
      for (const src of state.mergeSources) {
        if (!state.tabs.some(t => t.id === src.tabId)) {
          mupdf.closeDocument(src.tabId)
        }
        dispatch({ type: 'REMOVE_MERGE_SOURCE', payload: { tabId: src.tabId } })
      }
      dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
    }

    mupdf.closeDocument(tabId)
    dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
  }

  const closeMenus = useCallback(() => setOpenMenu(null), [])
  useClickOutside(barRef, openMenu !== null, closeMenus)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div ref={barRef} className={`titlebar ${isMac ? (isFullscreen ? 'platform-mac-fs' : 'platform-mac') : isLinux ? 'platform-linux' : 'platform-win'}`}>
      {/* Menu buttons — hidden on macOS (native menu handles shortcuts) */}
      {!isMac && (
        <>
          {MENUS.map((menu, idx) => (
            <div key={menu.label} className="relative titlebar-no-drag">
              <button
                onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
                onMouseEnter={() => { if (openMenu !== null) setOpenMenu(idx) }}
                className={`btn-toggle ${openMenu === idx ? 'menu-active' : ''}`}
                aria-label={menu.label}
              >
                {idx === 0 && <MenuIcon size={18} />}
                {menu.label}
              </button>

              {openMenu === idx && (
                <div className="dropdown">
                  {menu.items.map((item, i) =>
                    item.separator ? (
                      <div key={i} className="divider-h" />
                    ) : (
                      <button
                        key={i}
                        onClick={() => { setOpenMenu(null); item.action?.() }}
                        className="dropdown-item justify-between"
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-6 text-label-medium text-on-surface-muted">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="divider-v" />
        </>
      )}

      {/* Home button */}
      <button
        onClick={() => {
          if (state.tabs.find(t => t.id === state.activeTabId)?.editMode) {
            dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: state.activeTabId!, editMode: false } })
          }
          dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
          dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'home' } })
          dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: null } })
          if (state.drawerCollapsed) dispatch({ type: 'TOGGLE_DRAWER' })
        }}
        className={`btn-icon-xs titlebar-no-drag ${state.drawerView === 'home' && !activeTab ? 'home-active' : ''}`}
        aria-label="Home"
        title="Home"
      >
        <HomeIcon size={18} />
      </button>

      {state.tabs.length > 0 && <div className="divider-v" />}

      {/* File tabs */}
      {state.tabs.length > 0 && (
        <div className="flex items-center overflow-x-auto min-w-0 shrink gap-0.5 titlebar-no-drag">
          {state.tabs.map(tab => {
            const isActive = tab.id === state.activeTabId
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tab.id } })}
                className={`group tab-item max-w-[200px] ${isActive ? 'active' : ''}`}
                aria-label={`Tab: ${tab.fileName}`}
              >
                <span className="truncate flex-1 text-left">
                  {tab.fileName}
                </span>
                {tab.isLoading && <span className="spinner-sm" />}
                <span
                  role="button"
                  onClick={e => handleCloseTab(tab.id, e)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity tab-close-bg"
                  aria-label={`Close ${tab.fileName}`}
                >
                  <XIcon size={12} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Create split button — adjacent to tabs */}
      <div className="relative flex shrink-0 titlebar-no-drag ml-1" ref={createMenuRef}>
        <button
          onClick={handleCreate}
          className="btn-create"
          aria-label="Create PDF from file"
          title="Create PDF"
        >
          <PlusIcon size={14} />
          <span>Create</span>
        </button>
        <button
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="btn-create-caret"
          aria-label="More create options"
        >
          <ChevronDownIcon size={12} />
        </button>
        {showCreateMenu && (
          <div className="dropdown dropdown-below min-w-[200px]">
            <button onClick={() => { setShowCreateMenu(false); api.triggerMenuOpen() }} className="dropdown-item">
              <FolderOpenIcon size={16} />
              <span className="text-label-large">Open File</span>
            </button>
            <div className="divider-h" />
            <button onClick={handleCreate} className="dropdown-item">
              <FileIcon size={16} />
              <span className="text-label-large">Create PDF from File</span>
            </button>
            <div className="divider-h" />
            <button onClick={handleMerge} className="dropdown-item">
              <MergeIcon size={16} />
              <span className="text-label-large">Merge PDFs</span>
            </button>
          </div>
        )}
      </div>

      {/* Spacer — fills remaining titlebar for drag region */}
      <div className="flex-1" />
    </div>
  )
}

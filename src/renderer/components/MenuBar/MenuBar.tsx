import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useDialog } from '../../context/DialogContext'
import { makeTab } from '../../hooks/useFileSystem'
import { useMupdf } from '../../hooks/useMupdf'
import { useRecentFiles } from '../../hooks/useRecentFiles'
import { useClickOutside } from '../../hooks/useClickOutside'
import { createPageOrder } from '../../utils/array'
import { MenuIcon, HomeIcon, XIcon, PlusIcon } from '../shared/Icons'

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
  const barRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = useApp()
  const { snackbar, confirm } = useDialog()
  const mupdf = useMupdf()
  const { addRecent } = useRecentFiles()
  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null

  async function handleCreate() {
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
    <div ref={barRef} className={`titlebar ${isMac ? 'platform-mac' : isLinux ? 'platform-linux' : 'platform-win'}`}>
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
        <HomeIcon size={20} />
      </button>

      <div className="divider-v" />

      {/* Create button */}
      <button
        onClick={handleCreate}
        className="btn-toggle titlebar-no-drag"
        aria-label="Create PDF from file"
        title="Create PDF from image, document, or text file"
      >
        <PlusIcon size={18} />
        Create
      </button>

      <div className="divider-v" />

      {/* File tabs */}
      <div className="flex items-center overflow-x-auto min-w-0 flex-1 gap-0.5 titlebar-no-drag">
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
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity tab-close-bg"
                aria-label={`Close ${tab.fileName}`}
              >
                <XIcon size={14} />
              </span>
              {isActive && <span className="tab-indicator" />}
            </button>
          )
        })}
      </div>

      {/* App title — fallback when no tabs */}
      {state.tabs.length === 0 && (
        <span className="text-title-small text-on-surface-muted">
          PDF Workspace
        </span>
      )}
    </div>
  )
}

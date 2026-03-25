import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useDialog } from '../../context/DialogContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useFileSystem } from '../../hooks/useFileSystem'
import { appendSuffixToFileName } from '../../utils/file'
import { useClickOutside } from '../../hooks/useClickOutside'
import { createPageOrder } from '../../utils/array'
import { PlusIcon, XIcon, FolderOpenIcon, FileIcon, ChevronDownIcon } from '../shared/Icons'

export default function MergeToolbar() {
  const { state, dispatch } = useApp()
  const { snackbar, prompt } = useDialog()
  const mupdf = useMupdf()
  const { openFilesForMerge } = useFileSystem()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const availableTabs = state.tabs.filter(
    t => !t.isLoading && t.fileName !== 'New Document' && !state.mergeSources.some(s => s.tabId === t.id)
  )

  const closeMenu = useCallback(() => setShowMenu(false), [])
  useClickOutside(menuRef, showMenu, closeMenu)

  function addOpenTab(tabId: string) {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    dispatch({
      type: 'ADD_MERGE_SOURCE',
      payload: {
        source: {
          tabId: tab.id,
          fileName: tab.fileName,
          numPages: tab.numPages,
          selectedPages: [],
        },
      },
    })
    setShowMenu(false)
  }

  async function handleMerge() {
    if (state.mergeSources.length < 2) { snackbar('Add at least 2 files to merge.', 'error'); return }

    // Prompt for file name
    const fileName = await prompt({
      title: 'Save merged document as',
      message: 'Enter a file name for the merged PDF:',
      defaultValue: 'merged.pdf',
      confirmLabel: 'Merge',
    })
    if (!fileName) return // cancelled

    const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`

    const sources = state.mergeSources.map(s => {
      const allPages = createPageOrder(s.numPages)
      return {
        tabId: s.tabId,
        pages: s.selectedPages.length ? allPages.filter(p => !s.selectedPages.includes(p)) : allPages,
      }
    })
    const bytes = await mupdf.mergeDocuments(sources)

    // Reuse the "New Document" tab for the merged result
    const mergeTab = state.tabs.find(t => t.fileName === 'New Document')
    const tabId = mergeTab?.id ?? crypto.randomUUID()

    if (mergeTab) {
      dispatch({ type: 'UPDATE_TAB', payload: { tabId, fileName: finalName, isLoading: true } })
    }

      try {
        const { numPages } = await mupdf.openDocument(tabId, bytes.buffer)
        dispatch({
          type: 'UPDATE_TAB',
          payload: {
            tabId, numPages,
            fileName: finalName,
            pageOrder: createPageOrder(numPages),
            isLoading: false,
          },
        })
      // Clean up merge-only worker documents (not backed by a real tab)
      for (const src of state.mergeSources) {
        if (!state.tabs.some(t => t.id === src.tabId)) {
          mupdf.closeDocument(src.tabId)
        }
        dispatch({ type: 'REMOVE_MERGE_SOURCE', payload: { tabId: src.tabId } })
      }
      dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })

      // Prompt Save As for merged document (append _merged suffix)
      try {
        const suggested = appendSuffixToFileName(finalName, '_merged')
        const handle = await (await import('../../hooks/useFileSystem')).saveBytes(bytes, suggested, null, null)
        if (handle) dispatch({ type: 'UPDATE_TAB', payload: { tabId, fileHandle: handle } })
      } catch {
        // User cancelled the save dialog — doc stays in memory only
      }
    } catch (err) {
      console.error('Failed to open merged document:', err)
      snackbar(`Merge failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  function clearAll() {
    for (const src of state.mergeSources) {
      if (!state.tabs.some(t => t.id === src.tabId)) {
        mupdf.closeDocument(src.tabId)
      }
      dispatch({ type: 'REMOVE_MERGE_SOURCE', payload: { tabId: src.tabId } })
    }
  }

  return (
    <div className="toolbar">
      {/* Add Files split button */}
      <div className="relative flex" ref={menuRef}>
        <button onClick={() => openFilesForMerge()} className="btn-compact split-left">
          <PlusIcon size={18} />
          Add Files
        </button>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-compact split-right"
          aria-label="More add options"
        >
          <ChevronDownIcon size={16} />
        </button>

        {showMenu && (
          <div className="dropdown min-w-[240px]">
            <button
              onClick={() => { setShowMenu(false); openFilesForMerge() }}
              className="dropdown-item"
            >
              <FolderOpenIcon size={18} />
              <span className="text-label-large">Add New Files...</span>
            </button>
            {availableTabs.length > 0 && (
              <>
                <div className="divider-h" />
                <div className="px-4 py-2">
                  <span className="text-label-small text-on-surface-muted">Open tabs</span>
                </div>
                {availableTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => addOpenTab(tab.id)}
                    className="dropdown-item"
                  >
                    <FileIcon size={16} />
                    <span className="text-body-medium truncate">{tab.fileName}</span>
                    <span className="text-label-small ml-auto text-on-surface-muted">{tab.numPages}p</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-sep" />

      <span className="text-label-medium text-on-surface-muted">
        {state.mergeSources.length} source(s)
      </span>

      <button
        onClick={handleMerge}
        disabled={state.mergeSources.length < 2}
        className="btn-save btn-compact"
      >
        Merge
      </button>

      <button onClick={clearAll} className="btn-text ml-auto text-on-surface-variant">
        <XIcon size={18} />
        Clear
      </button>
    </div>
  )
}

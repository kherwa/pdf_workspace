import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useDialog } from '../../context/DialogContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useFileSystem } from '../../hooks/useFileSystem'
import { useThumbnails } from '../../hooks/useThumbnails'
import { useClickOutside } from '../../hooks/useClickOutside'
import { RotateCCWIcon, RotateCWIcon, TrashIcon, ScissorsIcon, FilePlusIcon, FileBlankIcon, ChevronDownIcon } from '../shared/Icons'

export default function OrganiseToolbar() {
  const { state, activeTab, dispatch } = useApp()
  const { snackbar, confirm } = useDialog()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()
  const { invalidate } = useThumbnails()
  const [rangeInput, setRangeInput] = useState('')
  const [showRange, setShowRange] = useState(false)
  const [showInsert, setShowInsert] = useState(false)
  const insertRef = useRef<HTMLDivElement>(null)

  const closeInsert = useCallback(() => setShowInsert(false), [])
  useClickOutside(insertRef, showInsert, closeInsert)

  if (!activeTab) return null
  const { id: tabId, pageOrder, numPages, fileName } = activeTab
  const sel = state.selectedOrganisePage
  const hasSelection = sel !== null && pageOrder.includes(sel)

  function parseRange(input: string): number[] {
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
    return [...new Set(pages)].filter(p => p >= 1 && p <= pageOrder.length)
  }

  async function handleExtractRange() {
    const pages = parseRange(rangeInput)
    if (!pages.length) { snackbar('No valid pages in range.', 'error'); return }
    const bytes = await mupdf.extractPages(tabId, pages)
    await saveBytes(bytes, `extracted_${fileName}`)
    setShowRange(false)
    setRangeInput('')
  }

  function handleRotate(delta: 90 | -90) {
    if (!hasSelection) return
    dispatch({ type: 'ROTATE_PAGE', payload: { tabId, page: sel!, delta } })
  }

  async function handleDelete() {
    if (!hasSelection) return
    const ok = await confirm({
      title: 'Delete page?',
      message: `Delete page ${sel}? This change is staged until you Save.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    dispatch({ type: 'DELETE_PAGES', payload: { tabId, pages: [sel!] } })
    dispatch({ type: 'SET_ORGANISE_PAGE', payload: { page: null } })
  }

  async function handleInsertBlankPage() {
    const insertAt = hasSelection ? pageOrder.indexOf(sel!) + 1 : pageOrder.length
    await mupdf.insertBlankPage(tabId, insertAt)

    const newPageNum = numPages + 1
    const newOrder = [...pageOrder]
    newOrder.splice(insertAt, 0, newPageNum)

    dispatch({
      type: 'UPDATE_TAB',
      payload: {
        tabId,
        numPages: numPages + 1,
        pageOrder: newOrder,
      },
    })
    invalidate(tabId)
  }

  async function handleInsertPages() {
    let handles: FileSystemFileHandle[]
    try {
      handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      })
    } catch {
      return
    }

    const file = await handles[0].getFile()
    const buffer = await file.arrayBuffer()

    const insertAt = hasSelection ? pageOrder.indexOf(sel!) + 1 : pageOrder.length

    const { insertedCount } = await mupdf.insertPages(tabId, buffer, insertAt)

    const newPageNumbers = Array.from({ length: insertedCount }, (_, i) => numPages + 1 + i)
    const newOrder = [...pageOrder]
    newOrder.splice(insertAt, 0, ...newPageNumbers)

    dispatch({
      type: 'UPDATE_TAB',
      payload: {
        tabId,
        numPages: numPages + insertedCount,
        pageOrder: newOrder,
      },
    })
    invalidate(tabId)
  }

  return (
    <div className="toolbar flex-wrap">
      <span className="text-body-small text-on-surface-muted" style={{ marginRight: 8 }}>
        Drag to reorder, click to select
      </span>

      <div className="toolbar-sep" />

      <div className="relative" ref={insertRef}>
        <button
          onClick={() => setShowInsert(!showInsert)}
          className="btn-compact"
          aria-label="Insert page"
        >
          <FilePlusIcon size={18} />
          Insert
          <ChevronDownIcon size={16} />
        </button>

        {showInsert && (
          <div className="dropdown min-w-[200px]">
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

      <div className="toolbar-sep" />

      <button
        onClick={() => handleRotate(-90)}
        disabled={!hasSelection}
        className="btn-icon-xs"
        title="Rotate left"
        aria-label="Rotate left"
      >
        <RotateCCWIcon size={20} />
      </button>
      <button
        onClick={() => handleRotate(90)}
        disabled={!hasSelection}
        className="btn-icon-xs"
        title="Rotate right"
        aria-label="Rotate right"
      >
        <RotateCWIcon size={20} />
      </button>
      <button
        onClick={handleDelete}
        disabled={!hasSelection}
        className="btn-icon-xs"
        style={{ color: hasSelection ? 'var(--md-error-40)' : undefined }}
        title="Delete page"
        aria-label="Delete page"
      >
        <TrashIcon size={20} />
      </button>

      <div className="toolbar-sep" />

      <button
        onClick={() => setShowRange(!showRange)}
        className="btn-compact"
      >
        <ScissorsIcon size={18} />
        Extract Range
      </button>

      {showRange && (
        <>
          <input
            type="text"
            placeholder="e.g. 1, 3, 5-8"
            value={rangeInput}
            onChange={e => setRangeInput(e.target.value)}
            className="input-sm w-36"
          />
          <button onClick={handleExtractRange} className="btn-compact">
            Extract
          </button>
        </>
      )}
    </div>
  )
}

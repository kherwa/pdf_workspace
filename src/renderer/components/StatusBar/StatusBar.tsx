import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useMupdf } from '../../hooks/useMupdf'
import { ChevronUpIcon, ChevronDownIcon, ZoomInIcon, ZoomOutIcon } from '../shared/Icons'

export default function StatusBar() {
  const { activeTab, dispatch } = useApp()
  const mupdf = useMupdf()

  const [pageInput, setPageInput] = useState('')

  // Sync local input with currentPage from state
  useEffect(() => {
    if (activeTab) setPageInput(String(activeTab.currentPage))
  }, [activeTab?.currentPage])

  if (!activeTab) return null

  const { id: tabId, currentPage, numPages, scale } = activeTab

  function setPage(p: number) {
    const clamped = Math.max(1, Math.min(p, numPages))
    dispatch({ type: 'SET_PAGE', payload: { tabId, page: clamped } })
  }

  function setScale(s: number) {
    dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.max(0.1, Math.min(5, s)) } })
  }

  async function fitPage() {
    try {
      const info = await mupdf.getPageInfo(tabId, currentPage)
      const main = document.querySelector('main')
      if (!main) return
      const { clientWidth, clientHeight } = main
      const padding = 48
      const fitScale = Math.min(
        (clientWidth - padding) / info.width,
        (clientHeight - padding) / info.height,
      )
      setScale(Math.round(fitScale * 100) / 100)
    } catch {}
  }

  return (
    <aside
      className="shrink-0 flex flex-col items-center justify-end gap-3 py-3"
      style={{
        width: 64,
        backgroundColor: 'var(--md-surface)',
        borderLeft: '1px solid var(--md-outline-20)',
      }}
    >      

    {/* Page navigation */}
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="btn-icon-sm"
        aria-label="Previous page"
      >
        <ChevronUpIcon size={18} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={pageInput}
        onChange={e => setPageInput(e.target.value.replace(/\D/g, ''))}
        onBlur={e => {
          const v = parseInt(pageInput, 10)
          if (v >= 1 && v <= numPages) setPage(v)
          else setPageInput(String(currentPage))
          e.currentTarget.style.borderColor = 'var(--md-outline-30)'
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const v = parseInt(pageInput, 10)
            if (v >= 1 && v <= numPages) setPage(v)
            else setPageInput(String(currentPage))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        onFocus={e => { e.target.select(); e.currentTarget.style.borderColor = 'var(--md-primary-40)' }}
        className="text-center rounded-md [appearance:textfield] focus:outline-none"
        style={{
          width: 44,
          height: 32,
          backgroundColor: 'var(--md-surface-container)',
          border: '1px solid var(--md-outline-30)',
          color: 'var(--md-on-surface)',
          fontSize: 12,
        }}
        aria-label="Current page number"
      />
      <span className="text-center" style={{ fontSize: 10, color: 'var(--md-on-surface-muted)', lineHeight: 1 }}>
        {numPages}
      </span>
      <button
        onClick={() => setPage(currentPage + 1)}
        disabled={currentPage >= numPages}
        className="btn-icon-sm"
        aria-label="Next page"
      >
        <ChevronDownIcon size={18} />
      </button>

      {/* Divider */}
      <div style={{ width: 24, height: 1, backgroundColor: 'var(--md-outline-20)' }} />

        {/* Zoom controls */}
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => setScale(scale + 0.1)} className="btn-icon-sm" aria-label="Zoom in">
          <ZoomInIcon size={18} />
        </button>
        <span
          className="text-center"
          style={{ fontSize: 10, color: 'var(--md-on-surface-variant)', lineHeight: 1 }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button onClick={() => setScale(scale - 0.1)} className="btn-icon-sm" aria-label="Zoom out">
          <ZoomOutIcon size={18} />
        </button>
        <button
          onClick={fitPage}
          className="btn-icon-sm"
          aria-label="Fit page"
          title="Fit page"
          style={{ marginTop: 2 }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        </button>
      </div>

      </div>
    </aside>
  )
}

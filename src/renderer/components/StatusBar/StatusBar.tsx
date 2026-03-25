import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useClickOutside } from '../../hooks/useClickOutside'
import {
  ChevronUpIcon, ChevronDownIcon, ZoomInIcon, ZoomOutIcon,
  RotateCWIcon, ViewOptionsIcon, FitWidthIcon, FitHeightIcon, TwoPageIcon,
} from '../shared/Icons'
import type { ViewLayout } from '../../types/app'

export default function StatusBar() {
  const { activeTab, dispatch } = useApp()
  const mupdf = useMupdf()

  const [pageInput, setPageInput] = useState('')
  const [showViewMenu, setShowViewMenu] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)

  const closeViewMenu = useCallback(() => setShowViewMenu(false), [])
  useClickOutside(viewMenuRef, showViewMenu, closeViewMenu)

  // Sync local input with currentPage from state
  useEffect(() => {
    if (activeTab) setPageInput(String(activeTab.currentPage))
  }, [activeTab?.currentPage])

  if (!activeTab) return null

  const { id: tabId, currentPage, numPages, scale, viewLayout, rotations } = activeTab
  const isTwoPage = viewLayout === 'two-page'
  const step = isTwoPage ? 2 : 1

  function setPage(p: number) {
    let clamped = Math.max(1, Math.min(p, numPages))
    // In two-page mode, snap to odd page so pairs are (1,2), (3,4), etc.
    if (isTwoPage && clamped > 1 && clamped % 2 === 0) clamped = clamped - 1
    dispatch({ type: 'SET_PAGE', payload: { tabId, page: clamped } })
  }

  function setScale(s: number) {
    dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.max(0.1, Math.min(5, s)) } })
  }

  /** Get effective page dimensions accounting for user-applied rotation */
  function getEffectiveDims(info: { width: number; height: number }, userRotation: number) {
    const swapped = userRotation === 90 || userRotation === 270
    return { width: swapped ? info.height : info.width, height: swapped ? info.width : info.height }
  }

  async function fitPage() {
    try {
      const info = await mupdf.getPageInfo(tabId, currentPage)
      const userRot = rotations[currentPage] ?? 0
      const dims = getEffectiveDims(info, userRot)
      const main = document.querySelector('main')
      if (!main) return
      const { clientWidth, clientHeight } = main
      const padding = 48

      let pageW = dims.width
      let pageH = dims.height
      if (isTwoPage) {
        // Check second page too
        const nextPage = currentPage + 1
        if (nextPage <= numPages) {
          const info2 = await mupdf.getPageInfo(tabId, nextPage)
          const dims2 = getEffectiveDims(info2, rotations[nextPage] ?? 0)
          pageW = Math.max(dims.width, dims2.width)
          pageH = Math.max(dims.height, dims2.height)
        }
        const gap = 16
        const fitScaleW = (clientWidth - padding - gap) / (pageW * 2)
        const fitScaleH = (clientHeight - padding) / pageH
        setScale(Math.round(Math.min(fitScaleW, fitScaleH) * 100) / 100)
      } else {
        const fitScaleW = (clientWidth - padding) / pageW
        const fitScaleH = (clientHeight - padding) / pageH
        setScale(Math.round(Math.min(fitScaleW, fitScaleH) * 100) / 100)
      }
    } catch {}
    setShowViewMenu(false)
  }

  async function fitHeight() {
    try {
      const info = await mupdf.getPageInfo(tabId, currentPage)
      const userRot = rotations[currentPage] ?? 0
      const dims = getEffectiveDims(info, userRot)
      const main = document.querySelector('main')
      if (!main) return
      const padding = 48
      const fitScale = (main.clientHeight - padding) / dims.height
      setScale(Math.round(fitScale * 100) / 100)
    } catch {}
    setShowViewMenu(false)
  }

  async function fitWidth() {
    try {
      const info = await mupdf.getPageInfo(tabId, currentPage)
      const userRot = rotations[currentPage] ?? 0
      const dims = getEffectiveDims(info, userRot)
      const main = document.querySelector('main')
      if (!main) return
      const padding = 48

      if (isTwoPage) {
        let pageW = dims.width
        const nextPage = currentPage + 1
        if (nextPage <= numPages) {
          const info2 = await mupdf.getPageInfo(tabId, nextPage)
          const dims2 = getEffectiveDims(info2, rotations[nextPage] ?? 0)
          pageW = Math.max(dims.width, dims2.width)
        }
        const gap = 16
        const fitScale = (main.clientWidth - padding - gap) / (pageW * 2)
        setScale(Math.round(fitScale * 100) / 100)
      } else {
        const fitScale = (main.clientWidth - padding) / dims.width
        setScale(Math.round(fitScale * 100) / 100)
      }
    } catch {}
    setShowViewMenu(false)
  }

  function setViewLayout(layout: ViewLayout) {
    dispatch({ type: 'SET_VIEW_LAYOUT', payload: { tabId, layout } })
    // Snap to odd page when switching to two-page mode
    if (layout === 'two-page' && currentPage > 1 && currentPage % 2 === 0) {
      dispatch({ type: 'SET_PAGE', payload: { tabId, page: currentPage - 1 } })
    }
    setShowViewMenu(false)
  }

  function handleRotate() {
    dispatch({ type: 'ROTATE_PAGE', payload: { tabId, page: currentPage, delta: 90 } })
  }

  return (
    <aside className="shrink-0 flex flex-col items-center justify-end gap-3 py-3 statusbar-aside">

    {/* Page navigation */}
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setPage(currentPage - step)}
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
          e.currentTarget.classList.remove('focused')
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const v = parseInt(pageInput, 10)
            if (v >= 1 && v <= numPages) setPage(v)
            else setPageInput(String(currentPage))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        onFocus={e => { e.target.select(); e.currentTarget.classList.add('focused') }}
        className="text-center rounded-md [appearance:textfield] focus:outline-none status-input"
        aria-label="Current page number"
      />
      <span className="text-center text-xs-muted">
        {numPages}
      </span>
      <button
        onClick={() => setPage(currentPage + step)}
        disabled={currentPage >= numPages}
        className="btn-icon-sm"
        aria-label="Next page"
      >
        <ChevronDownIcon size={18} />
      </button>

      {/* Divider */}
      <div className="status-divider" />

      {/* View options dropdown — above rotate */}
      <div className="relative" ref={viewMenuRef}>
        <button
          onClick={() => setShowViewMenu(!showViewMenu)}
          className="btn-icon-sm"
          aria-label="View options"
          title="View options"
        >
          <ViewOptionsIcon size={18} />
        </button>

        {showViewMenu && (
          <div className="dropdown dropdown-left min-w-[160px]">
            <button onClick={fitPage} className="dropdown-item">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
              <span className="text-label-large">Fit Page</span>
            </button>
            <button onClick={fitHeight} className="dropdown-item">
              <FitHeightIcon size={18} />
              <span className="text-label-large">Fit Height</span>
            </button>
            <button onClick={fitWidth} className="dropdown-item">
              <FitWidthIcon size={18} />
              <span className="text-label-large">Fit Width</span>
            </button>
            <div className="divider-h" />
            <button
              onClick={() => setViewLayout('single')}
              className={`dropdown-item ${viewLayout === 'single' ? 'active' : ''}`}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="3" width="14" height="18" rx="1" />
              </svg>
              <span className="text-label-large">Single Page</span>
            </button>
            <button
              onClick={() => setViewLayout('two-page')}
              className={`dropdown-item ${viewLayout === 'two-page' ? 'active' : ''}`}
            >
              <TwoPageIcon size={18} />
              <span className="text-label-large">Two Page</span>
            </button>
          </div>
        )}
      </div>

      {/* Rotate current page */}
      <button
        onClick={handleRotate}
        className="btn-icon-sm"
        aria-label="Rotate page clockwise"
        title="Rotate page"
      >
        <RotateCWIcon size={18} />
      </button>

      {/* Divider */}
      <div className="status-divider" />

      {/* Zoom controls */}
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => setScale(scale + 0.1)} className="btn-icon-sm" aria-label="Zoom in">
          <ZoomInIcon size={18} />
        </button>
        <button onClick={() => setScale(scale - 0.1)} className="btn-icon-sm" aria-label="Zoom out">
          <ZoomOutIcon size={18} />
        </button>
      </div>

      </div>
    </aside>
  )
}

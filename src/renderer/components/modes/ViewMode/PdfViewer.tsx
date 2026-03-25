import { useEffect, useRef, useCallback, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { renderBitmapToCanvas } from '../../../utils/canvas'

export default function PdfViewer() {
  const { activeTab, dispatch } = useApp()
  const mupdf = useMupdf()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderingRef = useRef(false)
  const fittedRef = useRef<string | null>(null)
  const scrollCooldownRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const mountedRef = useRef(true)
  const activeTabRef = useRef(activeTab)
  const lastLayoutRef = useRef<string | undefined>(undefined)

  activeTabRef.current = activeTab

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const tabId = activeTab?.id
  const currentPage = activeTab?.currentPage
  const viewLayout = activeTab?.viewLayout
  const rotations = activeTab?.rotations

  /** Get effective page dimensions accounting for user-applied rotation */
  const getEffectiveDims = useCallback(async (tid: string, page: number, userRotation: number) => {
    const info = await mupdf.getPageInfo(tid, page)
    // info already accounts for inherent page rotation from worker
    // Now apply user rotation on top
    const swapped = userRotation === 90 || userRotation === 270
    return {
      width: swapped ? info.height : info.width,
      height: swapped ? info.width : info.height,
    }
  }, [mupdf])

  const calcFitScale = useCallback(async () => {
    if (!tabId || !currentPage || !rotations) return null
    try {
      const userRot = rotations[currentPage] ?? 0
      const dims = await getEffectiveDims(tabId, currentPage, userRot)
      const main = document.querySelector('main')
      if (!main) return null
      const { clientWidth, clientHeight } = main
      const padding = 48
      const isTwoPage = viewLayout === 'two-page'

      if (isTwoPage) {
        // Also check second page dimensions
        const nextPage = currentPage + 1
        let pageW = dims.width
        let pageH = dims.height
        if (nextPage <= (activeTabRef.current?.numPages ?? 0)) {
          const userRot2 = rotations[nextPage] ?? 0
          const dims2 = await getEffectiveDims(tabId, nextPage, userRot2)
          // Use the larger width and taller height to ensure both pages fit
          pageW = Math.max(dims.width, dims2.width)
          pageH = Math.max(dims.height, dims2.height)
        }
        const gap = 16
        const availW = clientWidth - padding - gap
        const fitScaleW = availW / (pageW * 2)
        const fitScaleH = (clientHeight - padding) / pageH
        return Math.round(Math.min(fitScaleW, fitScaleH) * 100) / 100
      }

      const fitScale = Math.min(
        (clientWidth - padding) / dims.width,
        (clientHeight - padding) / dims.height,
      )
      return Math.round(fitScale * 100) / 100
    } catch {
      return null
    }
  }, [tabId, currentPage, viewLayout, rotations, getEffectiveDims])

  /** Auto fit-to-page when file first opens */
  useEffect(() => {
    if (!activeTab || activeTab.isLoading) return
    if (fittedRef.current === activeTab.id) return
    fittedRef.current = activeTab.id
    lastLayoutRef.current = activeTab.viewLayout

    const timer = setTimeout(async () => {
      const fitScale = await calcFitScale()
      if (fitScale && fitScale > 0.1 && mountedRef.current) {
        dispatch({ type: 'SET_SCALE', payload: { tabId: activeTab.id, scale: Math.max(0.1, Math.min(5, fitScale)) } })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [activeTab?.id, activeTab?.isLoading, calcFitScale, dispatch])

  /** Refit when view layout changes (single <-> two-page) */
  useEffect(() => {
    if (!activeTab || activeTab.isLoading) return
    if (lastLayoutRef.current === activeTab.viewLayout) return
    lastLayoutRef.current = activeTab.viewLayout

    const timer = setTimeout(async () => {
      const fitScale = await calcFitScale()
      if (fitScale && fitScale > 0.1 && mountedRef.current) {
        dispatch({ type: 'SET_SCALE', payload: { tabId: activeTab.id, scale: Math.max(0.1, Math.min(5, fitScale)) } })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [activeTab?.viewLayout, activeTab?.id, activeTab?.isLoading, calcFitScale, dispatch])

  /** Auto refit when container resizes (drawer toggle, window resize) */
  useEffect(() => {
    if (!activeTab || activeTab.isLoading) return
    const main = document.querySelector('main')
    if (!main) return

    let resizeTimer: ReturnType<typeof setTimeout>
    let firstCall = true
    const observer = new ResizeObserver(() => {
      if (firstCall) { firstCall = false; return }
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(async () => {
        const fitScale = await calcFitScale()
        if (fitScale && fitScale > 0.1 && activeTab && mountedRef.current) {
          dispatch({ type: 'SET_SCALE', payload: { tabId: activeTab.id, scale: Math.max(0.1, Math.min(5, fitScale)) } })
        }
      }, 100)
    })
    observer.observe(main)
    return () => { observer.disconnect(); clearTimeout(resizeTimer) }
  }, [activeTab?.id, activeTab?.isLoading, activeTab?.viewLayout, calcFitScale, dispatch])

  const render = useCallback(async () => {
    if (!activeTab || !canvasRef.current || renderingRef.current) return
    renderingRef.current = true
    setIsRendering(true)
    try {
      const dpr = window.devicePixelRatio || 1
      const isTwoPage = activeTab.viewLayout === 'two-page'
      const rotation = activeTab.rotations[activeTab.currentPage] ?? 0

      const bitmap = await mupdf.renderPage(
        activeTab.id,
        activeTab.currentPage,
        activeTab.scale * dpr,
        rotation,
      )
      const canvas = canvasRef.current
      if (!canvas) { bitmap.close(); return }
      renderBitmapToCanvas(canvas, bitmap)
      bitmap.close()

      const canvas2 = canvas2Ref.current
      if (isTwoPage && canvas2) {
        const nextPage = activeTab.currentPage + 1
        if (nextPage <= activeTab.numPages) {
          const rotation2 = activeTab.rotations[nextPage] ?? 0
          const bitmap2 = await mupdf.renderPage(
            activeTab.id,
            nextPage,
            activeTab.scale * dpr,
            rotation2,
          )
          renderBitmapToCanvas(canvas2, bitmap2)
          bitmap2.close()
          canvas2.style.display = 'block'
        } else {
          canvas2.width = 0
          canvas2.height = 0
          canvas2.style.display = 'none'
        }
      } else if (canvas2) {
        canvas2.style.display = 'none'
      }
    } catch (e) {
      console.error('Render error', e)
    } finally {
      renderingRef.current = false
      if (mountedRef.current) setIsRendering(false)
    }
  }, [activeTab, mupdf])

  useEffect(() => { render() }, [render])

  // Keyboard navigation
  useEffect(() => {
    if (!activeTab) return
    const { id: tabId, currentPage, numPages, scale, viewLayout } = activeTab
    const isTwoPage = viewLayout === 'two-page'
    const step = isTwoPage ? 2 : 1

    function snapOdd(p: number): number {
      if (isTwoPage && p > 1 && p % 2 === 0) return p - 1
      return p
    }

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: snapOdd(Math.min(currentPage + step, numPages)) } })
          break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: snapOdd(Math.max(currentPage - step, 1)) } })
          break
        case 'Home':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: 1 } }); break
        case 'End':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: snapOdd(numPages) } }); break
        case '+': case '=':
          dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.min(scale + 0.1, 5) } }); break
        case '-':
          dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.max(scale - 0.1, 0.1) } }); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, dispatch])

  // Scroll wheel navigation
  useEffect(() => {
    if (!activeTab) return

    function onWheel(e: WheelEvent) {
      const tab = activeTabRef.current
      if (!tab) return

      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (scrollCooldownRef.current) return
      if (Math.abs(e.deltaY) < 30) return

      e.preventDefault()
      scrollCooldownRef.current = true

      const { id: tid, currentPage: cp, numPages: np, viewLayout: vl } = tab
      const isTwoPage = vl === 'two-page'
      const step = isTwoPage ? 2 : 1
      const snapOdd = (p: number) => (isTwoPage && p > 1 && p % 2 === 0) ? p - 1 : p

      if (e.deltaY > 0 && cp < np) {
        dispatch({ type: 'SET_PAGE', payload: { tabId: tid, page: snapOdd(Math.min(cp + step, np)) } })
      } else if (e.deltaY < 0 && cp > 1) {
        dispatch({ type: 'SET_PAGE', payload: { tabId: tid, page: snapOdd(Math.max(cp - step, 1)) } })
      }

      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        scrollCooldownRef.current = false
        scrollTimerRef.current = null
      }, 500)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', onWheel, { passive: false })
      return () => {
        container.removeEventListener('wheel', onWheel)
        if (scrollTimerRef.current) {
          clearTimeout(scrollTimerRef.current)
          scrollTimerRef.current = null
          scrollCooldownRef.current = false
        }
      }
    }
  }, [activeTab?.id, dispatch])

  const isTwoPage = activeTab?.viewLayout === 'two-page'
  const hasNextPage = activeTab ? activeTab.currentPage + 1 <= activeTab.numPages : false

  const renderingOverlay = isRendering && (
    <div className="absolute inset-0 flex items-center justify-center rendering-overlay">
      <div className="flex flex-col items-center gap-3 px-5 py-4 rendering-panel">
        <svg className="spinner-md" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--md-primary-40)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="text-label-medium text-on-surface-variant">Rendering page…</span>
      </div>
    </div>
  )

  if (isTwoPage) {
    return (
      <div ref={containerRef} className="relative flex items-start justify-center gap-4">
        <div className="redact-frame">
          <canvas ref={canvasRef} className="block" />
        </div>
        {hasNextPage && (
          <div className="redact-frame">
            <canvas ref={canvas2Ref} className="block" />
          </div>
        )}
        {!hasNextPage && <canvas ref={canvas2Ref} className="hidden" />}
        {renderingOverlay}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <canvas ref={canvasRef} className="block" />
      <canvas ref={canvas2Ref} className="hidden" />
      {renderingOverlay}
    </div>
  )
}

import { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../../context/AppContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { renderBitmapToCanvas } from '../../../utils/canvas'

export default function PdfViewer() {
  const { state, activeTab, dispatch } = useApp()
  const mupdf = useMupdf()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderingRef = useRef(false)
  const fittedRef = useRef<string | null>(null) // tracks which tab has been auto-fitted
  const scrollCooldownRef = useRef(false)

  /** Calculate fit-to-page scale for the current viewport */
  const calcFitScale = useCallback(async () => {
    if (!activeTab) return null
    try {
      const info = await mupdf.getPageInfo(activeTab.id, activeTab.currentPage)
      const main = document.querySelector('main')
      if (!main) return null
      const { clientWidth, clientHeight } = main
      const padding = 48
      const isTwoPage = activeTab.viewLayout === 'two-page'

      if (isTwoPage) {
        // Fit both pages side by side with gap
        const gap = 16
        const availW = clientWidth - padding - gap
        const fitScaleW = availW / (info.width * 2)
        const fitScaleH = (clientHeight - padding) / info.height
        return Math.round(Math.min(fitScaleW, fitScaleH) * 100) / 100
      }

      const fitScale = Math.min(
        (clientWidth - padding) / info.width,
        (clientHeight - padding) / info.height,
      )
      return Math.round(fitScale * 100) / 100
    } catch {
      return null
    }
  }, [activeTab, mupdf])

  /** Auto fit-to-page when file first opens */
  useEffect(() => {
    if (!activeTab || activeTab.isLoading) return
    if (fittedRef.current === activeTab.id) return // already fitted this tab
    fittedRef.current = activeTab.id

    // Small delay to let the DOM layout settle
    const timer = setTimeout(async () => {
      const fitScale = await calcFitScale()
      if (fitScale && fitScale > 0.1) {
        dispatch({ type: 'SET_SCALE', payload: { tabId: activeTab.id, scale: Math.max(0.1, Math.min(5, fitScale)) } })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [activeTab?.id, activeTab?.isLoading, calcFitScale, dispatch])

  /** Auto refit when drawer toggles (container width changes) */
  useEffect(() => {
    if (!activeTab || activeTab.isLoading) return
    // Use ResizeObserver on main to detect width changes
    const main = document.querySelector('main')
    if (!main) return

    let resizeTimer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(async () => {
        const fitScale = await calcFitScale()
        if (fitScale && fitScale > 0.1 && activeTab) {
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
    try {
      const dpr = window.devicePixelRatio || 1
      const isTwoPage = activeTab.viewLayout === 'two-page'
      const rotation = activeTab.rotations[activeTab.currentPage] ?? 0

      // Render first (left) page
      const bitmap = await mupdf.renderPage(
        activeTab.id,
        activeTab.currentPage,
        activeTab.scale * dpr,
        rotation,
      )
      const canvas = canvasRef.current
      if (!canvas) return
      renderBitmapToCanvas(canvas, bitmap)
      bitmap.close()

      // Render second (right) page in two-page mode
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
          // Odd last page — hide second canvas
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
    }
  }, [activeTab, mupdf])

  useEffect(() => { render() }, [render])

  // Keyboard navigation
  useEffect(() => {
    if (!activeTab) return
    const { id: tabId, currentPage, numPages, scale, viewLayout } = activeTab
    const isTwoPage = viewLayout === 'two-page'
    const step = isTwoPage ? 2 : 1

    /** In two-page mode, snap to odd page so pairs are (1,2), (3,4), etc. */
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
    const { id: tabId, currentPage, numPages, viewLayout } = activeTab
    const isTwoPage = viewLayout === 'two-page'
    const step = isTwoPage ? 2 : 1

    function snapOdd(p: number): number {
      if (isTwoPage && p > 1 && p % 2 === 0) return p - 1
      return p
    }

    function onWheel(e: WheelEvent) {
      // Skip if inside an input or if cooldown is active
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (scrollCooldownRef.current) return

      // Only respond to vertical scroll with sufficient delta
      if (Math.abs(e.deltaY) < 10) return

      e.preventDefault()
      scrollCooldownRef.current = true

      if (e.deltaY > 0 && currentPage < numPages) {
        // Scroll down → next page
        dispatch({ type: 'SET_PAGE', payload: { tabId, page: snapOdd(Math.min(currentPage + step, numPages)) } })
      } else if (e.deltaY < 0 && currentPage > 1) {
        // Scroll up → previous page
        dispatch({ type: 'SET_PAGE', payload: { tabId, page: snapOdd(Math.max(currentPage - step, 1)) } })
      }

      // Cooldown to prevent rapid page flipping
      setTimeout(() => { scrollCooldownRef.current = false }, 300)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', onWheel, { passive: false })
      return () => container.removeEventListener('wheel', onWheel)
    }
  }, [activeTab, dispatch])

  const isTwoPage = activeTab?.viewLayout === 'two-page'

  return (
    <div
      ref={containerRef}
      className={isTwoPage ? 'flex gap-4 items-start justify-center' : undefined}
    >
      <canvas ref={canvasRef} className="block" />
      <canvas
        ref={canvas2Ref}
        className="block"
        style={{ display: isTwoPage ? 'block' : 'none' }}
      />
    </div>
  )
}

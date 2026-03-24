import { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../../context/AppContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { renderBitmapToCanvas } from '../../../utils/canvas'

export default function PdfViewer() {
  const { activeTab, dispatch } = useApp()
  const mupdf = useMupdf()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderingRef = useRef(false)

  const render = useCallback(async () => {
    if (!activeTab || !canvasRef.current || renderingRef.current) return
    renderingRef.current = true
    try {
      const dpr = window.devicePixelRatio || 1
      const bitmap = await mupdf.renderPage(
        activeTab.id,
        activeTab.currentPage,
        activeTab.scale * dpr,
      )
      const canvas = canvasRef.current
      if (!canvas) return
      renderBitmapToCanvas(canvas, bitmap)
      bitmap.close()
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
    const { id: tabId, currentPage, numPages, scale } = activeTab
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: Math.min(currentPage + 1, numPages) } }); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: Math.max(currentPage - 1, 1) } }); break
        case 'Home':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: 1 } }); break
        case 'End':
          dispatch({ type: 'SET_PAGE', payload: { tabId, page: numPages } }); break
        case '+': case '=':
          dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.min(scale + 0.1, 5) } }); break
        case '-':
          dispatch({ type: 'SET_SCALE', payload: { tabId, scale: Math.max(scale - 0.1, 0.1) } }); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, dispatch])

  return <canvas ref={canvasRef} className="block" />
}

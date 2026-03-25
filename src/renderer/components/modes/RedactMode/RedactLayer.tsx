import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../../context/AppContext'
import type { RedactionRect } from '../../../types/annotations'

export default function RedactLayer() {
  const { activeTab, dispatch } = useApp()
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const scale = activeTab?.scale ?? 1
  // Use CSS (logical) dimensions, not canvas.width which includes DPR scaling
  const canvas = document.querySelector('canvas.block') as HTMLCanvasElement | null
  const width = canvas?.clientWidth || canvas?.width || 800
  const height = canvas?.clientHeight || canvas?.height || 1000

  // Get mouse position in canvas (CSS) pixels
  const getPos = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    const { x, y } = getPos(e)
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    const { x, y } = getPos(e)
    setDrawing(d => d ? { ...d, currentX: x, currentY: y } : null)
  }

  function onMouseUp() {
    if (!drawing || !activeTab) return
    const { startX, startY, currentX, currentY } = drawing
    const w = Math.abs(currentX - startX)
    const h = Math.abs(currentY - startY)
    if (w > 4 && h > 4) {
      // Convert from scaled canvas pixels → PDF points (unscaled)
      const rect: RedactionRect = {
        id: crypto.randomUUID(),
        page: activeTab.currentPage,
        type: 'redaction',
        // Store coordinates in canvas (CSS) pixels to match other annotations
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: w,
        height: h,
      }
      dispatch({ type: 'ADD_REDACTION', payload: { tabId: activeTab.id, page: activeTab.currentPage, rect } })
    }
    setDrawing(null)
  }

  const pageRedactions: RedactionRect[] = activeTab?.redactions[activeTab.currentPage] ?? []

  return (
    <div className="absolute inset-0 cursor-crosshair">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {/* Render stored redactions — scale from PDF points back to canvas pixels */}
        {pageRedactions.map(r => (
          <rect key={r.id}
            x={r.x} y={r.y}
            width={r.width} height={r.height}
            fill="black" opacity={0.85} />
        ))}
        {/* Live drawing preview — already in canvas pixels */}
        {drawing && (
          <rect
            x={Math.min(drawing.startX, drawing.currentX)}
            y={Math.min(drawing.startY, drawing.currentY)}
            width={Math.abs(drawing.currentX - drawing.startX)}
            height={Math.abs(drawing.currentY - drawing.startY)}
            fill="black" opacity={0.6} strokeDasharray="4 4" stroke="var(--md-error-40)" strokeWidth={1}
          />
        )}
      </svg>
    </div>
  )
}

import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../../../context/AppContext'
import { useAnnotations } from '../../../hooks/useAnnotations'
import type { Annotation, ToolName } from '../../../types/annotations'

interface DrawingState {
  tool: ToolName
  startX: number
  startY: number
  currentX: number
  currentY: number
  points: number[]
  active: boolean
}

interface TextInputState {
  x: number
  y: number
  width: number
  height: number
}

/* ── Static annotation shape renderer ────────────────────────────────── */
function AnnotationShape({ ann, selected, onSelect }: {
  ann: Annotation
  selected: boolean
  onSelect: (id: string) => void
}) {
  const outline = selected ? (
    <rect
      x={(ann as any).x - 2} y={(ann as any).y - 2}
      width={((ann as any).width ?? (ann as any).radiusX * 2) + 4}
      height={((ann as any).height ?? (ann as any).radiusY * 2) + 4}
      fill="none" stroke="var(--md-primary-40)" strokeWidth={1.5} strokeDasharray="4 3"
      rx={2} ry={2}
    />
  ) : null

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect(ann.id)
  }

  switch (ann.type) {
    case 'highlight':
      return <g onClick={handleClick} className="cursor-pointer">
        {outline}
        <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height}
          fill={ann.color} opacity={ann.opacity} />
      </g>
    case 'text':
      return <g onClick={handleClick} className="cursor-pointer">
        <text x={ann.x} y={ann.y + ann.fontSize} fontSize={ann.fontSize}
          fill={ann.color} className="no-select">{ann.text}</text>
        {selected && <rect x={ann.x - 2} y={ann.y - 2} width={104} height={ann.fontSize + 8}
          fill="none" stroke="var(--md-primary-40)" strokeWidth={1.5} strokeDasharray="4 3" rx={2} ry={2} />}
      </g>
    case 'freehand': {
      if (ann.points.length < 4) return null
      let d = `M ${ann.points[0]} ${ann.points[1]}`
      for (let i = 2; i < ann.points.length; i += 2) {
        d += ` L ${ann.points[i]} ${ann.points[i + 1]}`
      }
      return <g onClick={handleClick} className="cursor-pointer">
        <path d={d} stroke={ann.color} strokeWidth={ann.lineWidth}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Wider invisible hit area */}
        <path d={d} stroke="transparent" strokeWidth={Math.max(ann.lineWidth + 8, 12)} fill="none" />
      </g>
    }
    case 'rect':
      return <g onClick={handleClick} className="cursor-pointer">
        {selected && <rect x={ann.x - 3} y={ann.y - 3} width={ann.width + 6} height={ann.height + 6}
          fill="none" stroke="var(--md-primary-40)" strokeWidth={1.5} strokeDasharray="4 3" rx={2} ry={2} />}
        <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height}
          stroke={ann.color} strokeWidth={ann.lineWidth} fill="transparent" />
      </g>
    case 'ellipse':
      return <g onClick={handleClick} className="cursor-pointer">
        {selected && <ellipse cx={ann.x} cy={ann.y} rx={ann.radiusX + 3} ry={ann.radiusY + 3}
          fill="none" stroke="var(--md-primary-40)" strokeWidth={1.5} strokeDasharray="4 3" />}
        <ellipse cx={ann.x} cy={ann.y} rx={ann.radiusX} ry={ann.radiusY}
          stroke={ann.color} strokeWidth={ann.lineWidth} fill="transparent" />
      </g>
    case 'ocrEdit':
      return <>
        <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="white" />
        <text x={ann.x} y={ann.y + ann.fontSize} fontSize={ann.fontSize}
          fontFamily={ann.fontFamily} fontStyle={ann.fontStyle}
          fontWeight={ann.fontWeight} fill="black" className="no-select">{ann.newText}</text>
      </>
    default:
      return null
  }
}

/* ── Preview shape while drawing ────────────────────────────────────── */
function PreviewShape({ drawing, color }: { drawing: DrawingState; color: string }) {
  const { tool, startX, startY, currentX, currentY, points } = drawing
  if (tool === 'highlight')
    return <rect x={Math.min(startX, currentX)} y={Math.min(startY, currentY)}
      width={Math.abs(currentX - startX)} height={Math.abs(currentY - startY)}
      fill={color} opacity={0.4} />
  if (tool === 'freehand') {
    let d = `M ${points[0]} ${points[1]}`
    for (let i = 2; i < points.length; i += 2) d += ` L ${points[i]} ${points[i + 1]}`
    return <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
  }
  if (tool === 'text' || tool === 'rect')
    return <rect x={Math.min(startX, currentX)} y={Math.min(startY, currentY)}
      width={Math.abs(currentX - startX)} height={Math.abs(currentY - startY)}
      stroke={color} strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
  if (tool === 'ellipse')
    return <ellipse cx={(startX + currentX) / 2} cy={(startY + currentY) / 2}
      rx={Math.abs(currentX - startX) / 2} ry={Math.abs(currentY - startY) / 2}
      stroke={color} strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
  return null
}

/* ── Main AnnotationLayer ───────────────────────────────────────────── */
export default function AnnotationLayer() {
  const { activeTab, dispatch } = useApp()
  const { add, getPage } = useAnnotations(activeTab?.id ?? '')
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [textInput, setTextInput] = useState<TextInputState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

  function getCanvasDims() {
    const svg = svgRef.current
    const canvas = svg?.parentElement?.parentElement?.querySelector('canvas')
    if (!canvas) return { width: 800, height: 1000 }
    // Use CSS (logical) dimensions, not canvas.width which includes DPR scaling
    return {
      width: canvas.clientWidth || canvas.width,
      height: canvas.clientHeight || canvas.height,
    }
  }

  const dims = getCanvasDims()

  useEffect(() => {
    if (textInput && textInputRef.current) textInputRef.current.focus()
  }, [textInput])

  // Delete selected annotation on Delete/Backspace
  useEffect(() => {
    if (!selectedId || !activeTab) return
    function handleKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && activeTab) {
        // Remove the selected annotation from state
        const page = activeTab.currentPage
        const anns = activeTab.annotations[page] ?? []
        const idx = anns.findIndex(a => a.id === selectedId)
        if (idx >= 0) {
          dispatch({
            type: 'UPDATE_TAB',
            payload: {
              tabId: activeTab.id,
              annotations: {
                ...activeTab.annotations,
                [page]: anns.filter(a => a.id !== selectedId),
              },
            },
          })
        }
        setSelectedId(null)
      }
      if (e.key === 'Escape') setSelectedId(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedId, activeTab, dispatch])

  const getPos = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  function commitText(value: string) {
    if (value.trim() && activeTab && textInput) {
      add(activeTab.currentPage, {
        id: crypto.randomUUID(), page: activeTab.currentPage,
        type: 'text', x: textInput.x, y: textInput.y, text: value.trim(),
        fontSize: 14, color: activeTab.activeColor,
      })
    }
    setTextInput(null)
  }

  function onMouseDown(e: React.MouseEvent) {
    if (textInput) {
      if (e.target !== textInputRef.current) commitText(textInputRef.current?.value ?? '')
      return
    }
    // If no tool active, clicking SVG background deselects
    if (!activeTab?.activeTool) {
      setSelectedId(null)
      return
    }
    setSelectedId(null)
    const { x, y } = getPos(e)
    setDrawing({ tool: activeTab.activeTool, startX: x, startY: y, currentX: x, currentY: y, points: [x, y], active: true })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing?.active) return
    const { x, y } = getPos(e)
    setDrawing(d => d ? { ...d, currentX: x, currentY: y, points: [...d.points, x, y] } : null)
  }

  function onMouseUp() {
    if (!drawing?.active || !activeTab) return
    const { tool, startX, startY, currentX, currentY, points } = drawing
    const page = activeTab.currentPage
    const color = activeTab.activeColor
    const id = crypto.randomUUID()
    const w = currentX - startX
    const h = currentY - startY
    const minSize = 4

    if (tool === 'text' && Math.abs(w) > minSize && Math.abs(h) > minSize) {
      setTextInput({ x: Math.min(startX, currentX), y: Math.min(startY, currentY), width: Math.abs(w), height: Math.abs(h) })
    } else if (tool === 'highlight' && Math.abs(w) > minSize && Math.abs(h) > minSize) {
      add(page, { id, page, type: 'highlight', x: Math.min(startX, currentX), y: Math.min(startY, currentY), width: Math.abs(w), height: Math.abs(h), color, opacity: 0.4 })
    } else if (tool === 'freehand' && points.length > 4) {
      add(page, { id, page, type: 'freehand', points, color, lineWidth: 2 })
    } else if (tool === 'rect' && Math.abs(w) > minSize && Math.abs(h) > minSize) {
      add(page, { id, page, type: 'rect', x: Math.min(startX, currentX), y: Math.min(startY, currentY), width: Math.abs(w), height: Math.abs(h), color, lineWidth: 2 })
    } else if (tool === 'ellipse' && Math.abs(w) > minSize && Math.abs(h) > minSize) {
      add(page, { id, page, type: 'ellipse', x: (startX + currentX) / 2, y: (startY + currentY) / 2, radiusX: Math.abs(w) / 2, radiusY: Math.abs(h) / 2, color, lineWidth: 2 })
    }
    setDrawing(null)
  }

  const pageAnnotations = activeTab ? getPage(activeTab.currentPage) : []
  const hasTool = !!activeTab?.activeTool

  return (
    <div className="annotation-layer-container">
      <svg
        ref={svgRef}
        width={dims.width}
        height={dims.height}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className={hasTool ? 'annotation-svg cursor-crosshair' : 'annotation-svg cursor-default'}
      >
        {pageAnnotations.map(ann => (
          <AnnotationShape
            key={ann.id}
            ann={ann}
            selected={selectedId === ann.id}
            onSelect={setSelectedId}
          />
        ))}
        {drawing?.active && <PreviewShape drawing={drawing} color={activeTab?.activeColor ?? '#f59e0b'} />}
      </svg>

      {textInput && (
        <textarea
          ref={textInputRef}
          className="annotation-textarea"
          style={{ left: textInput.x, top: textInput.y, width: textInput.width, height: textInput.height, color: activeTab?.activeColor ?? '#f59e0b', border: `2px dashed ${activeTab?.activeColor ?? '#f59e0b'}` }}
          placeholder="Type text..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitText((e.target as HTMLTextAreaElement).value)
            } else if (e.key === 'Escape') setTextInput(null)
            e.stopPropagation()
          }}
          onMouseDown={e => e.stopPropagation()}
          onBlur={e => commitText(e.target.value)}
        />
      )}
    </div>
  )
}

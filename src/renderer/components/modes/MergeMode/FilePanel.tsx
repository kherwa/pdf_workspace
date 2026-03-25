import { useRef, useEffect, useState } from 'react'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { attachClosestEdge, extractClosestEdge, type Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useApp } from '../../../context/AppContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { renderBitmapToCanvas } from '../../../utils/canvas'
import { createPageOrder } from '../../../utils/array'
import type { MergeSource } from '../../../types/app'
import { GripVerticalIcon, XIcon } from '../../shared/Icons'

interface Props { source: MergeSource }

function ThumbnailCard({ tabId, page, selected, onToggle }: { tabId: string; page: number; selected: boolean; onToggle: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mupdf = useMupdf()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    mupdf.getThumbnail(tabId, page, window.devicePixelRatio || 1).then(bitmap => {
      if (cancelled || !bitmap || !canvasRef.current) return
      renderBitmapToCanvas(canvasRef.current, bitmap)
      setLoaded(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [tabId, page, mupdf])

  return (
    <button
      onClick={onToggle}
      className={`relative flex flex-col items-center gap-1.5 shrink-0 transition-colors ${selected ? 'thumb-selected' : ''}`}
    >
      <div className="relative bg-white flex items-center justify-center thumb-card">
        <canvas ref={canvasRef} className={`thumb-canvas ${loaded ? '' : 'hidden'}`} />
        {!loaded && (
          <div className="w-full h-full animate-pulse bg-surface-container" />
        )}
        {selected && (
          <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center selected-badge">
            <XIcon size={12} />
          </span>
        )}
      </div>
      <span className="text-label-small text-on-surface-muted">{page}</span>
    </button>
  )
}

export default function FilePanel({ source }: Props) {
  const { dispatch } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)

  useEffect(() => {
    const el = ref.current
    const handle = handleRef.current
    if (!el || !handle) return

    const cleanupDrag = draggable({
      element: el,
      dragHandle: handle,
      getInitialData: () => ({ type: 'file-panel', tabId: source.tabId }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })
    const cleanupDrop = dropTargetForElements({
      element: el,
      canDrop: ({ source: s }) => s.data.type === 'file-panel' && s.data.tabId !== source.tabId,
      getData: ({ input, element }) => attachClosestEdge(
        { tabId: source.tabId },
        { element, input, allowedEdges: ['top', 'bottom'] },
      ),
      onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    })
    return () => { cleanupDrag(); cleanupDrop() }
  }, [source.tabId])

  const pages = createPageOrder(source.numPages)
  const excluded = source.selectedPages

  function togglePage(page: number) {
    dispatch({ type: 'TOGGLE_MERGE_PAGE', payload: { tabId: source.tabId, page } })
  }

  return (
    <div
      ref={ref}
      className={`flex flex-col shrink-0 overflow-hidden file-panel ${isDragging ? 'dragging' : ''}`}
    >
      {/* Drop indicator — top edge */}
      {closestEdge === 'top' && (
        <div className="drop-indicator top" />
      )}
      {/* Drop indicator — bottom edge */}
      {closestEdge === 'bottom' && (
        <div className="drop-indicator bottom" />
      )}

      {/* Header — drag handle */}
      <div
        ref={handleRef}
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing file-panel-header"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVerticalIcon size={16} className="shrink-0 text-on-surface-muted" />
          <span className="text-title-small truncate">{source.fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-label-small text-on-surface-muted">
            {excluded.length ? `${source.numPages - excluded.length} / ${source.numPages} pages` : `All ${source.numPages} pages`}
            {' \u00B7 '}Click to exclude
          </span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => dispatch({ type: 'REMOVE_MERGE_SOURCE', payload: { tabId: source.tabId } })}
            className="btn-icon-sm shrink-0 btn-icon-28"
            aria-label={`Remove ${source.fileName}`}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {/* Page thumbnails — horizontal scroll */}
      <div className="flex items-start gap-3 p-4 overflow-x-auto filepanel-pages-bg">
        {pages.map(p => (
          <ThumbnailCard
            key={p}
            tabId={source.tabId}
            page={p}
            selected={excluded.includes(p)}
            onToggle={() => togglePage(p)}
          />
        ))}
      </div>
    </div>
  )
}

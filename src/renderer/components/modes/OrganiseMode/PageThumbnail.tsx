import { useRef, useEffect, useState } from 'react'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { attachClosestEdge, extractClosestEdge, type Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { renderBitmapToCanvas } from '../../../utils/canvas'

interface Props {
  page: number
  tabId: string
  bitmap: ImageBitmap | null
  rotation: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onRotateCW: () => void
  onRotateCCW: () => void
}

export default function PageThumbnail({ page, tabId, bitmap, rotation, selected, onSelect, onDelete, onRotateCW, onRotateCCW }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cleanupDrag = draggable({
      element: el,
      getInitialData: () => ({ type: 'page', page, tabId }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })
    const cleanupDrop = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'page' && source.data.page !== page,
      getData: ({ input, element }) => attachClosestEdge(
        { page },
        { element, input, allowedEdges: ['left', 'right'] },
      ),
      onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    })
    return () => { cleanupDrag(); cleanupDrop() }
  }, [page, tabId])

  useEffect(() => {
    if (!bitmap || !canvasRef.current) return
    renderBitmapToCanvas(canvasRef.current, bitmap)
  }, [bitmap])

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.4 : 1, position: 'relative' }}
      className="group flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing"
      onClick={onSelect}
    >
      {/* Drop indicator — left edge */}
      {closestEdge === 'left' && (
        <div style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: 'var(--md-primary-40)' }} />
      )}
      {/* Drop indicator — right edge */}
      {closestEdge === 'right' && (
        <div style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: 'var(--md-primary-40)' }} />
      )}

      <div
        className="relative bg-white w-full aspect-[3/4] flex items-center justify-center thumb-card-rotate"
        style={{
          '--rotation': `${rotation}deg`,
          borderRadius: 'var(--md-radius-md)',
          overflow: 'hidden',
          outline: selected ? '2px solid var(--md-primary-40)' : 'none',
          outlineOffset: 2,
        } as React.CSSProperties}
      >
        {bitmap ? (
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full animate-pulse bg-surface-container" />
        )}
      </div>
      <span className="text-label-small text-on-surface-muted">{page}</span>
    </div>
  )
}

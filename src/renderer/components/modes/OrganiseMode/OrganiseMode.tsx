import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index'
import { useApp } from '../../../context/AppContext'
import { useDialog } from '../../../context/DialogContext'
import { useThumbnails } from '../../../hooks/useThumbnails'
import { reorder } from '../../../utils/array'
import PageThumbnail from './PageThumbnail'

export default function OrganiseMode() {
  const { state, activeTab, dispatch } = useApp()
  const { confirm } = useDialog()
  const { getThumbnail, getCached, invalidate } = useThumbnails()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeTab) return
    for (const p of activeTab.pageOrder) {
      getThumbnail(activeTab.id, p)
    }
  }, [activeTab, getThumbnail])

  // Monitor for drag-and-drop reorder events
  useEffect(() => {
    if (!activeTab) return
    const { id: tabId, pageOrder } = activeTab

    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'page',
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0]
        if (!target) return
        const sourcePage = source.data.page as number
        const targetPage = target.data.page as number
        if (sourcePage === targetPage) return

        const startIndex = pageOrder.indexOf(sourcePage)
        const indexOfTarget = pageOrder.indexOf(targetPage)
        const closestEdge = extractClosestEdge(target.data)

        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: closestEdge,
          axis: 'horizontal',
        })

        const newOrder = reorder(pageOrder, startIndex, finishIndex)
        dispatch({ type: 'REORDER_PAGES', payload: { tabId, newOrder } })
        invalidate(tabId)
      },
    })
  }, [activeTab, dispatch, invalidate])

  if (!activeTab) return null
  const { id: tabId, pageOrder } = activeTab

  async function handleDelete(page: number) {
    const ok = await confirm({
      title: 'Delete page?',
      message: `Delete page ${page}? This change is staged until you Save.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    dispatch({ type: 'DELETE_PAGES', payload: { tabId, pages: [page] } })
  }

  function handleRotate(page: number, delta: 90 | -90) {
    dispatch({ type: 'ROTATE_PAGE', payload: { tabId, page, delta } })
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto p-6 organise-grid">
      {pageOrder.map(page => (
        <PageThumbnail
          key={page}
          page={page}
          tabId={tabId}
          bitmap={getCached(tabId, page)}
          rotation={activeTab.rotations[page] ?? 0}
          selected={state.selectedOrganisePage === page}
          onSelect={() => dispatch({ type: 'SET_ORGANISE_PAGE', payload: { page: state.selectedOrganisePage === page ? null : page } })}
          onDelete={() => handleDelete(page)}
          onRotateCW={() => handleRotate(page, 90)}
          onRotateCCW={() => handleRotate(page, -90)}
        />
      ))}
    </div>
  )
}

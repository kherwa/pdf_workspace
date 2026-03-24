import { useEffect, useState, useRef, useCallback } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index'
import { useApp } from '../../../context/AppContext'
import { useFileSystem } from '../../../hooks/useFileSystem'
import { useClickOutside } from '../../../hooks/useClickOutside'
import { reorder } from '../../../utils/array'
import FilePanel from './FilePanel'
import { PlusIcon, FileIcon, FolderOpenIcon } from '../../shared/Icons'

export default function MergeMode() {
  const { state, dispatch } = useApp()
  const { openFilesForMerge } = useFileSystem()
  const { mergeSources, tabs } = state
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tabs not yet added as merge sources (exclude the "New Document" placeholder)
  const availableTabs = tabs.filter(
    t => !t.isLoading && t.fileName !== 'New Document' && !mergeSources.some(s => s.tabId === t.id)
  )

  const closeMenu = useCallback(() => setShowMenu(false), [])
  useClickOutside(menuRef, showMenu, closeMenu)

  // Monitor for drag-and-drop reorder events
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'file-panel',
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0]
        if (!target) return
        const sourceTabId = source.data.tabId as string
        const targetTabId = target.data.tabId as string
        if (sourceTabId === targetTabId) return

        const startIndex = mergeSources.findIndex(s => s.tabId === sourceTabId)
        const indexOfTarget = mergeSources.findIndex(s => s.tabId === targetTabId)
        const closestEdge = extractClosestEdge(target.data)

        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: closestEdge,
          axis: 'vertical',
        })

        dispatch({ type: 'REORDER_MERGE', payload: { sources: reorder(mergeSources, startIndex, finishIndex) } })
      },
    })
  }, [mergeSources, dispatch])

  function addOpenTab(tabId: string) {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return
    dispatch({
      type: 'ADD_MERGE_SOURCE',
      payload: {
        source: {
          tabId: tab.id,
          fileName: tab.fileName,
          numPages: tab.numPages,
          selectedPages: [],
        },
      },
    })
    setShowMenu(false)
  }

  function addAllOpenTabs() {
    for (const tab of availableTabs) {
      dispatch({
        type: 'ADD_MERGE_SOURCE',
        payload: {
          source: {
            tabId: tab.id,
            fileName: tab.fileName,
            numPages: tab.numPages,
            selectedPages: [],
          },
        },
      })
    }
    setShowMenu(false)
  }

  // Add Files card with dropdown menu
  function AddFilesCard() {
    return (
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-dashed"
          aria-label="Add files to merge"
        >
          <PlusIcon size={24} />
          <span className="text-label-large">Add Files</span>
        </button>

        {showMenu && (
          <div className="dropdown min-w-[320px]" style={{ top: '100%', marginTop: 4 }}>
            <button
              onClick={() => { setShowMenu(false); openFilesForMerge() }}
              className="dropdown-item"
            >
              <FolderOpenIcon size={20} />
              <span className="text-label-large">Add New Files...</span>
            </button>

            {availableTabs.length > 0 && (
              <>
                <div className="divider-h" />
                <div className="px-4 py-2">
                  <span className="text-label-small text-on-surface-muted">
                    Open tabs
                  </span>
                </div>
                {availableTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => addOpenTab(tab.id)}
                    className="dropdown-item"
                  >
                    <FileIcon size={18} />
                    <span className="text-body-medium truncate">{tab.fileName}</span>
                    <span className="text-label-small ml-auto text-on-surface-muted">
                      {tab.numPages}p
                    </span>
                  </button>
                ))}
                {availableTabs.length > 1 && (
                  <>
                    <div className="divider-h" />
                    <button
                      onClick={addAllOpenTabs}
                      className="dropdown-item text-primary"
                    >
                      <PlusIcon size={18} />
                      <span className="text-label-large">Add All Open Tabs</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!mergeSources.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <p className="text-body-large text-on-surface-muted">
          Add PDF files to merge them
        </p>
        <div className="flex gap-3">
          <button onClick={() => openFilesForMerge()} className="btn-outlined">
            <FolderOpenIcon size={20} />
            Add New Files
          </button>
          {availableTabs.length > 0 && (
            <button onClick={addAllOpenTabs} className="btn-outlined">
              <FileIcon size={20} />
              Add Open Tabs ({availableTabs.length})
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 p-4">
      {mergeSources.map(src => (
        <FilePanel key={src.tabId} source={src} />
      ))}
      <AddFilesCard />
    </div>
  )
}

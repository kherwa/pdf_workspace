import { useEffect } from 'react'
import { useFileSystem } from './useFileSystem'
import { useApp } from '../context/AppContext'
import { useDialog } from '../context/DialogContext'
import { useMupdf } from './useMupdf'
import { createPageOrder } from '../utils/array'
import type { Tab } from '../types/app'

declare global {
  interface Window {
    electronAPI: {
      onMenuOpen: (cb: () => void) => void
      onMenuSave: (cb: () => void) => void
      onMenuSaveAs: (cb: () => void) => void
      onMenuCloseTab: (cb: () => void) => void
      removeAllListeners: (channel: string) => void
      triggerMenuOpen: () => void
      triggerMenuSave: () => void
      triggerMenuSaveAs: () => void
      triggerMenuCloseTab: () => void
      setTheme: (theme: string) => void
    }
  }
}

/** Check if the tab has any organise-mode changes (reorder, rotate, delete) */
export function hasOrganiseChanges(tab: Tab): boolean {
  const defaultOrder = createPageOrder(tab.numPages)
  const orderChanged =
    tab.pageOrder.length !== defaultOrder.length ||
    tab.pageOrder.some((p, i) => p !== defaultOrder[i])
  const hasRotations = Object.values(tab.rotations).some(r => r !== 0)
  return orderChanged || hasRotations
}

export function useMenuEvents() {
  const { openFiles, saveBytes } = useFileSystem()
  const { state, dispatch } = useApp()
  const { snackbar, confirm } = useDialog()
  const mupdf = useMupdf()

  useEffect(() => {
    const api = window.electronAPI

    /** Build the final PDF bytes, applying organise changes + annotations */
    async function buildSaveBytes(tab: Tab): Promise<Uint8Array> {
      if (hasOrganiseChanges(tab)) {
        return mupdf.saveOrganised(tab.id, tab.pageOrder, tab.rotations, tab.annotations ?? {}, tab.scale)
      }
      return mupdf.saveWithAnnotations(tab.id, tab.annotations ?? {}, tab.scale)
    }

    api.onMenuOpen(() => openFiles(false))

    api.onMenuSave(async () => {
      const tab = state.tabs.find(t => t.id === state.activeTabId)
      if (!tab) return
      try {
        const bytes = await buildSaveBytes(tab)
        const handle = await saveBytes(bytes, tab.fileName, tab.fileHandle, tab.filePath)
        if (handle && !tab.fileHandle) {
          dispatch({ type: 'UPDATE_TAB', payload: { tabId: tab.id, fileHandle: handle } })
        }
        dispatch({ type: 'MARK_CLEAN', payload: { tabId: tab.id } })
      } catch (err) {
        console.error('Save failed:', err)
        snackbar(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    })

    api.onMenuSaveAs(async () => {
      const tab = state.tabs.find(t => t.id === state.activeTabId)
      if (!tab) return
      try {
        const bytes = await buildSaveBytes(tab)
        // Force Save As: pass no handle, no path
        const handle = await saveBytes(bytes, tab.fileName, null, null)
        if (handle) {
          dispatch({ type: 'UPDATE_TAB', payload: { tabId: tab.id, fileHandle: handle } })
        }
        dispatch({ type: 'MARK_CLEAN', payload: { tabId: tab.id } })
      } catch (err) {
        console.error('Save As failed:', err)
        snackbar(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    })

    api.onMenuCloseTab(async () => {
      if (!state.activeTabId) return
      const tab = state.tabs.find(t => t.id === state.activeTabId)
      if (tab?.dirty) {
        const ok = await confirm({
          title: 'Unsaved changes',
          message: `"${tab.fileName}" has unsaved changes. Close without saving?`,
          confirmLabel: 'Close without saving',
          danger: true,
        })
        if (!ok) return
      }
      mupdf.closeDocument(state.activeTabId)
      dispatch({ type: 'CLOSE_TAB', payload: { tabId: state.activeTabId } })
    })

    return () => {
      api.removeAllListeners('menu:open')
      api.removeAllListeners('menu:save')
      api.removeAllListeners('menu:saveAs')
      api.removeAllListeners('menu:closeTab')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTabId, state.tabs])
}

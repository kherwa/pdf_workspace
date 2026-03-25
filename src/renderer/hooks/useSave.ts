import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useFileSystem } from './useFileSystem'
import { useDialog } from '../context/DialogContext'
import { useMupdf } from './useMupdf'
import { appendSuffixToFileName } from '../utils/file'

/**
 * useSave centralizes save logic for tabs.
 * - save(): tries in-place save (FSA handle / path) when available
 * - saveAs(): forces Save As picker
 */
export function useSave(tabId?: string) {
  const { state, dispatch } = useApp()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()
  const { confirm, snackbar, select } = useDialog()
  const [saving, setSaving] = useState(false)

  const targetTab = tabId ? state.tabs.find(t => t.id === tabId) : state.tabs.find(t => t.id === state.activeTabId)
  const canSave = !!targetTab

  const buildSaveBytes = useCallback(async (tab: any) => {
    if (!tab) throw new Error('No tab')
    // If organise changes present, use saveOrganised
    const defaultOrder = Array.from({ length: tab.numPages }, (_, i) => i + 1)
    const orderChanged = tab.pageOrder.length !== defaultOrder.length || tab.pageOrder.some((p: number, i: number) => p !== defaultOrder[i])
    const hasRotations = Object.values(tab.rotations || {}).some((r: number) => r !== 0)
    if (orderChanged || hasRotations) {
      return mupdf.saveOrganised(tab.id, tab.pageOrder, tab.rotations ?? {}, tab.annotations ?? {}, tab.scale)
    }
    return mupdf.saveWithAnnotations(tab.id, tab.annotations ?? {}, tab.scale)
  }, [mupdf])

  const save = useCallback(async (forceSaveAs = false, saveAsSuffix?: string) => {
    if (!targetTab) return null
    setSaving(true)
    try {
      const bytes = await buildSaveBytes(targetTab)
      const suggestedName = forceSaveAs && saveAsSuffix ? appendSuffixToFileName(targetTab.fileName, saveAsSuffix) : targetTab.fileName
      const handle = await saveBytes(bytes, suggestedName, forceSaveAs ? null : targetTab.fileHandle, forceSaveAs ? null : targetTab.filePath)
      if (handle && !targetTab.fileHandle) {
        dispatch({ type: 'UPDATE_TAB', payload: { tabId: targetTab.id, fileHandle: handle } })
      }
      dispatch({ type: 'MARK_CLEAN', payload: { tabId: targetTab.id } })
      snackbar('Saved', 'success')
      return handle
    } catch (err) {
      console.error('Save failed:', err)
      snackbar(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      return null
    } finally {
      setSaving(false)
    }
  }, [targetTab, buildSaveBytes, saveBytes, dispatch, snackbar])

  const saveAs = useCallback(async (saveAsSuffix?: string) => save(true, saveAsSuffix), [save])

  // Optionally expose an action that prompts user to confirm overwriting
  // Prompts user to Save or Save As when there are unsaved changes. Optional `saveAsSuffix`
  const confirmAndSave = useCallback(async (saveAsSuffix?: string) => {
    if (!targetTab) return null
    if (targetTab.dirty) {
      const choice = await select({
        title: 'Save changes',
        message: `Save changes to "${targetTab.fileName}"?`,
        options: [
          { label: 'Save', value: 'save' },
          { label: 'Save As', value: 'saveAs' },
        ],
      })
      if (!choice) return null
      if (choice === 'saveAs') {
        return save(true, saveAsSuffix)
      }
      // choice === 'save'
    }
    return save(false)
  }, [targetTab, save])

  return { canSave, saving, save, saveAs, confirmAndSave }
}

export default useSave

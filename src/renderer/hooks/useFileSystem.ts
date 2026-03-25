import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useDialog } from '../context/DialogContext'
import { useMupdf } from './useMupdf'
import { useRecentFiles } from './useRecentFiles'
import { createPageOrder } from '../utils/array'
import type { Tab } from '../types/app'

export function makeTab(overrides: Partial<Tab> & Pick<Tab, 'id' | 'fileName' | 'numPages'>): Tab {
  return {
    fileHandle: null,
    filePath: null,
    currentPage: 1,
    scale: 1.0,
    pageOrder: createPageOrder(overrides.numPages),
    rotations: {},
    annotations: {},
    redactions: {},
    editMode: false,
    activeTool: null,
    activeColor: '#f59e0b',
    isLoading: false,
    viewLayout: 'single',
    dirty: false,
    ...overrides,
  }
}

const api = (window as any).electronAPI

/** Shared helper: open a document buffer, dispatch tab updates */
async function loadDocument(
  mupdf: any,
  dispatch: React.Dispatch<any>,
  tabId: string,
  buffer: ArrayBuffer,
) {
  const { numPages } = await mupdf.openDocument(tabId, buffer)
  dispatch({
    type: 'UPDATE_TAB',
    payload: {
      tabId,
      numPages,
      pageOrder: createPageOrder(numPages),
      isLoading: false,
    },
  })
}

export function useFileSystem() {
  const { state, dispatch } = useApp()
  const { snackbar } = useDialog()
  const mupdf = useMupdf()
  const { addRecent } = useRecentFiles()

  /** Open a file by reading it via IPC (using its filesystem path) */
  const openFileByPath = useCallback(async (filePath: string, fileName: string) => {
    const existing = state.tabs.find(t => t.fileName === fileName)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
      return
    }

    const buffer: ArrayBuffer | null = await api.readFileBuffer(filePath)
    if (!buffer) {
      snackbar(`Could not locate file: ${fileName}`, 'error')
      return
    }

    const tabId = crypto.randomUUID()
    dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName, numPages: 1, fileHandle: null, filePath, isLoading: true }) })
    addRecent(fileName, null, filePath)

    try {
      await loadDocument(mupdf, dispatch, tabId, buffer)
    } catch (err) {
      console.error('Failed to open PDF', err)
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
    }
  }, [state.tabs, dispatch, mupdf, addRecent])

  const openFileFromHandle = useCallback(async (handle: FileSystemFileHandle, filePath?: string | null) => {
    const existing = state.tabs.find(t => t.fileName === handle.name)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
      return
    }

    let file: File | null = null
    try {
      const perm = await (handle as any).requestPermission({ mode: 'read' })
      if (perm === 'granted') file = await handle.getFile()
    } catch { /* permission failed */ }

    if (!file && filePath) {
      await openFileByPath(filePath, handle.name)
      return
    }
    if (!file) {
      await openFiles(false)
      return
    }

    const buffer = await file.arrayBuffer()
    const tabId = crypto.randomUUID()
    const path = (file as any).path ?? filePath ?? null

    dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName: file.name, numPages: 1, fileHandle: handle, filePath: path, isLoading: true }) })
    addRecent(file.name, handle, path)

    try {
      await loadDocument(mupdf, dispatch, tabId, buffer)
    } catch (err) {
      console.error('Failed to open PDF', err)
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
    }
  }, [state.tabs, dispatch, mupdf, addRecent, openFileByPath])

  const openFiles = useCallback(async (multiple = false, startIn?: string) => {
    let handles: FileSystemFileHandle[]
    try {
      const opts: any = {
        multiple,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      }
      if (startIn) opts.startIn = startIn
      handles = await (window as any).showOpenFilePicker(opts)
    } catch {
      return
    }

    for (const handle of handles) {
      const file = await handle.getFile()
      const buffer = await file.arrayBuffer()
      const tabId = crypto.randomUUID()
      const filePath = (file as any).path ?? null

      dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName: file.name, numPages: 1, fileHandle: handle, filePath, isLoading: true }) })
      addRecent(file.name, handle, filePath)

      try {
        await loadDocument(mupdf, dispatch, tabId, buffer)
      } catch (err) {
        console.error('Failed to open PDF', err)
        dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
      }
    }
  }, [dispatch, mupdf, addRecent])

  /** Save bytes — try FSA handle first, then IPC path, then Save As picker */
  const saveBytes = useCallback(async (
    bytes: Uint8Array,
    suggestedName: string,
    handle?: FileSystemFileHandle | null,
    filePath?: string | null,
  ): Promise<FileSystemFileHandle | null> => {
    // 1. Try File System Access handle
    if (handle) {
      try {
        const writable = await handle.createWritable()
        await writable.write(bytes)
        await writable.close()
        return handle
      } catch { /* fall through */ }
    }
    // 2. Try IPC path (save in place without dialog)
    if (filePath) {
      const ok = await api.writeFileBuffer(filePath, bytes.buffer)
      if (ok) return null  // saved successfully, no handle to return
    }
    // 3. Fallback: Save As picker
    try {
      const target = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      })
      const writable = await target.createWritable()
      await writable.write(bytes)
      await writable.close()
      return target
    } catch {
      return null
    }
  }, [])

  /** Open files directly for merge — loads into worker without creating tabs */
  const openFilesForMerge = useCallback(async () => {
    let handles: FileSystemFileHandle[]
    try {
      handles = await (window as any).showOpenFilePicker({
        multiple: true,
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
      })
    } catch { return }

    for (const handle of handles) {
      const file = await handle.getFile()
      const buffer = await file.arrayBuffer()
      const docId = crypto.randomUUID()

      try {
        const { numPages } = await mupdf.openDocument(docId, buffer)
        dispatch({
          type: 'ADD_MERGE_SOURCE',
          payload: { source: { tabId: docId, fileName: file.name, numPages, selectedPages: [] } },
        })
      } catch (err) {
        console.error('Failed to open PDF for merge', err)
      }
    }
  }, [dispatch, mupdf])

  return { openFiles, openFileFromHandle, openFileByPath, saveBytes, openFilesForMerge }
}

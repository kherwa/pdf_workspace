import { useState, useCallback, useEffect } from 'react'

const DB_NAME = 'pdf-recent'
const STORE_NAME = 'files'
const MAX_RECENT = 20

export interface RecentFile {
  name: string
  openedAt: number
  handle: FileSystemFileHandle | null
  path: string | null
}

/* ── IndexedDB helpers ──────────────────────────────────────────────── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadAll(): Promise<RecentFile[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => {
        const files = (req.result as RecentFile[]).sort((a, b) => b.openedAt - a.openedAt)
        resolve(files.slice(0, MAX_RECENT))
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function putFile(file: RecentFile): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(file)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearAll(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/* ── Hook ───────────────────────────────────────────────────────────── */

export function useRecentFiles() {
  const [files, setFiles] = useState<RecentFile[]>([])

  useEffect(() => {
    loadAll().then(setFiles)
  }, [])

  const addRecent = useCallback((name: string, handle: FileSystemFileHandle | null, path: string | null = null) => {
    const entry: RecentFile = { name, openedAt: Date.now(), handle, path }
    putFile(entry).then(() => loadAll().then(setFiles))
  }, [])

  const clearRecent = useCallback(() => {
    clearAll().then(() => setFiles([]))
  }, [])

  const refresh = useCallback(() => {
    loadAll().then(setFiles)
  }, [])

  return { files, addRecent, clearRecent, refresh }
}

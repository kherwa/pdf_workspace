import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useRecentFiles } from '../../hooks/useRecentFiles'
import { useFileSystem, makeTab } from '../../hooks/useFileSystem'
import { useMupdf } from '../../hooks/useMupdf'
import { createPageOrder } from '../../utils/array'
import { FileTextIcon, FolderOpenIcon, TrashIcon, ClockIcon } from '../shared/Icons'

const api = (window as any).electronAPI

export default function HomeView() {
  const { state } = useApp()
  const { homeSection } = state

  if (homeSection === 'computer') return <ComputerView />
  return <RecentFilesView />
}

function RecentFilesView() {
  const { files, clearRecent } = useRecentFiles()
  const { openFiles, openFileFromHandle, openFileByPath } = useFileSystem()

  function handleFileClick(file: { name: string; handle: FileSystemFileHandle | null; path: string | null }) {
    if (file.handle) {
      openFileFromHandle(file.handle, file.path)
    } else if (file.path) {
      openFileByPath(file.path, file.name)
    } else {
      openFiles(false)
    }
  }

  return (
    <div className="flex-1 h-full overflow-auto p-8 bg-surface-dim">
      <div className="constrain-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ClockIcon size={24} />
            <h2 className="text-title-medium text-on-surface">Recent Files</h2>
          </div>
          {files.length > 0 && (
            <button onClick={clearRecent} className="btn-text btn-text-sm">
              <TrashIcon size={16} />
              Clear
            </button>
          )}
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-on-surface-muted">
            <FileTextIcon size={48} />
            <p className="text-body-large">No recent files</p>
            <button onClick={() => openFiles(false)} className="btn-filled btn-open-file">
              <FolderOpenIcon size={18} />
              Open a File
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {files.map((file, i) => (
              <button
                key={`${file.name}-${i}`}
                onClick={() => handleFileClick(file)}
                className="flex items-center gap-4 rounded-lg transition-colors text-left menu-item h-14 px-4 text-on-surface"
              >
                <FileTextIcon size={20} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-body-medium truncate">{file.name}</span>
                  <span className="text-label-small text-on-surface-muted">
                    {new Date(file.openedAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FileEntry {
  name: string
  path: string
  size: number
  modified: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ComputerView() {
  const { state, dispatch } = useApp()
  const mupdf = useMupdf()
  const { addRecent } = useRecentFiles()
  const { computerFolder } = state

  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [folderPath, setFolderPath] = useState('')

  useEffect(() => {
    if (!computerFolder) return
    setLoading(true)
    api.getQuickPaths().then((paths: Record<string, string>) => {
      const dir = paths[computerFolder]
      if (!dir) return
      setFolderPath(dir)
      api.listPDFs(dir).then((result: FileEntry[]) => {
        setFiles(result)
        setLoading(false)
      })
    })
  }, [computerFolder])

  async function openFileByPath(entry: FileEntry) {
    // Check if already open
    const existing = state.tabs.find(t => t.fileName === entry.name)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
      return
    }

    const buffer: ArrayBuffer | null = await api.readFileBuffer(entry.path)
    if (!buffer) return

    const tabId = crypto.randomUUID()
    dispatch({
      type: 'OPEN_TAB',
      payload: makeTab({ id: tabId, fileName: entry.name, filePath: entry.path, numPages: 1, isLoading: true }),
    })
    addRecent(entry.name, null, entry.path)

    try {
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
    } catch (err) {
      console.error('Failed to open PDF', err)
      dispatch({ type: 'CLOSE_TAB', payload: { tabId } })
    }
  }

  const folderLabel = computerFolder
    ? computerFolder.charAt(0).toUpperCase() + computerFolder.slice(1)
    : 'Select a folder'

  return (
    <div className="flex-1 h-full overflow-auto p-8 bg-surface-dim">
      <div className="constrain-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FolderOpenIcon size={24} />
            <h2 className="text-title-medium text-on-surface">{folderLabel}</h2>
          </div>
          {folderPath && <span className="text-label-small text-on-surface-muted">{folderPath}</span>}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-on-surface-muted">
            <span className="text-body-medium">Loading...</span>
          </div>
        ) : !computerFolder ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-on-surface-muted">
            <FolderOpenIcon size={48} />
            <p className="text-body-large">Select a folder from the sidebar</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-on-surface-muted">
            <FileTextIcon size={48} />
            <p className="text-body-large">No PDF files in this folder</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {files.map(file => (
              <button
                key={file.path}
                onClick={() => openFileByPath(file)}
                className="flex items-center gap-4 rounded-lg transition-colors text-left menu-item h-14 px-4 text-on-surface"
              >
                <FileTextIcon size={20} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-body-medium truncate">{file.name}</span>
                  <span className="text-label-small text-on-surface-muted">
                    {formatSize(file.size)} · {new Date(file.modified).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { FileTextIcon, FolderOpenIcon } from './Icons'

const api = (window as any).electronAPI

export default function DropZone() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <FileTextIcon size={64} className="text-on-surface-muted" />
      <div className="text-center">
        <h2 className="text-headline-small" style={{ color: 'var(--md-on-surface)' }}>
          Open a PDF to get started
        </h2>
        <p className="text-body-large mt-2" style={{ color: 'var(--md-on-surface-muted)' }}>
          Drag and drop a file here, or use the button below
        </p>
      </div>
      <button onClick={() => api.triggerMenuOpen()} className="btn-filled">
        <FolderOpenIcon size={20} />
        Open File
      </button>
      <span className="text-label-small" style={{ color: 'var(--md-on-surface-muted)' }}>
        Ctrl+O
      </span>
    </div>
  )
}

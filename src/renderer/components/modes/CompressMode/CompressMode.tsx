import { useApp } from '../../../context/AppContext'
import { useDialog } from '../../../context/DialogContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { useFileSystem } from '../../../hooks/useFileSystem'
import { useState } from 'react'
import { CompressIcon } from '../../shared/Icons'
import { appendSuffixToFileName } from '../../../utils/file'

export default function CompressMode() {
  const { state, activeTab } = useApp()
  const { snackbar } = useDialog()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()
  const { compression } = state
  const [compressing, setCompressing] = useState(false)
  const [done, setDone] = useState(false)

  async function handleCompress() {
    if (!activeTab) return
    setCompressing(true)
    setDone(false)
    try {
      const bytes = await mupdf.compressDocument(activeTab.id, compression)
      // Force Save As for compression outputs
      const suggested = appendSuffixToFileName(activeTab.fileName, '_compressed')
      const saved = await saveBytes(bytes, suggested, null, null)
      if (saved) setDone(true)
    } catch (e) {
      snackbar(`Compression failed: ${e}`, 'error')
    } finally {
      setCompressing(false)
    }
  }

  if (!activeTab) return (
    <div className="flex items-center justify-center h-full text-body-large text-on-surface-muted">
      Open a PDF to compress
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 bg-surface-dim">
      <CompressIcon size={64} className="text-on-surface-muted" />
      <h2 className="text-headline-small text-on-surface">Compress PDF</h2>
      <p className="text-body-large text-center max-w-sm text-on-surface-muted">
        Reduces file size by recompressing images, subsetting fonts, and removing unused data.
        Use the toolbar above to configure options.
      </p>
      <div className="w-full max-w-sm p-5 panel-card">
        <div className="space-y-2 text-body-small">
          <div className="flex justify-between">
            <span className="text-on-surface-muted">File</span>
            <span className="text-on-surface">{activeTab.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-muted">Pages</span>
            <span className="text-on-surface">{activeTab.numPages}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-muted">Mode</span>
            <span className="capitalize text-on-surface">{compression.mode}</span>
          </div>
          {compression.mode === 'advanced' && (
            <>
              <div className="flex justify-between">
                <span className="text-on-surface-muted">Image quality</span>
                <span className="text-on-surface">{compression.imageQuality}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-muted">Max DPI</span>
                <span className="text-on-surface">{compression.imageDPI}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <button
        onClick={handleCompress}
        disabled={compressing}
        className="btn-save btn-success"
      >
        {compressing ? 'Compressing...' : 'Compress'}
      </button>
      {done && <p className="text-body-medium text-tertiary">Saved successfully</p>}
    </div>
  )
}

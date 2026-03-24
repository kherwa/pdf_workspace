import { useApp } from '../../../context/AppContext'
import { useDialog } from '../../../context/DialogContext'
import { useMupdf } from '../../../hooks/useMupdf'
import { useFileSystem } from '../../../hooks/useFileSystem'
import { useState } from 'react'
import { CompressIcon } from '../../shared/Icons'

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
      const saved = await saveBytes(bytes, `compressed_${activeTab.fileName}`)
      if (saved) setDone(true)
    } catch (e) {
      snackbar(`Compression failed: ${e}`, 'error')
    } finally {
      setCompressing(false)
    }
  }

  if (!activeTab) return (
    <div className="flex items-center justify-center h-full text-body-large" style={{ color: 'var(--md-on-surface-muted)' }}>
      Open a PDF to compress
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8" style={{ backgroundColor: 'var(--md-surface-dim)' }}>
      <CompressIcon size={64} className="text-on-surface-muted" />
      <h2 className="text-headline-small" style={{ color: 'var(--md-on-surface)' }}>Compress PDF</h2>
      <p className="text-body-large text-center max-w-sm" style={{ color: 'var(--md-on-surface-muted)' }}>
        Reduces file size by recompressing images, subsetting fonts, and removing unused data.
        Use the toolbar above to configure options.
      </p>
      <div
        className="w-full max-w-sm p-5"
        style={{
          backgroundColor: 'var(--md-surface-container)',
          borderRadius: 'var(--md-radius-md)',
          boxShadow: 'var(--md-elevation-1)',
        }}
      >
        <div className="space-y-2 text-body-small">
          <div className="flex justify-between">
            <span style={{ color: 'var(--md-on-surface-muted)' }}>File</span>
            <span style={{ color: 'var(--md-on-surface)' }}>{activeTab.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--md-on-surface-muted)' }}>Pages</span>
            <span style={{ color: 'var(--md-on-surface)' }}>{activeTab.numPages}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--md-on-surface-muted)' }}>Mode</span>
            <span className="capitalize" style={{ color: 'var(--md-on-surface)' }}>{compression.mode}</span>
          </div>
          {compression.mode === 'advanced' && (
            <>
              <div className="flex justify-between">
                <span style={{ color: 'var(--md-on-surface-muted)' }}>Image quality</span>
                <span style={{ color: 'var(--md-on-surface)' }}>{compression.imageQuality}%</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--md-on-surface-muted)' }}>Max DPI</span>
                <span style={{ color: 'var(--md-on-surface)' }}>{compression.imageDPI}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <button
        onClick={handleCompress}
        disabled={compressing}
        className="btn-success"
      >
        {compressing ? 'Compressing...' : 'Compress & Save'}
      </button>
      {done && <p className="text-body-medium" style={{ color: 'var(--md-tertiary-40)' }}>Saved successfully</p>}
    </div>
  )
}

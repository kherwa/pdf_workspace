import { useApp } from '../../context/AppContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useFileSystem } from '../../hooks/useFileSystem'
import { appendSuffixToFileName } from '../../utils/file'

export default function CompressToolbar() {
  const { state, activeTab, dispatch } = useApp()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()
  const { compression } = state

  async function handleCompress() {
    if (!activeTab) return
    const bytes = await mupdf.compressDocument(activeTab.id, compression)
    // Force Save As for compression outputs
    const suggested = appendSuffixToFileName(activeTab.fileName, '_compressed')
    await saveBytes(bytes, suggested, null, null)
  }

  return (
    <div className="toolbar flex-wrap">
      {/* Simple / Advanced toggle */}
      <div className="segmented-group">
        {(['simple', 'advanced'] as const).map(m => (
          <button
            key={m}
            onClick={() => dispatch({ type: 'SET_COMPRESSION', payload: { mode: m } })}
            className={`segmented-btn ${compression.mode === m ? 'active' : ''}`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {compression.mode === 'advanced' && (
        <>
          <label className="flex items-center gap-2 text-label-medium text-on-surface-variant">
            Quality
            <input type="range" min={10} max={100} value={compression.imageQuality}
              onChange={e => dispatch({ type: 'SET_COMPRESSION', payload: { imageQuality: +e.target.value } })}
              className="w-24 accent-primary"
            />
            <span className="w-8 text-on-surface">{compression.imageQuality}%</span>
          </label>
          <label className="flex items-center gap-2 text-label-medium text-on-surface-variant">
            Max DPI
            <input type="number" min={72} max={600} value={compression.imageDPI}
              onChange={e => dispatch({ type: 'SET_COMPRESSION', payload: { imageDPI: +e.target.value } })}
              className="input-sm w-20"
            />
          </label>
          <label className="flex items-center gap-2 text-label-medium text-on-surface-variant">
            <input type="checkbox" checked={compression.subsetFonts}
              onChange={e => dispatch({ type: 'SET_COMPRESSION', payload: { subsetFonts: e.target.checked } })}
              className="accent-primary"
            />
            Subset fonts
          </label>
          <label className="flex items-center gap-2 text-label-medium text-on-surface-variant">
            <input type="checkbox" checked={compression.compressStreams}
              onChange={e => dispatch({ type: 'SET_COMPRESSION', payload: { compressStreams: e.target.checked } })}
              className="accent-primary"
            />
            Compress streams
          </label>
        </>
      )}

      <button onClick={handleCompress} disabled={!activeTab} className="btn-save btn-compact ml-auto">
        Compress
      </button>
    </div>
  )
}

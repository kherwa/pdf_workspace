import { useApp } from '../../context/AppContext'
import { useDialog } from '../../context/DialogContext'
import { useMupdf } from '../../hooks/useMupdf'
import { useFileSystem } from '../../hooks/useFileSystem'
import { UndoIcon, ShieldIcon } from '../shared/Icons'

export default function RedactToolbar() {
  const { activeTab, dispatch } = useApp()
  const { snackbar, confirm } = useDialog()
  const mupdf = useMupdf()
  const { saveBytes } = useFileSystem()

  const totalRedactions = activeTab
    ? Object.values(activeTab.redactions).reduce((n, arr) => n + arr.length, 0)
    : 0

  async function applyRedactions() {
    if (!activeTab) return
    if (!totalRedactions) { snackbar('No redactions marked.', 'error'); return }
    const ok = await confirm({
      title: 'Apply redactions?',
      message: `Apply ${totalRedactions} redaction(s)? This permanently removes content and cannot be undone.`,
      confirmLabel: 'Apply',
      danger: true,
    })
    if (!ok) return
    try {
      // Apply redactions in the worker (modifies the in-memory document). Do NOT auto-save to disk.
      await mupdf.applyRedactions(activeTab.id, activeTab.redactions, activeTab.scale)
      // Mark document dirty and clear staged redactions; user saves via File → Save / Save As
      dispatch({ type: 'CLEAR_REDACTIONS', payload: { tabId: activeTab.id } })
      dispatch({ type: 'MARK_DIRTY', payload: { tabId: activeTab.id } })
      snackbar('Redactions applied (unsaved). Use File → Save to save changes.', 'success')
    } catch (err) {
      console.error('Apply redactions failed:', err)
      snackbar(`Redaction failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  return (
    <div className="toolbar">
      <span className="text-body-small text-on-surface-muted mr-2">
        Draw rectangles over content to redact
      </span>

      <div className="toolbar-sep" />

      <span className="text-label-medium text-on-surface-muted">
        {totalRedactions} marked
      </span>

      {activeTab && totalRedactions > 0 && (
        <button
          onClick={() => dispatch({ type: 'UNDO_REDACTION', payload: { tabId: activeTab.id, page: activeTab.currentPage } })}
          className="btn-icon-xs"
          title="Undo last redaction"
          aria-label="Undo last redaction"
        >
          <UndoIcon size={20} />
        </button>
      )}

      <button
        onClick={applyRedactions}
        disabled={!totalRedactions}
        className={`btn-compact ml-auto ${totalRedactions ? 'text-error border-error' : ''}`}
      >
        <ShieldIcon size={18} />
        Apply Redactions
      </button>
    </div>
  )
}

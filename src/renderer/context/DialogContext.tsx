import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

/* ── Snackbar (replaces alert) ───────────────────────────────────────── */
interface SnackbarState {
  message: string
  severity: 'info' | 'error'
  key: number
}

/* ── Confirm dialog (replaces window.confirm) ────────────────────────── */
interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (value: boolean) => void
}

interface DialogAPI {
  snackbar: (message: string, severity?: 'info' | 'error') => void
  confirm: (opts: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}

const DialogContext = createContext<DialogAPI | null>(null)

export function useDialog(): DialogAPI {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be inside DialogProvider')
  return ctx
}

export function DialogProvider({ children }: { children: ReactNode }) {
  /* ── Snackbar state ──────────────────────────────────────────────── */
  const [snack, setSnack] = useState<SnackbarState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const showSnackbar = useCallback((message: string, severity: 'info' | 'error' = 'info') => {
    clearTimeout(timerRef.current)
    setSnack({ message, severity, key: Date.now() })
  }, [])

  useEffect(() => {
    if (!snack) return
    timerRef.current = setTimeout(() => setSnack(null), snack.severity === 'error' ? 6000 : 4000)
    return () => clearTimeout(timerRef.current)
  }, [snack])

  /* ── Confirm state ───────────────────────────────────────────────── */
  const [dialog, setDialog] = useState<ConfirmState | null>(null)

  const showConfirm = useCallback((opts: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      })
    })
  }, [])

  function handleConfirmClose(accepted: boolean) {
    dialog?.resolve(accepted)
    setDialog(null)
  }

  // Close dialog on Escape key
  useEffect(() => {
    if (!dialog) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleConfirmClose(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialog])

  const api: DialogAPI = { snackbar: showSnackbar, confirm: showConfirm }

  return (
    <DialogContext.Provider value={api}>
      {children}

      {/* ── MD3 Snackbar ────────────────────────────────────────────── */}
      {snack && (
        <div key={snack.key} className={`snackbar ${snack.severity === 'error' ? 'snackbar-error' : ''}`}>
          <span className="snackbar-text">{snack.message}</span>
          <button
            onClick={() => { clearTimeout(timerRef.current); setSnack(null) }}
            className="snackbar-action"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── MD3 Confirm Dialog ──────────────────────────────────────── */}
      {dialog && (
        <div className="dialog-scrim" onClick={() => handleConfirmClose(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <h2 className="dialog-title">{dialog.title}</h2>
            <p className="dialog-body">{dialog.message}</p>
            <div className="dialog-actions">
              <button className="btn-text" onClick={() => handleConfirmClose(false)}>
                Cancel
              </button>
              <button
                className={dialog.danger ? 'btn-danger' : 'btn-filled'}
                onClick={() => handleConfirmClose(true)}
                autoFocus
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

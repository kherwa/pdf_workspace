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

/* ── Prompt dialog (text input) ──────────────────────────────────────── */
interface PromptState {
  title: string
  message: string
  defaultValue: string
  confirmLabel: string
  resolve: (value: string | null) => void
}

/* ── Select dialog (choose from options) ─────────────────────────────── */
interface SelectState {
  title: string
  message: string
  options: { label: string; value: string }[]
  resolve: (value: string | null) => void
}

interface DialogAPI {
  snackbar: (message: string, severity?: 'info' | 'error') => void
  confirm: (opts: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
  prompt: (opts: {
    title: string
    message?: string
    defaultValue?: string
    confirmLabel?: string
  }) => Promise<string | null>
  select: (opts: {
    title: string
    message?: string
    options: { label: string; value: string }[]
  }) => Promise<string | null>
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

  /* ── Prompt state ────────────────────────────────────────────────── */
  const [promptDlg, setPromptDlg] = useState<PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const showPrompt = useCallback((opts: {
    title: string
    message?: string
    defaultValue?: string
    confirmLabel?: string
  }): Promise<string | null> => {
    return new Promise(resolve => {
      setPromptValue(opts.defaultValue ?? '')
      setPromptDlg({
        title: opts.title,
        message: opts.message ?? '',
        defaultValue: opts.defaultValue ?? '',
        confirmLabel: opts.confirmLabel ?? 'OK',
        resolve,
      })
    })
  }, [])

  function handlePromptClose(accepted: boolean) {
    promptDlg?.resolve(accepted ? promptValue : null)
    setPromptDlg(null)
    setPromptValue('')
  }

  /* ── Select state ────────────────────────────────────────────────── */
  const [selectDlg, setSelectDlg] = useState<SelectState | null>(null)

  const showSelect = useCallback((opts: {
    title: string
    message?: string
    options: { label: string; value: string }[]
  }): Promise<string | null> => {
    return new Promise(resolve => {
      setSelectDlg({
        title: opts.title,
        message: opts.message ?? '',
        options: opts.options,
        resolve,
      })
    })
  }, [])

  function handleSelectClose(value: string | null) {
    selectDlg?.resolve(value)
    setSelectDlg(null)
  }

  // Close dialogs on Escape key
  useEffect(() => {
    if (!dialog && !promptDlg && !selectDlg) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (dialog) handleConfirmClose(false)
        if (promptDlg) handlePromptClose(false)
        if (selectDlg) handleSelectClose(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialog, promptDlg, selectDlg])

  const api: DialogAPI = { snackbar: showSnackbar, confirm: showConfirm, prompt: showPrompt, select: showSelect }

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

      {/* ── MD3 Prompt Dialog ───────────────────────────────────────── */}
      {promptDlg && (
        <div className="dialog-scrim" onClick={() => handlePromptClose(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="dialog-title">{promptDlg.title}</h2>
            {promptDlg.message && <p className="dialog-body">{promptDlg.message}</p>}
            <div style={{ padding: '0 24px 16px' }}>
              <input
                type="text"
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePromptClose(true) }}
                autoFocus
                className="w-full rounded-md focus:outline-none"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--md-surface-container)',
                  border: '1px solid var(--md-outline-30)',
                  color: 'var(--md-on-surface)',
                  fontSize: 14,
                }}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn-text" onClick={() => handlePromptClose(false)}>
                Cancel
              </button>
              <button className="btn-filled" onClick={() => handlePromptClose(true)}>
                {promptDlg.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MD3 Select Dialog ───────────────────────────────────────── */}
      {selectDlg && (
        <div className="dialog-scrim" onClick={() => handleSelectClose(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="dialog-title">{selectDlg.title}</h2>
            {selectDlg.message && <p className="dialog-body">{selectDlg.message}</p>}
            <div className="flex flex-col gap-1" style={{ padding: '0 24px 16px' }}>
              {selectDlg.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectClose(opt.value)}
                  className="dropdown-item"
                  style={{ borderRadius: 8 }}
                >
                  <span className="text-label-large">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn-text" onClick={() => handleSelectClose(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

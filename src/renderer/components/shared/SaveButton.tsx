import React from 'react'
import useSave from '../../hooks/useSave'
import { useApp } from '../../context/AppContext'

type Variant = 'primary' | 'compact' | 'icon'

interface Props {
  variant?: Variant
  forceSaveAs?: boolean
  confirm?: boolean
  saveSuffix?: string
  tabId?: string
  disabled?: boolean
  children?: React.ReactNode
  onSaved?: (handle: FileSystemFileHandle | null) => void
}

export default function SaveButton({ variant = 'primary', forceSaveAs = false, confirm = false, saveSuffix, tabId, disabled, children, onSaved }: Props) {
  const { canSave, saving, save, saveAs, confirmAndSave } = useSave(tabId)
  const { activeTab } = useApp()

  const isDisabled = disabled || !canSave || saving

  async function handleClick() {
    if (!canSave) return
    let handle = null
    if (confirm) {
      handle = await confirmAndSave(saveSuffix)
    } else if (forceSaveAs) {
      handle = await saveAs(saveSuffix)
    } else {
      handle = await save(false)
    }
    if (onSaved) onSaved(handle)
  }

  const base = variant === 'compact' ? 'btn-compact' : variant === 'icon' ? 'btn-icon-xs' : 'btn-filled'
  const className = `btn-save ${base}`

  return (
    <button onClick={handleClick} disabled={isDisabled} className={className}>
      {saving ? 'Saving...' : (children ?? (forceSaveAs ? 'Save As' : 'Save'))}
    </button>
  )
}

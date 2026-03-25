import { useApp } from '../../context/AppContext'
import { SaveIcon } from '../shared/Icons'

const api = (window as any).electronAPI
const isMac = api?.platform === 'darwin'

export default function TopBar() {
  const { state, activeTab, dispatch } = useApp()
  const { mode, drawerView } = state

  const isEditActive = ['organise', 'redact'].includes(mode) || (mode === 'view' && !!activeTab?.editMode)
  const isConvertActive = ['merge', 'compress'].includes(mode)

  function handleAllToolsClick() {
    if (activeTab?.editMode) {
      dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
    }
    if (mode !== 'view') {
      dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
    }
    dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
    if (state.drawerCollapsed) dispatch({ type: 'TOGGLE_DRAWER' })
  }

  function handleEditClick() {
    if (!activeTab) return
    if (isEditActive) {
      if (activeTab.editMode) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
      }
      dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
      dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
    } else {
      dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'edit' } })
      if (activeTab.editMode) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
      }
      if (mode !== 'view') dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
      if (state.drawerCollapsed) dispatch({ type: 'TOGGLE_DRAWER' })
    }
  }

  function handleConvertClick() {
    if (isConvertActive) {
      dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
      dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
    } else {
      dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'convert' } })
      if (activeTab?.editMode) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
      }
      if (mode !== 'view') dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
      if (state.drawerCollapsed) dispatch({ type: 'TOGGLE_DRAWER' })
    }
  }

  return (
    <div className="toolbar justify-between border-top-outline">
      {/* Left: action buttons */}
      <div className="flex items-center gap-1">
        {([
          { label: 'All Tools', active: false, onClick: handleAllToolsClick, disabled: false },
          { label: 'Edit', active: !state.drawerCollapsed && isEditActive, onClick: handleEditClick, disabled: !activeTab },
          { label: 'Convert', active: !state.drawerCollapsed && isConvertActive, onClick: handleConvertClick, disabled: !activeTab },
        ] as const).map(({ label, active, onClick, disabled }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className={`btn-toggle ${active ? 'active' : ''}`}
            aria-label={label}
            title={label}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right side reserved for future controls (Save is in the menu) */}
      <div className="flex items-center">
        {/* Save is available from the Menu (File → Save / Save As). */}
      </div>
    </div>
  )
}

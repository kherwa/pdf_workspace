import { useApp } from '../../context/AppContext'

export default function TopBar() {
  const { state, activeTab, dispatch } = useApp()
  const { mode } = state

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

  const isMerge = mode === 'merge'

  return (
    <div className="toolbar justify-between border-top-outline">
      {/* Left: action buttons */}
      <div className="flex items-center gap-1">
        {([
          { label: 'All Tools', active: false, onClick: handleAllToolsClick, disabled: isMerge },
          { label: 'Edit', active: !state.drawerCollapsed && isEditActive, onClick: handleEditClick, disabled: !activeTab || isMerge },
          { label: 'Convert', active: !state.drawerCollapsed && isConvertActive, onClick: handleConvertClick, disabled: !activeTab || isMerge },
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

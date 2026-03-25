import { useApp } from '../../context/AppContext'
import { useTheme } from '../../hooks/useTheme'
import { makeTab } from '../../hooks/useFileSystem'
import type { AppMode, ComputerFolder } from '../../types/app'
import {
  PenIcon, GridIcon, ShieldIcon,
  MergeIcon, CompressIcon,
  ClockIcon, MonitorIcon, FolderIcon, DownloadIcon,
  SunIcon, MoonIcon, XIcon,
} from '../shared/Icons'

type ActionItem = { id: string; label: string; Icon: React.FC<{ size?: number; className?: string }> }

const EDIT_ACTIONS: ActionItem[] = [
  { id: 'annotate', label: 'Annotate', Icon: PenIcon },
  { id: 'organise', label: 'Organise', Icon: GridIcon },
  { id: 'redact', label: 'Redact', Icon: ShieldIcon },
]

const CONVERT_ACTIONS: ActionItem[] = [
  { id: 'merge', label: 'Merge', Icon: MergeIcon },
  { id: 'compress', label: 'Compress', Icon: CompressIcon },
]

const ALL_ACTIONS: ActionItem[] = [...EDIT_ACTIONS, ...CONVERT_ACTIONS]

const HOME_ACTIONS: ActionItem[] = [
  { id: 'recent', label: 'Recent Files', Icon: ClockIcon },
  { id: 'computer', label: 'Your Computer', Icon: MonitorIcon },
]

const FOLDER_ACTIONS: ActionItem[] = [
  { id: 'desktop', label: 'Desktop', Icon: MonitorIcon },
  { id: 'downloads', label: 'Downloads', Icon: DownloadIcon },
  { id: 'documents', label: 'Documents', Icon: FolderIcon },
]

export default function ModeBar() {
  const { state, activeTab, dispatch } = useApp()
  const { theme, toggle } = useTheme()
  const collapsed = state.drawerCollapsed
  const { mode, drawerView, homeSection, computerFolder } = state

  const isHome = drawerView === 'home'
  const actions = isHome ? HOME_ACTIONS : drawerView === 'edit' ? EDIT_ACTIONS : drawerView === 'convert' ? CONVERT_ACTIONS : ALL_ACTIONS
  const EDIT_IDS = ['annotate', 'organise', 'redact']
  const CONVERT_IDS = ['merge', 'compress']

  function isItemActive(id: string): boolean {
    if (isHome) return homeSection === id
    if (id === 'annotate') return mode === 'view' && !!activeTab?.editMode
    return mode === id
  }

  function handleActionClick(id: string) {
    if (isHome) {
      dispatch({ type: 'SET_HOME_SECTION', payload: { section: id as 'recent' | 'computer' } })
      if (id === 'computer' && !computerFolder) {
        dispatch({ type: 'SET_COMPUTER_FOLDER', payload: { folder: 'desktop' } })
      }
      return
    }

    const view = EDIT_IDS.includes(id) ? 'edit' : CONVERT_IDS.includes(id) ? 'convert' : drawerView
    dispatch({ type: 'SET_DRAWER_VIEW', payload: { view } })

    if (id === 'annotate') {
      if (!activeTab) return
      if (isItemActive('annotate')) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
        dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
      } else {
        if (mode !== 'view') dispatch({ type: 'SET_MODE', payload: { mode: 'view' } })
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: true } })
      }
    } else {
      const isDeactivating = mode === id
      const newMode = (isDeactivating ? 'view' : id) as AppMode
      dispatch({ type: 'SET_MODE', payload: { mode: newMode } })

      // Create "New Document" tab when entering merge mode
      if (id === 'merge' && !isDeactivating) {
        const existing = state.tabs.find(t => t.fileName === 'New Document')
        if (!existing) {
          const tabId = crypto.randomUUID()
          dispatch({ type: 'OPEN_TAB', payload: makeTab({ id: tabId, fileName: 'New Document', numPages: 0 }) })
        } else {
          dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: existing.id } })
        }
      }

      if (activeTab?.editMode) {
        dispatch({ type: 'SET_EDIT_MODE', payload: { tabId: activeTab.id, editMode: false } })
      }
      if (isDeactivating) {
        dispatch({ type: 'SET_DRAWER_VIEW', payload: { view: 'all' } })
      }
    }
  }

  function handleFolderClick(folder: ComputerFolder) {
    dispatch({ type: 'SET_COMPUTER_FOLDER', payload: { folder } })
  }

  /* ── Shared action item renderer ──────────────────────────────────── */
  function renderExpandedItem(item: ActionItem, active: boolean, onClick: () => void, indent = false) {
    return (
      <button
        key={item.id}
        onClick={onClick}
        className={`nav-item ${active ? 'active' : ''} ${indent ? 'indent' : ''}`}
        aria-label={item.label}
      >
        <item.Icon size={24} />
        <span className="text-label-large">{item.label}</span>
      </button>
    )
  }

  /* ── Collapsed: hide drawer entirely ─────────────────────────────────── */
  if (collapsed) return null

  const title = isHome ? 'Home' : drawerView === 'edit' ? 'Edit Tools' : drawerView === 'convert' ? 'Convert Tools' : 'All Tools'

  /* ── Expanded: MD3 Navigation Drawer ─────────────────────────────────── */
  return (
    <nav className="nav-drawer" aria-label="Navigation drawer">
      {/* Header with title and close button */}
      <div className="nav-drawer-header">
        <span className="text-title-small">{title}</span>
        {!isHome && (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DRAWER' })}
            className="btn-icon-xs"
            aria-label="Close drawer"
            title="Close"
          >
            <XIcon size={20} />
          </button>
        )}
      </div>

      {/* Action items */}
      <div className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        {actions.map(item => {
          const active = isItemActive(item.id)
          return renderExpandedItem(item, active, () => handleActionClick(item.id))
        })}

        {isHome && homeSection === 'computer' && (
          <>
            <div className="divider-h-inset" />
            {FOLDER_ACTIONS.map(item => {
              const active = computerFolder === item.id
              return renderExpandedItem(item, active, () => handleFolderClick(item.id as ComputerFolder), true)
            })}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="divider-h-inset" />

      {/* Bottom section */}
      <div className="flex flex-col gap-1 p-2">
        <button
          onClick={toggle}
          className="nav-item"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <MoonIcon size={24} /> : <SunIcon size={24} />}
          <span className="text-label-large">
            {theme === 'dark' ? 'Dark theme' : 'Light theme'}
          </span>
        </button>
      </div>
    </nav>
  )
}

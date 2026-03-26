import { useApp } from './context/AppContext'
import { useMenuEvents } from './hooks/useMenuEvents'
import MenuBar from './components/MenuBar/MenuBar'
import ModeBar from './components/Toolbar/ModeBar'
import TopBar from './components/Toolbar/TopBar'
import StatusBar from './components/StatusBar/StatusBar'
import EditBar from './components/Toolbar/EditBar'
import OrganiseToolbar from './components/Toolbar/OrganiseToolbar'
import MergeToolbar from './components/Toolbar/MergeToolbar'
import CompressToolbar from './components/Toolbar/CompressToolbar'
import RedactToolbar from './components/Toolbar/RedactToolbar'
import ViewMode from './components/modes/ViewMode/ViewMode'
import OrganiseMode from './components/modes/OrganiseMode/OrganiseMode'
import MergeMode from './components/modes/MergeMode/MergeMode'
import CompressMode from './components/modes/CompressMode/CompressMode'
import RedactMode from './components/modes/RedactMode/RedactMode'
import HomeView from './components/modes/HomeView'
import DropZone from './components/shared/DropZone'

export default function App() {
  useMenuEvents()
  const { state, activeTab } = useApp()
  const { mode, drawerView } = state
  const isHome = drawerView === 'home'

  return (
    <div className="flex flex-col h-full select-none bg-surface">
      {/* Menu bar + drag region */}
      <MenuBar />

      {/* Top action bar — only when a file is open */}
      {activeTab && mode !== 'merge' && <TopBar />}

      {/* Body: navigation drawer + content */}
      <div className={`flex flex-1 overflow-hidden ${!activeTab ? 'border-top-outline' : ''}`}>
        {/* Navigation drawer */}
        <ModeBar />

        {/* Content column: context toolbar + main area + status bar */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Context toolbar — changes per mode (only when file open) */}
          {activeTab && (
            <>
              {(mode === 'view' && activeTab.editMode) && <EditBar />}
              {mode === 'organise'  && <OrganiseToolbar />}
              {mode === 'merge'     && <MergeToolbar />}
              {mode === 'compress'  && <CompressToolbar />}
              {mode === 'redact'    && <RedactToolbar />}
            </>
          )}

          {/* Main content area + right status bar */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-hidden relative">
              {isHome && !activeTab ? (
                <HomeView />
              ) : !activeTab ? (
                <DropZone />
              ) : (
                <>
                  {mode === 'view'     && <ViewMode />}
                  {mode === 'organise' && <OrganiseMode />}
                  {mode === 'merge'    && <MergeMode />}
                  {mode === 'compress' && <CompressMode />}
                  {mode === 'redact'   && <RedactMode />}
                </>
              )}
            </main>
            {activeTab && mode !== 'merge' && <StatusBar />}
          </div>
        </div>
      </div>
    </div>
  )
}

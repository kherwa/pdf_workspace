import { useApp } from '../../../context/AppContext'
import PdfViewer from '../ViewMode/PdfViewer'
import RedactLayer from './RedactLayer'
import Loading from '../../shared/Loading'

export default function RedactMode() {
  const { activeTab } = useApp()
  if (!activeTab) return null
  if (activeTab.isLoading) return <Loading message="Loading PDF..." />

  return (
    <div className="flex h-full overflow-hidden">
      <div
        className="flex-1 overflow-auto flex justify-center items-start p-6"
        style={{ backgroundColor: 'var(--md-surface-dim)' }}
      >
        <div
          className="relative inline-block"
          style={{
            borderRadius: 'var(--md-radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--md-elevation-2)',
          }}
        >
          <PdfViewer />
          <RedactLayer />
        </div>
      </div>
    </div>
  )
}

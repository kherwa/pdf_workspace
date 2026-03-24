import { useApp } from '../../../context/AppContext'
import PdfViewer from './PdfViewer'
import AnnotationLayer from './AnnotationLayer'
import Loading from '../../shared/Loading'

export default function ViewMode() {
  const { activeTab } = useApp()
  if (!activeTab) return null
  if (activeTab.isLoading) return <Loading message="Loading PDF..." />

  return (
    <div
      className="relative flex-1 h-full overflow-auto flex justify-center items-start p-6"
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
        {activeTab.editMode && <AnnotationLayer />}
      </div>
    </div>
  )
}

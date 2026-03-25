import { useApp } from '../../../context/AppContext'
import PdfViewer from './PdfViewer'
import AnnotationLayer from './AnnotationLayer'
import Loading from '../../shared/Loading'

export default function ViewMode() {
  const { activeTab } = useApp()
  if (!activeTab) return null
  if (activeTab.isLoading) return <Loading message="Loading PDF..." />

  const isTwoPage = activeTab.viewLayout === 'two-page'

  return (
    <div className="relative flex-1 h-full overflow-auto flex justify-center items-start p-6 bg-surface-dim">
      {isTwoPage ? (
        <>
          <PdfViewer />
          {activeTab.editMode && <AnnotationLayer />}
        </>
      ) : (
        <div className="relative inline-block redact-frame">
          <PdfViewer />
          {activeTab.editMode && <AnnotationLayer />}
        </div>
      )}
    </div>
  )
}

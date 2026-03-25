import { useApp } from '../../context/AppContext'
import type { ToolName } from '../../types/annotations'
import { HighlightIcon, TypeIcon, PenIcon, SquareIcon, CircleIcon, PaletteIcon, UndoIcon } from '../shared/Icons'

const TOOLS: { id: ToolName; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'highlight', label: 'Highlight', Icon: HighlightIcon },
  { id: 'text',      label: 'Text',      Icon: TypeIcon },
  { id: 'freehand',  label: 'Draw',      Icon: PenIcon },
  { id: 'rect',      label: 'Rectangle', Icon: SquareIcon },
  { id: 'ellipse',   label: 'Ellipse',   Icon: CircleIcon },
]

export default function EditBar() {
  const { activeTab, dispatch } = useApp()
  if (!activeTab) return null
  const { id: tabId, activeTool, activeColor } = activeTab

  function setTool(tool: ToolName) {
    dispatch({ type: 'SET_ACTIVE_TOOL', payload: { tabId, tool: activeTool === tool ? null : tool } })
  }

  return (
    <div className="toolbar">
      <span className="text-body-small text-on-surface-muted mr-2">
        Select a tool to annotate
      </span>

      <div className="toolbar-sep" />

      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          className={`btn-compact ${activeTool === id ? 'tool-active' : ''}`}
          title={label}
          aria-label={label}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}

      <div className="toolbar-sep" />

      <label className="flex items-center gap-2" title="Color picker">
        <PaletteIcon size={20} className="text-on-surface-variant" />
        <input
          type="color"
          value={activeColor}
          onChange={e => dispatch({ type: 'SET_COLOR', payload: { tabId, color: e.target.value } })}
          className="w-8 h-8 rounded-lg bg-transparent border-0"
          aria-label="Annotation color"
        />
      </label>

      <div className="toolbar-sep" />

      <button
        onClick={() => dispatch({ type: 'UNDO_ANNOTATION', payload: { tabId, page: activeTab.currentPage } })}
        className="btn-icon-xs"
        title="Undo last annotation"
        aria-label="Undo last annotation"
      >
        <UndoIcon size={20} />
      </button>
    </div>
  )
}

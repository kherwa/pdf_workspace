import { useApp } from '../../context/AppContext'
import type { ToolName } from '../../types/annotations'
import { HighlightIcon, TypeIcon, PenIcon, SquareIcon, CircleIcon, UndoIcon } from '../shared/Icons'

const TOOLS: { id: ToolName; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'highlight', label: 'Highlight', Icon: HighlightIcon },
  { id: 'text',      label: 'Text',      Icon: TypeIcon },
  { id: 'freehand',  label: 'Draw',      Icon: PenIcon },
  { id: 'rect',      label: 'Rectangle', Icon: SquareIcon },
  { id: 'ellipse',   label: 'Ellipse',   Icon: CircleIcon },
]

const COLORS = [
  { value: '#FFFF00', label: 'Yellow' },
  { value: '#00FF00', label: 'Green' },
  { value: '#FF0000', label: 'Red' },
  { value: '#0000FF', label: 'Blue' },
  { value: '#8B4513', label: 'Brown' },
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

      <div className="flex items-center gap-1.5" role="group" aria-label="Color picker">
        {COLORS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => dispatch({ type: 'SET_COLOR', payload: { tabId, color: value } })}
            className={`color-swatch ${activeColor === value ? 'color-swatch-active' : ''}`}
            style={{ backgroundColor: value }}
            title={label}
            aria-label={label}
          />
        ))}
      </div>

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

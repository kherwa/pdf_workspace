import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppState, Action, Tab } from '../types/app'
import { defaultCompressionSettings } from '../types/compress'

export const initialState: AppState = {
  tabs: [],
  activeTabId: null,
  mode: 'view',
  mergeSources: [],
  compression: defaultCompressionSettings,
  drawerCollapsed: false,
  drawerView: 'home',
  homeSection: 'recent',
  computerFolder: null,
  selectedOrganisePage: null,
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'OPEN_TAB':
      return {
        ...state,
        tabs: [...state.tabs, action.payload],
        activeTabId: action.payload.id,
        drawerView: state.drawerView === 'home' ? 'all' : state.drawerView,
      }

    case 'CLOSE_TAB': {
      const tabs = state.tabs.filter(t => t.id !== action.payload.tabId)
      const activeTabId =
        state.activeTabId === action.payload.tabId
          ? (tabs.at(-1)?.id ?? null)
          : state.activeTabId
      return { ...state, tabs, activeTabId, ...(tabs.length === 0 ? { mode: 'view' as const, drawerView: 'home' as const } : {}) }
    }

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTabId: action.payload.tabId,
        drawerView: action.payload.tabId && state.drawerView === 'home' ? 'all' : state.drawerView,
      }

    case 'UPDATE_TAB':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId ? { ...t, ...action.payload } : t
        ),
      }

    case 'SET_MODE':
      return { ...state, mode: action.payload.mode }

    case 'SET_PAGE':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, currentPage: action.payload.page }
            : t
        ),
      }

    case 'SET_SCALE':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, scale: action.payload.scale }
            : t
        ),
      }

    case 'SET_EDIT_MODE':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, editMode: action.payload.editMode, activeTool: null }
            : t
        ),
      }

    case 'SET_ACTIVE_TOOL':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, activeTool: action.payload.tool }
            : t
        ),
      }

    case 'SET_COLOR':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, activeColor: action.payload.color }
            : t
        ),
      }

    case 'ADD_ANNOTATION': {
      const { tabId, page, ann } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const existing = t.annotations[page] ?? []
          return { ...t, dirty: true, annotations: { ...t.annotations, [page]: [...existing, ann] } }
        }),
      }
    }

    case 'UNDO_ANNOTATION': {
      const { tabId, page } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const existing = t.annotations[page] ?? []
          return { ...t, annotations: { ...t.annotations, [page]: existing.slice(0, -1) } }
        }),
      }
    }

    case 'REORDER_PAGES':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, dirty: true, pageOrder: action.payload.newOrder }
            : t
        ),
      }

    case 'ROTATE_PAGE': {
      const { tabId, page, delta } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const current = (t.rotations[page] ?? 0) as number
          const next = ((current + delta + 360) % 360) as 0 | 90 | 180 | 270
          return { ...t, dirty: true, rotations: { ...t.rotations, [page]: next } }
        }),
      }
    }

    case 'DELETE_PAGES': {
      const { tabId, pages } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const newOrder = t.pageOrder.filter(p => !pages.includes(p))
          return { ...t, dirty: true, pageOrder: newOrder }
        }),
      }
    }

    case 'ADD_REDACTION': {
      const { tabId, page, rect } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const existing = t.redactions[page] ?? []
          return { ...t, dirty: true, redactions: { ...t.redactions, [page]: [...existing, rect] } }
        }),
      }
    }

    case 'UNDO_REDACTION': {
      const { tabId, page } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t => {
          if (t.id !== tabId) return t
          const existing = t.redactions[page] ?? []
          return { ...t, redactions: { ...t.redactions, [page]: existing.slice(0, -1) } }
        }),
      }
    }

    case 'CLEAR_REDACTIONS':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId ? { ...t, redactions: {} } : t
        ),
      }

    case 'ADD_MERGE_SOURCE':
      return { ...state, mergeSources: [...state.mergeSources, action.payload.source] }

    case 'REMOVE_MERGE_SOURCE':
      return {
        ...state,
        mergeSources: state.mergeSources.filter(s => s.tabId !== action.payload.tabId),
      }

    case 'REORDER_MERGE':
      return { ...state, mergeSources: action.payload.sources }

    case 'TOGGLE_MERGE_PAGE': {
      const { tabId, page } = action.payload
      return {
        ...state,
        mergeSources: state.mergeSources.map(s => {
          if (s.tabId !== tabId) return s
          const selected = s.selectedPages.includes(page)
            ? s.selectedPages.filter(p => p !== page)
            : [...s.selectedPages, page]
          return { ...s, selectedPages: selected }
        }),
      }
    }

    case 'SET_COMPRESSION':
      return { ...state, compression: { ...state.compression, ...action.payload } }

    case 'TOGGLE_DRAWER':
      return { ...state, drawerCollapsed: !state.drawerCollapsed }

    case 'SET_DRAWER_VIEW':
      return { ...state, drawerView: action.payload.view }

    case 'SET_HOME_SECTION':
      return { ...state, homeSection: action.payload.section }

    case 'SET_COMPUTER_FOLDER':
      return { ...state, computerFolder: action.payload.folder, homeSection: 'computer' }

    case 'SET_ORGANISE_PAGE':
      return { ...state, selectedOrganisePage: action.payload.page }

    case 'SET_VIEW_LAYOUT':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, viewLayout: action.payload.layout }
            : t
        ),
      }

    case 'MARK_DIRTY':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId ? { ...t, dirty: true } : t
        ),
      }

    case 'MARK_CLEAN':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.tabId ? { ...t, dirty: false } : t
        ),
      }

    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  activeTab: Tab | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null
  return (
    <AppContext.Provider value={{ state, dispatch, activeTab }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

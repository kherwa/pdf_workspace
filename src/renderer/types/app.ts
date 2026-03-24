import type { Annotation, RedactionRect, ToolName } from './annotations'
import type { CompressionSettings } from './compress'

export type AppMode = 'view' | 'organise' | 'merge' | 'compress' | 'redact'
export type DrawerView = 'home' | 'all' | 'edit' | 'convert'
export type HomeSection = 'recent' | 'computer'
export type ComputerFolder = 'desktop' | 'downloads' | 'documents' | null

export interface Tab {
  id: string
  fileName: string
  fileHandle: FileSystemFileHandle | null
  filePath: string | null              // filesystem path for IPC-based save
  numPages: number
  currentPage: number
  scale: number
  pageOrder: number[]            // staged reordering (organise mode)
  rotations: Record<number, 0 | 90 | 180 | 270>   // per-page rotation delta
  annotations: Record<number, Annotation[]>
  redactions: Record<number, RedactionRect[]>       // staged, not yet applied
  editMode: boolean
  activeTool: ToolName | null
  activeColor: string
  isLoading: boolean
}

export interface MergeSource {
  tabId: string
  fileName: string
  numPages: number
  selectedPages: number[]        // 1-based page numbers to include (all = all pages)
}

export interface AppState {
  tabs: Tab[]
  activeTabId: string | null
  mode: AppMode
  mergeSources: MergeSource[]
  compression: CompressionSettings
  drawerCollapsed: boolean
  drawerView: DrawerView
  homeSection: HomeSection
  computerFolder: ComputerFolder
  selectedOrganisePage: number | null
}

export type Action =
  | { type: 'OPEN_TAB';           payload: Tab }
  | { type: 'CLOSE_TAB';          payload: { tabId: string } }
  | { type: 'SET_ACTIVE_TAB';     payload: { tabId: string | null } }
  | { type: 'UPDATE_TAB';         payload: { tabId: string } & Partial<Tab> }
  | { type: 'SET_MODE';           payload: { mode: AppMode } }
  | { type: 'SET_PAGE';           payload: { tabId: string; page: number } }
  | { type: 'SET_SCALE';          payload: { tabId: string; scale: number } }
  | { type: 'SET_EDIT_MODE';      payload: { tabId: string; editMode: boolean } }
  | { type: 'SET_ACTIVE_TOOL';    payload: { tabId: string; tool: ToolName | null } }
  | { type: 'SET_COLOR';          payload: { tabId: string; color: string } }
  | { type: 'ADD_ANNOTATION';     payload: { tabId: string; page: number; ann: Annotation } }
  | { type: 'UNDO_ANNOTATION';    payload: { tabId: string; page: number } }
  | { type: 'REORDER_PAGES';      payload: { tabId: string; newOrder: number[] } }
  | { type: 'ROTATE_PAGE';        payload: { tabId: string; page: number; delta: 90 | -90 } }
  | { type: 'DELETE_PAGES';       payload: { tabId: string; pages: number[] } }
  | { type: 'ADD_REDACTION';      payload: { tabId: string; page: number; rect: RedactionRect } }
  | { type: 'UNDO_REDACTION';     payload: { tabId: string; page: number } }
  | { type: 'CLEAR_REDACTIONS';   payload: { tabId: string } }
  | { type: 'ADD_MERGE_SOURCE';   payload: { source: MergeSource } }
  | { type: 'REMOVE_MERGE_SOURCE';payload: { tabId: string } }
  | { type: 'REORDER_MERGE';      payload: { sources: MergeSource[] } }
  | { type: 'TOGGLE_MERGE_PAGE';  payload: { tabId: string; page: number } }
  | { type: 'SET_COMPRESSION';    payload: Partial<CompressionSettings> }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'SET_DRAWER_VIEW';   payload: { view: DrawerView } }
  | { type: 'SET_HOME_SECTION';  payload: { section: HomeSection } }
  | { type: 'SET_COMPUTER_FOLDER'; payload: { folder: ComputerFolder } }
  | { type: 'SET_ORGANISE_PAGE';  payload: { page: number | null } }

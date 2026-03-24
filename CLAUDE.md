# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm run dev` — concurrent esbuild watch + Vite dev server + Electron (hot-reload renderer)
- `npm run build` — production build (esbuild main/preload + Vite renderer -> `dist/`)
- `npm run build:main` — esbuild only (main + preload -> `dist/main.cjs`, `dist/preload.cjs`)
- `npm start` — launch Electron (requires prior `npm run build`)
- `npm run pack` — build + electron-builder portable (output in `release/`)
- `npm run dist` — build + electron-builder NSIS installer (output in `release/`)

No test framework is configured.

## Architecture

Electron app with three layers:

1. **Main process** (`src/main/`) — window creation, native menu. Compiled by esbuild -> `dist/main.cjs`.
2. **Preload** (`src/preload/preload.ts`) — exposes IPC bridge to renderer via `contextBridge`. Compiled -> `dist/preload.cjs`.
3. **Renderer** (`src/renderer/`) — React 18 + TypeScript + Tailwind v4. Compiled by Vite -> `dist/renderer/`.

**PDF engine**: MuPDF WASM runs in a Web Worker (`src/renderer/workers/mupdf.worker.ts`), bridged via Comlink (`src/renderer/hooks/useMupdf.ts`). All PDF operations (render, search, annotate, redact, merge, compress, split, extract images, scrub) happen in the worker. The worker maintains a `Map<tabId, PDFDocument>` for open documents.

**File I/O**: Dual strategy — File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) for renderer-driven file access, plus IPC fallback (`fs:readFileBuffer` / `fs:writeFileBuffer`) for path-based reads/writes when FSA handles are unavailable.

**State**: Single `useReducer` + React Context (`src/renderer/context/AppContext.tsx`). All app state lives in `AppState`; per-document state (page, scale, annotations, redactions, page order, rotations) lives in `Tab` objects within `state.tabs`.

**Rendering**: PDF pages rendered to `<canvas>` via MuPDF pixmaps. SVG overlays handle annotations (`AnnotationLayer.tsx`) and redactions (`RedactLayer.tsx`) in edit mode.

### IPC Channels

The native menu is hidden (accelerator-only). The visible menu bar is a custom React component (`MenuBar`).

Main -> Renderer (via `webContents.send`):
- `menu:open`, `menu:save`, `menu:saveAs`, `menu:closeTab`

Renderer -> Main (via `ipcRenderer.invoke`):
- `fs:getQuickPaths`, `fs:listPDFs`, `fs:readFileBuffer`, `fs:writeFileBuffer`
- `theme:changed` (one-way, `ipcRenderer.send`)

### Component Layout

```
App -> MenuBar (custom title bar + drag region)
    -> TopBar (file tabs + action buttons, shown when file open)
    -> ModeBar (vertical nav drawer, left side)
    -> Context toolbar (EditBar | OrganiseToolbar | MergeToolbar | CompressToolbar | RedactToolbar)
    -> Main area (HomeView | DropZone | ViewMode | OrganiseMode | MergeMode | CompressMode | RedactMode)
    -> StatusBar (right side, shown when file open)
```

## Modes

`view` is the default mode (no button in nav drawer). The 4 tool modes are in the vertical ModeBar; clicking the active mode toggles back to `view`.

| Mode | Purpose | Key behavior |
|------|---------|-------------|
| `view` | Read PDF, annotate (highlight, ink, text, shapes, OCR edit) | Konva overlay in edit mode; annotations stored per-page in Tab |
| `organise` | Drag-and-drop page reorder, rotate, delete | Uses @atlaskit/pragmatic-drag-and-drop; save always uses Save As |
| `merge` | Combine pages from multiple open PDFs | Per-file page selection; output via showSaveFilePicker |
| `compress` | Reduce file size (simple or advanced settings) | Save to disk only, no new tab opened |
| `redact` | Draw rects or search-and-mark text, then apply permanently | MuPDF redaction API; irreversible once applied |

## Key Conventions & Quirks

- **`"type": "module"`** in package.json — main/preload must output as `.cjs` (CommonJS) via esbuild
- **Vite target = `esnext`** — required for MuPDF WASM top-level await
- **MuPDF excluded from optimizeDeps** — `optimizeDeps.exclude: ['mupdf']` in vite.config.ts
- **Path alias**: `@/` -> `src/renderer/` (configured in both vite.config.ts and tsconfig.json)
- **File System Access API**: accessed via `(window as any).showOpenFilePicker` (no @types installed)
- **Coordinate systems**: canvas/konva use y-down pixel coords; MuPDF uses PDF coordinate space — scale conversion happens in the worker's `embedAnnotations()` helper
- **Custom title bar**: `titleBarStyle: 'hidden'` with `titleBarOverlay` — the MenuBar component provides a drag region and custom menus
- **Window background**: `#161616` (dark theme default) — overlay colors update via `theme:changed` IPC
- **MuPDF worker is a singleton** — one Web Worker for the entire app lifetime, accessed via `useMupdf()` hook
- **Annotations are canvas-pixel coordinates** — divided by scale when embedding into MuPDF PDF annotations on save
- **Tab deduplication**: opening a file with the same `fileName` as an existing tab activates that tab instead of opening a duplicate

## MuPDF Documentation
https://mupdf.readthedocs.io/en/1.27.0/guide/using-with-javascript.html
[How to Guide MuPDF.js](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/index.html)
[Electron App Example](https://github.com/ArtifexSoftware/mupdf.js/tree/master/examples/electron)

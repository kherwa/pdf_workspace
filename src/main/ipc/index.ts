import { ipcMain, BrowserWindow, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const OVERLAY_COLORS = {
  dark:  { color: '#0D0D0D', symbolColor: '#e6e6e6' },
  light: { color: '#E8E8E8', symbolColor: '#222222' },
}

let registered = false
let currentWin: BrowserWindow

export function registerAllHandlers(win: BrowserWindow) {
  currentWin = win

  if (registered) return
  registered = true

  // Update titlebar overlay colors when renderer theme changes (Windows only)
  ipcMain.on('theme:changed', (_e, theme: string) => {
    if (process.platform === 'win32') {
      const colors = theme === 'light' ? OVERLAY_COLORS.light : OVERLAY_COLORS.dark
      currentWin.setTitleBarOverlay({ ...colors, height: 40 })
    }
  })

  // Return well-known directory paths
  ipcMain.handle('fs:getQuickPaths', () => ({
    desktop: app.getPath('desktop'),
    downloads: app.getPath('downloads'),
    documents: app.getPath('documents'),
  }))

  // List PDF files in a directory
  ipcMain.handle('fs:listPDFs', (_e, dirPath: string) => {
    try {
      // Verify directory exists and is accessible
      fs.accessSync(dirPath, fs.constants.R_OK)
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
        .map(e => {
          try {
            const fullPath = path.join(dirPath, e.name)
            const stat = fs.statSync(fullPath)
            return {
              name: e.name,
              path: fullPath,
              size: stat.size,
              modified: stat.mtimeMs,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.modified - a.modified)
    } catch (err: any) {
      console.warn(`Cannot read directory "${dirPath}":`, err?.code || err?.message)
      return []
    }
  })

  // Read a file and return its buffer
  ipcMain.handle('fs:readFileBuffer', (_e, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath)
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } catch {
      return null
    }
  })

  // Write bytes to a file path (for save-in-place when no FSA handle)
  ipcMain.handle('fs:writeFileBuffer', (_e, filePath: string, data: ArrayBuffer) => {
    try {
      fs.writeFileSync(filePath, Buffer.from(data))
      return true
    } catch {
      return false
    }
  })

  // Prevent unhandled-ipc warnings if renderer accidentally invokes old channels
  const noop = async () => null
  for (const ch of ['dialog:openFile', 'dialog:saveFile', 'fs:writeFile', 'fs:readFile', 'ocr:recognize']) {
    if (!ipcMain.listenerCount(ch)) ipcMain.handle(ch, noop)
  }
}

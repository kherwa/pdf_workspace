import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onMenuOpen:     (cb: () => void) => ipcRenderer.on('menu:open',     () => cb()),
  onMenuSave:     (cb: () => void) => ipcRenderer.on('menu:save',     () => cb()),
  onMenuSaveAs:   (cb: () => void) => ipcRenderer.on('menu:saveAs',   () => cb()),
  onMenuCloseTab: (cb: () => void) => ipcRenderer.on('menu:closeTab', () => cb()),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  triggerMenuOpen:     () => ipcRenderer.emit('menu:open'),
  triggerMenuSave:     () => ipcRenderer.emit('menu:save'),
  triggerMenuSaveAs:   () => ipcRenderer.emit('menu:saveAs'),
  triggerMenuCloseTab: () => ipcRenderer.emit('menu:closeTab'),
  setTheme:            (theme: string) => ipcRenderer.send('theme:changed', theme),
  getQuickPaths:       () => ipcRenderer.invoke('fs:getQuickPaths'),
  listPDFs:            (dirPath: string) => ipcRenderer.invoke('fs:listPDFs', dirPath),
  readFileBuffer:      (filePath: string) => ipcRenderer.invoke('fs:readFileBuffer', filePath),
  writeFileBuffer:     (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('fs:writeFileBuffer', filePath, data),
})

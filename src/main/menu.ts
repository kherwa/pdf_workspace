import { Menu, BrowserWindow, app } from 'electron'

export function buildMenu(win: BrowserWindow) {
  // Hidden menu — keeps keyboard accelerators working
  // The visible menu is rendered in the BrowserWindow (custom MenuBar component)
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS requires an app-name menu as the first item for accelerators to work
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:saveAs') },
        { type: 'separator' },
        { label: 'Close File', accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('menu:closeTab') },
        ...(!isMac ? [{ role: 'quit' as const }] : []),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

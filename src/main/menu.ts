import { Menu, BrowserWindow } from 'electron'

export function buildMenu(win: BrowserWindow) {
  // Hidden menu — keeps keyboard accelerators working
  // The visible menu is rendered in the BrowserWindow (custom MenuBar component)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '',
      submenu: [
        { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:open'), visible: false },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:save'), visible: false },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:saveAs'), visible: false },
        { label: 'Close File', accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('menu:closeTab'), visible: false },
        { role: 'quit', visible: false },
        { role: 'reload', visible: false },
        { role: 'toggleDevTools', visible: false },
        { role: 'resetZoom', visible: false },
        { role: 'zoomIn', visible: false },
        { role: 'zoomOut', visible: false },
        { role: 'togglefullscreen', visible: false },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

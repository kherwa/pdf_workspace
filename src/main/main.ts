import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import { registerAllHandlers } from './ipc/index'
import { buildMenu } from './menu'

const isDev = process.env.NODE_ENV === 'development'

function resolveIcon(): string {
  // Dev / unpackaged: icon lives next to the project root
  const devPath = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(devPath)) return devPath
  // Packaged: icon is in extraResources
  return path.join(process.resourcesPath, 'icon.png')
}

let mainWindow: BrowserWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0D0D0D' : '#E8E8E8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Linux: use default frame (WMs vary too much for custom title bars)
    // macOS/Windows: hidden title bar with custom drag region
    ...(process.platform === 'linux' ? {} : { titleBarStyle: 'hidden' as const }),
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 20, y: 14 } } : {}),
    ...(process.platform === 'win32' ? {
      titleBarOverlay: {
        color: nativeTheme.shouldUseDarkColors ? '#0D0D0D' : '#E8E8E8',
        symbolColor: nativeTheme.shouldUseDarkColors ? '#e6e6e6' : '#222222',
        height: 40,
      },
    } : {}),
    icon: resolveIcon(),
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Notify renderer of fullscreen changes (macOS traffic lights hide in fullscreen)
  mainWindow.on('enter-full-screen', () => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen:changed', true)
  })
  mainWindow.on('leave-full-screen', () => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen:changed', false)
  })

  // Fallback: force show after 3s in case ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show()
  }, 3000)

  registerAllHandlers(mainWindow)
  buildMenu(mainWindow)

  // Listen for OS theme changes and notify renderer so theme updates while app is open
  nativeTheme.on('updated', () => {
    try {
      const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme:system', theme)
        if (process.platform === 'win32' && mainWindow.setTitleBarOverlay) {
          const colors = theme === 'light' ? { color: '#ffffff', symbolColor: '#222222' } : { color: '#161616', symbolColor: '#e6e6e6' }
          mainWindow.setTitleBarOverlay({ ...colors, height: 40 })
        }
      }
    } catch (err) {
      // ignore
    }
  })
}

app.whenReady().then(() => {
  // macOS: set dock icon (BrowserWindow.icon doesn't affect the dock)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(resolveIcon())
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

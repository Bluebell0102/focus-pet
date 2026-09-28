const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

let mainWindow = null
let tray = null
let isQuitting = false
let savePositionTimer = null
let pendingWindowSizeTimer = null
let pendingWindowSizeRequest = null
let lastIgnoreMouseEvents = null

const WINDOW_WIDTH = 380
const WINDOW_HEIGHTS = {
  compact: 540,
  expanded: 760,
}
const WINDOW_BOUNDS_LIMITS = {
  minWidth: WINDOW_WIDTH,
  minHeight: 360,
  maxWidth: WINDOW_WIDTH,
  maxHeight: 760,
}

function getRendererEntry() {
  return path.join(__dirname, '..', 'dist', 'index.html')
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
  ]

  return candidates.find((iconPath) => iconPath && fs.existsSync(iconPath)) || null
}

function getWindowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function isUsablePosition(position) {
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return false
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false

  return screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.workArea
    return position.x >= x && position.x <= x + width - 80 && position.y >= y && position.y <= y + height - 80
  })
}

function readSavedWindowPosition() {
  try {
    const raw = fs.readFileSync(getWindowStateFile(), 'utf8')
    const position = JSON.parse(raw)
    return isUsablePosition(position) ? { x: position.x, y: position.y } : null
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to read saved window position.', error)
    }
    return null
  }
}

function saveWindowPosition(win = mainWindow) {
  if (!win || win.isDestroyed()) return

  try {
    const [x, y] = win.getPosition()
    fs.writeFileSync(getWindowStateFile(), JSON.stringify({ x, y }, null, 2))
  } catch (error) {
    console.warn('Failed to save window position.', error)
  }
}

function debounceSaveWindowPosition(win = mainWindow) {
  if (savePositionTimer) clearTimeout(savePositionTimer)
  savePositionTimer = setTimeout(() => {
    savePositionTimer = null
    saveWindowPosition(win)
  }, 500)
}

function createTrayIcon() {
  const iconPath = getAppIconPath()
  if (iconPath) {
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) return icon
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#ffd6a5"/>
      <circle cx="12" cy="13" r="3" fill="#4a3528"/>
      <circle cx="20" cy="13" r="3" fill="#4a3528"/>
      <path d="M11 21c2.7 2.2 7.3 2.2 10 0" fill="none" stroke="#4a3528" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  `

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}

function showWindow() {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function hideWindow() {
  mainWindow?.hide()
}

function minimizeWindow() {
  mainWindow?.minimize()
}

function getWindowModeSize(mode) {
  return { height: WINDOW_HEIGHTS[mode] || WINDOW_HEIGHTS.compact }
}

function clampWindowSize(size) {
  return {
    height: Math.round(
      Math.min(
        Math.max(Number(size.height) || WINDOW_HEIGHTS.compact, WINDOW_BOUNDS_LIMITS.minHeight),
        WINDOW_BOUNDS_LIMITS.maxHeight,
      ),
    ),
  }
}

function setWindowSize(win, requestedSize) {
  if (!win || win.isDestroyed()) return

  const size = clampWindowSize(requestedSize)
  const [x, y] = win.getPosition()
  const [oldWidth, oldHeight] = win.getSize()
  const nextWidth = oldWidth
  if (oldHeight === size.height) return

  const display = screen.getDisplayMatching({
    x,
    y,
    width: oldWidth,
    height: oldHeight,
  })
  const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea
  const maxX = areaX + areaWidth - nextWidth
  const maxY = areaY + areaHeight - size.height

  win.setBounds({
    x: Math.min(Math.max(x, areaX), Math.max(areaX, maxX)),
    y: Math.min(Math.max(y, areaY), Math.max(areaY, maxY)),
    width: nextWidth,
    height: size.height,
  })
}

function requestWindowSize(win, requestedSize) {
  if (!win || win.isDestroyed()) return

  pendingWindowSizeRequest = {
    win,
    size: clampWindowSize(requestedSize),
  }

  if (pendingWindowSizeTimer) return

  pendingWindowSizeTimer = setTimeout(() => {
    pendingWindowSizeTimer = null
    const request = pendingWindowSizeRequest
    pendingWindowSizeRequest = null
    if (!request) return

    setWindowSize(request.win, request.size)
  }, 50)
}

function setWindowMode(win, mode) {
  requestWindowSize(win, getWindowModeSize(mode))
}

function updateTrayMenu() {
  if (!tray) return

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show Focus Pet',
      click: showWindow,
    },
    {
      label: 'Hide',
      click: hideWindow,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
}

function createTray() {
  if (tray) return

  tray = new Tray(createTrayIcon())
  tray.setToolTip('Focus Pet')
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      hideWindow()
      return
    }

    showWindow()
  })
  updateTrayMenu()
}

function createWindow() {
  Menu.setApplicationMenu(null)
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = WINDOW_WIDTH
  const windowHeight = WINDOW_HEIGHTS.compact
  const savedPosition = readSavedWindowPosition()
  const defaultPosition = {
    x: Math.max(0, screenWidth - windowWidth - 28),
    y: Math.max(0, screenHeight - windowHeight - 28),
  }
  const iconPath = getAppIconPath()
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: savedPosition?.x ?? defaultPosition.x,
    y: savedPosition?.y ?? defaultPosition.y,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_BOUNDS_LIMITS.minHeight,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    show: false,
    backgroundColor: '#00000000',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return

    event.preventDefault()
    hideWindow()
  })

  mainWindow.on('move', () => {
    debounceSaveWindowPosition(mainWindow)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(getRendererEntry())
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return

  new Notification({
    title,
    body,
    silent: false,
  }).show()
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.focuspet.app')
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    showWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
  if (savePositionTimer) {
    clearTimeout(savePositionTimer)
    savePositionTimer = null
  }
  saveWindowPosition()
})

ipcMain.handle('window:hide', () => {
  hideWindow()
})

ipcMain.handle('window:minimize', () => {
  minimizeWindow()
})

ipcMain.handle('window:show', () => {
  showWindow()
})

ipcMain.handle('window:move-by', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || !payload) return

  const deltaX = Number(payload.deltaX)
  const deltaY = Number(payload.deltaY)
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return

  const [x, y] = win.getPosition()
  win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY))
})

ipcMain.handle('focus-pet:set-window-mode', (event, mode) => {
  setWindowMode(BrowserWindow.fromWebContents(event.sender), mode)
})

ipcMain.handle('focus-pet:set-window-bounds', (event, payload) => {
  if (!payload) return

  requestWindowSize(BrowserWindow.fromWebContents(event.sender), {
    height: payload.height,
  })
})

ipcMain.handle('focus-pet:set-ignore-mouse-events', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return

  const nextIgnore = Boolean(ignore)
  if (lastIgnoreMouseEvents === nextIgnore) return

  lastIgnoreMouseEvents = nextIgnore
  win.setIgnoreMouseEvents(nextIgnore, { forward: true })
})

ipcMain.handle('window:close', () => {
  isQuitting = true
  app.quit()
})

ipcMain.handle('focus-pet:get-open-at-login', () => {
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('focus-pet:set-open-at-login', (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
  })

  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('notify', (_event, payload) => {
  if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') return

  showNotification(payload.title, payload.body)
})

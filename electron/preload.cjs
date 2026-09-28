const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('focusPet', {
  hide: () => ipcRenderer.invoke('window:hide'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  show: () => ipcRenderer.invoke('window:show'),
  close: () => ipcRenderer.invoke('window:close'),
  moveBy: (deltaX, deltaY) => ipcRenderer.invoke('window:move-by', { deltaX, deltaY }),
  setWindowMode: (mode) => ipcRenderer.invoke('focus-pet:set-window-mode', mode),
  setWindowBounds: (bounds) => ipcRenderer.invoke('focus-pet:set-window-bounds', bounds),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('focus-pet:set-ignore-mouse-events', ignore),
  getOpenAtLogin: () => ipcRenderer.invoke('focus-pet:get-open-at-login'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('focus-pet:set-open-at-login', enabled),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
})

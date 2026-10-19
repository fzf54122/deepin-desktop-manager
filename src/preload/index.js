// @Time    : 2026/10/19 14:50
// @Author  : fzf
// @FileName: index.js
// @Software: deepin-desktop-manager

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  scan: () => ipcRenderer.invoke('desktop:scan'),
  readRaw: (filePath) => ipcRenderer.invoke('desktop:read-raw', filePath),
  save: (payload) => ipcRenderer.invoke('desktop:save', payload),
  patch: (payload) => ipcRenderer.invoke('desktop:patch', payload),
  remove: (filePath) => ipcRenderer.invoke('desktop:delete', filePath),
  template: (data) => ipcRenderer.invoke('desktop:template', data),
  resolveIcon: (candidates) => ipcRenderer.invoke('desktop:resolve-icon', candidates),
  copyToUser: (payload) => ipcRenderer.invoke('desktop:copy-to-user', payload),
  openBackupDir: () => ipcRenderer.invoke('desktop:open-backup-dir'),
  showInFolder: (filePath) => ipcRenderer.invoke('desktop:show-in-folder', filePath),
  alert: (payload) => ipcRenderer.invoke('desktop:alert', payload),
  setLocale: (locale) => ipcRenderer.invoke('app:set-locale', locale),
  onMenu: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('menu', handler)
    return () => ipcRenderer.removeListener('menu', handler)
  }
})

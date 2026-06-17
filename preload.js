const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:      ()   => ipcRenderer.send('win-minimize'),
  maximize:      ()   => ipcRenderer.send('win-maximize'),
  close:         ()   => ipcRenderer.send('win-close'),
  scanProcesses: ()   => ipcRenderer.invoke('scan-processes'),
  onProcessList: (cb) => ipcRenderer.on('process-list', (_, list) => cb(list)),
  onWinStatus:   (cb) => ipcRenderer.on('win-status', (_, data) => cb(data)),
  updateTray:    (lbl)=> ipcRenderer.send('tray-update', lbl),
  setLanguage:   (lang)=> ipcRenderer.send('set-language', lang),
  getFileIcon:   (filePath) => ipcRenderer.invoke('get-file-icon', filePath),
  findProcessPath:(exeName)  => ipcRenderer.invoke('find-process-path', exeName),
  setStartup:    (openAtLogin, startMinimized) => ipcRenderer.send('set-startup', { openAtLogin, startMinimized }),
  openExternal:  (url) => ipcRenderer.send('open-external', url),
  checkForUpdates: () => ipcRenderer.send('check-for-updates-manual'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, data) => cb(data))
});



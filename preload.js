const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:      ()   => ipcRenderer.send('win-minimize'),
  maximize:      ()   => ipcRenderer.send('win-maximize'),
  close:         ()   => ipcRenderer.send('win-close'),
  scanProcesses: ()   => ipcRenderer.invoke('scan-processes'),
  onProcessList: (cb) => ipcRenderer.on('process-list', (_, list) => cb(list)),
  onWinStatus:   (cb) => ipcRenderer.on('win-status', (_, data) => cb(data)),
  updateTray:    (lbl)=> ipcRenderer.send('tray-update', lbl),
  setLanguage:   (lang)=> ipcRenderer.send('set-language', lang)
});



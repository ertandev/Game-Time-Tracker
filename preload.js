const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: ()   => ipcRenderer.invoke('get-app-version'),
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
  storeRead:     (key) => ipcRenderer.invoke('store-read', key),
  storeWrite:    (key, data) => ipcRenderer.invoke('store-write', key, data),
  setCloseToTray:(val) => ipcRenderer.send('set-close-to-tray', val),
  setStartup:    (openAtLogin, startMinimized) => ipcRenderer.send('set-startup', { openAtLogin, startMinimized }),
  openExternal:  (url) => ipcRenderer.send('open-external', url),
  checkForUpdates: () => ipcRenderer.send('check-for-updates-manual'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, data) => cb(data)),
  setWatchableGames: (val) => ipcRenderer.send('set-watchable-games', val),
  showGameContextMenu: (gameId) => ipcRenderer.send('show-game-context-menu', gameId),
  onGameMenuAction: (cb) => ipcRenderer.on('game-menu-action', (_, data) => cb(data)),
  selectCustomIcon: () => ipcRenderer.invoke('select-custom-icon'),
  selectExePath: () => ipcRenderer.invoke('select-exe-path'),
  launchGame: (filePath) => ipcRenderer.invoke('launch-game', filePath),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  fetchHltbTime: (gameName) => ipcRenderer.invoke('fetch-hltb-time', gameName),
  fetchHltbDlcs: (gameId) => ipcRenderer.invoke('fetch-hltb-dlcs', gameId),
  fetchGameRatings: (gameName) => ipcRenderer.invoke('fetch-game-ratings', gameName),
  getChildProcesses: (parentExeName) => ipcRenderer.invoke('get-child-processes', parentExeName),
  checkGameRunning: (args) => ipcRenderer.invoke('check-game-running', args)
});



const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path  = require('path');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.name = 'GameTime Tracker';
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.ertandev.gametimetracker');
  }

let mainWindow    = null;
let tray          = null;
let processPoller = null;
let idleProcess   = null;
let currentLang   = 'tr';
let isManualCheck = false;
let closeToTray   = true;

const MAIN_TRANSLATIONS = {
  tr: { open: 'Aç', exit: 'Çıkış', defaultToolTip: 'GameTime Tracker' },
  en: { open: 'Open', exit: 'Exit', defaultToolTip: 'GameTime Tracker' }
};

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720,
    minWidth: 800, minHeight: 560,
    frame: false,
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    const shouldMinimize = process.argv.includes('--hidden') || process.argv.includes('--minimized');
    if (!shouldMinimize) {
      mainWindow.show();
    }
  });
  mainWindow.on('close', e => {
    if (closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── Process helpers ──────────────────────────────────────────────────────────
const SYSTEM_PROCS = new Set([
  'system', 'registry', 'smss.exe', 'csrss.exe', 'wininit.exe',
  'winlogon.exe', 'services.exe', 'lsass.exe', 'fontdrvhost.exe',
  'dwm.exe', 'audiodg.exe', 'spoolsv.exe', 'searchindexer.exe',
  'taskhostw.exe', 'sihost.exe', 'ctfmon.exe', 'dllhost.exe',
  'conhost.exe', 'explorer.exe', 'shellexperiencehost.exe',
  'startmenuexperiencehost.exe', 'runtimebroker.exe', 'securityhealthservice.exe',
  'sgrmbroker.exe', 'wsappx.exe', 'wudfhost.exe', 'msdtc.exe',
  'electron.exe', 'node.exe', 'code.exe', 'powershell.exe', 'cmd.exe'
]);

function parseTasklist(stdout) {
  const seen = new Set();
  const list = [];
  for (const line of stdout.split('\n')) {
    const m = line.match(/^"([^"]+)","(\d+)/);
    if (!m) continue;
    const name = m[1];
    const key  = name.toLowerCase();
    if (seen.has(key) || SYSTEM_PROCS.has(key)) continue;
    seen.add(key);
    list.push({ name, pid: parseInt(m[2]) });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function parsePowerShellList(stdout) {
  const seen = new Set();
  const list = [];
  const lines = stdout.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^"([^"]+)","(\d+)",(?:"([^"]*)"|)/);
    if (!m) continue;
    let name = m[1];
    if (!name.toLowerCase().endsWith('.exe')) {
      name += '.exe';
    }
    const key = name.toLowerCase();
    if (seen.has(key) || SYSTEM_PROCS.has(key)) continue;
    seen.add(key);
    list.push({ name, pid: parseInt(m[2]), path: m[3] || '' });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Polling (auto detect open/close) ────────────────────────────────────────
function startPoller() {
  if (processPoller) return;
  const checkProcesses = () => {
    exec('tasklist /fo csv /nh', { windowsHide: true }, (err, stdout) => {
      if (err || !mainWindow) return;
      const names = parseTasklist(stdout).map(p => p.name.toLowerCase());
      mainWindow.webContents.send('process-list', names);
    });
  };
  checkProcesses();
  processPoller = setInterval(checkProcesses, 3000);
}

function stopPoller() {
  if (processPoller) {
    clearInterval(processPoller);
    processPoller = null;
  }
}

// ─── Foreground Window + Idle Time Poller ───────────────────────────────
// Every second: outputs "foregroundProcessName|idleMs"
// - foregroundProcessName: which EXE has focus right now
// - idleMs: how long since ANY keyboard/mouse input system-wide
const PS_WATCHER = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinHelper {
  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();
  [DllImport(\"user32.dll\")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport(\"user32.dll\")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  public static uint GetIdleMs() {
    var i = new LASTINPUTINFO(); i.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(i);
    GetLastInputInfo(ref i); return (uint)(Environment.TickCount - i.dwTime);
  }
  public static string GetActiveProcessName() {
    IntPtr hwnd = GetForegroundWindow();
    int pid = 0;
    GetWindowThreadProcessId(hwnd, out pid);
    if (pid == 0) return "";
    try {
      using (var p = System.Diagnostics.Process.GetProcessById(pid)) {
        return p.ProcessName.ToLower();
      }
    } catch {
      return "";
    }
  }
}
"@ -ErrorAction SilentlyContinue
while (\$true) {
  \$name = [WinHelper]::GetActiveProcessName()
  \$idle = [WinHelper]::GetIdleMs()
  Write-Output "\$name|\$idle"
  Start-Sleep -Milliseconds 1000
}
`;

function startIdlePoller() {
  idleProcess = spawn('powershell', [
    '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', PS_WATCHER
  ], { windowsHide: true });

  let buf = '';
  idleProcess.stdout.on('data', data => {
    buf += data.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const sep = trimmed.lastIndexOf('|');
      if (sep < 0) continue;
      const procName = trimmed.slice(0, sep);
      const idleMs   = parseInt(trimmed.slice(sep + 1));
      if (mainWindow && !isNaN(idleMs)) {
        mainWindow.webContents.send('win-status', { procName, idleMs });
      }
    }
  });

  idleProcess.on('exit', () => {
    idleProcess = null;
    if (!app.isQuitting) setTimeout(startIdlePoller, 3000);
  });
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// One-shot scan (invokable)
ipcMain.handle('scan-processes', () =>
  new Promise(resolve => {
    exec('powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object MainWindowTitle | Select-Object -Property ProcessName, Id, Path | ConvertTo-Csv -NoTypeInformation"', { windowsHide: true }, (err, stdout) => {
      resolve(err ? [] : parsePowerShellList(stdout));
    });
  })
);

ipcMain.handle('store-read', async (event, key) => {
  try {
    const filePath = path.join(app.getPath('userData'), `${key}.json`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e) {
    console.error('Failed to read store from disk:', e);
  }
  return null;
});

ipcMain.handle('store-write', async (event, key, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), `${key}.json`);
    fs.writeFileSync(filePath, data, 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write store to disk:', e);
    return false;
  }
});

// Window controls
ipcMain.on('win-minimize', () => mainWindow?.hide());
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('win-close',    () => {
  if (closeToTray) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});
ipcMain.on('tray-update',  (_, label) => tray?.setToolTip(label || (MAIN_TRANSLATIONS[currentLang] || MAIN_TRANSLATIONS.tr).defaultToolTip));
ipcMain.on('set-language', (_, lang) => {
  currentLang = lang;
  if (tray) updateTrayMenu();
});
ipcMain.on('open-external', (_, url) => {
  try {
    shell.openExternal(url);
  } catch (e) {
    console.error('Failed to open external link:', e);
  }
});
ipcMain.on('set-startup', (_, { openAtLogin, startMinimized }) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: openAtLogin,
      path: app.getPath('exe'),
      args: startMinimized ? ['--hidden'] : []
    });
  } catch (e) {
    console.error('Failed to set login item settings:', e);
  }
});

ipcMain.on('set-close-to-tray', (_, value) => {
  closeToTray = !!value;
});

let isWatchingProcesses = false;
ipcMain.on('set-watchable-games', (_, val) => {
  const shouldWatch = !!val;
  if (shouldWatch && !isWatchingProcesses) {
    isWatchingProcesses = true;
    startPoller();
  } else if (!shouldWatch && isWatchingProcesses) {
    isWatchingProcesses = false;
    stopPoller();
  }
});

const CONTEXT_TRANSLATIONS = {
  tr: {
    launch: '🚀 Oyunu Başlat',
    openLocation: '📂 Dosya Konumunu Aç',
    changeIcon: '🎨 Özel Simge Seç...',
    resetIcon: '🔄 Simgeyi Sıfırla',
    changeColor: '🖌️ Accent Rengini Değiştir',
    rename: '✏️ Oyunu Yeniden Adlandır',
    clearSessions: '🗑️ Oturum Geçmişini Temizle',
    deleteGame: '❌ Oyunu Sil'
  },
  en: {
    launch: '🚀 Launch Game',
    openLocation: '📂 Open File Location',
    changeIcon: '🎨 Choose Custom Icon...',
    resetIcon: '🔄 Reset Icon',
    changeColor: '🖌️ Change Accent Color',
    rename: '✏️ Rename Game',
    clearSessions: '🗑️ Clear Session History',
    deleteGame: '❌ Delete Game'
  }
};

ipcMain.handle('launch-game', async (_, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const gameDir = path.dirname(filePath);
    
    // Spawn explorer.exe to launch the game. We use spawn instead of exec to avoid
    // error callbacks triggered by explorer.exe exiting with code 1.
    const child = spawn('explorer.exe', [filePath], {
      cwd: gameDir,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return true;
  } catch (e) {
    console.error('Failed to launch game via explorer.exe:', e);
    try {
      shell.openPath(filePath);
      return true;
    } catch (err2) {
      return false;
    }
  }
});

ipcMain.handle('open-file-location', async (_, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  } catch (e) {
    console.error('Failed to open file location:', e);
    return false;
  }
});

ipcMain.handle('select-custom-icon', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Simge Dosyaları', extensions: ['png', 'jpg', 'jpeg', 'ico', 'exe'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.exe') {
      const icon = await app.getFileIcon(filePath, { size: 'normal' });
      return { icon: icon.toDataURL(), path: filePath };
    } else {
      const buffer = fs.readFileSync(filePath);
      const mimeType = ext === '.png' ? 'image/png' : ext === '.ico' ? 'image/x-icon' : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return { icon: dataUrl, path: filePath };
    }
  } catch (e) {
    console.error('Failed to select custom icon:', e);
    return null;
  }
});

ipcMain.handle('select-exe-path', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Oyun Çalıştırılabilir Dosyası', extensions: ['exe'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  } catch (e) {
    console.error('Failed to select exe path:', e);
    return null;
  }
});

ipcMain.on('show-game-context-menu', (event, gameId) => {
  const dict = CONTEXT_TRANSLATIONS[currentLang] || CONTEXT_TRANSLATIONS.tr;
  const menu = Menu.buildFromTemplate([
    { label: dict.launch, click: () => event.sender.send('game-menu-action', { action: 'launch', gameId }) },
    { label: dict.openLocation, click: () => event.sender.send('game-menu-action', { action: 'open-location', gameId }) },
    { type: 'separator' },
    { label: dict.changeIcon, click: () => event.sender.send('game-menu-action', { action: 'change-icon', gameId }) },
    { label: dict.resetIcon, click: () => event.sender.send('game-menu-action', { action: 'reset-icon', gameId }) },
    { label: dict.changeColor, click: () => event.sender.send('game-menu-action', { action: 'change-color', gameId }) },
    { type: 'separator' },
    { label: dict.rename, click: () => event.sender.send('game-menu-action', { action: 'rename', gameId }) },
    { label: dict.clearSessions, click: () => event.sender.send('game-menu-action', { action: 'clear-sessions', gameId }) },
    { label: dict.deleteGame, click: () => event.sender.send('game-menu-action', { action: 'delete', gameId }) }
  ]);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});

ipcMain.handle('get-file-icon', async (_, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    return icon.toDataURL();
  } catch (e) {
    return null;
  }
});

ipcMain.handle('find-process-path', (_, exeName) =>
  new Promise(resolve => {
    const safeExe = exeName.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeExe) return resolve(null);
    const standardizedExe = safeExe.toLowerCase().endsWith('.exe') ? safeExe : safeExe + '.exe';
    const nameWithoutExt = standardizedExe.replace(/\.exe$/i, '');
    const script = `
$exeName = '${standardizedExe}'
$nameNoExt = '${nameWithoutExt}'
$directPath = (Get-Process -Name $nameNoExt -ErrorAction SilentlyContinue).Path
if ($directPath) {
    Write-Output $directPath
    exit
}

$paths = @()
$steamPath = (Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath
if ($steamPath) {
    $paths += $steamPath
    $libFile = Join-Path $steamPath 'steamapps\\libraryfolders.vdf'
    if (Test-Path $libFile) {
        $libs = Get-Content $libFile | Select-String '"path"' | ForEach-Object { $_.Line.Split('"')[3].Replace('\\\\', '\\') }
        $paths += $libs
    }
}

$epicPath = "$env:ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests"
if (Test-Path $epicPath) {
    Get-ChildItem -Path $epicPath -Filter '*.item' | ForEach-Object {
        $json = Get-Content $_.FullName -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json -and $json.InstallLocation) {
            $paths += $json.InstallLocation
        }
    }
}

$drives = Get-Volume | Where-Object DriveLetter | ForEach-Object { $_.DriveLetter + ':\\' }
$commonDirs = @('Games', 'GOG Games', 'GOG Galaxy', 'SteamLibrary', 'Program Files', 'Program Files (x86)', 'Riot Games', 'XboxGames')
foreach ($drive in $drives) {
    foreach ($dir in $commonDirs) {
        $fullDir = Join-Path $drive $dir
        if (Test-Path $fullDir) {
            $paths += $fullDir
        }
    }
}

$found = $null
foreach ($p in ($paths | Select-Object -Unique)) {
    if (Test-Path $p) {
        $found = Get-ChildItem -Path $p -Filter $exeName -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1
        if ($found) { break }
    }
}

if ($found) {
    Write-Output $found
}
`;
    const buffer = Buffer.from(script, 'utf16le');
    const base64 = buffer.toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64}`, { windowsHide: true }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  })
);

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  const img = nativeImage.createFromPath(iconPath);
  const trayImg = img.resize({ width: 16, height: 16 });
  tray = new Tray(trayImg);
  updateTrayMenu();
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function updateTrayMenu() {
  const dict = MAIN_TRANSLATIONS[currentLang] || MAIN_TRANSLATIONS.tr;
  tray.setToolTip(dict.defaultToolTip);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: dict.open,  click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: dict.exit,  click: () => app.quit() }
  ]));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  startIdlePoller();
  
  // Auto check for updates on startup (delay to let app load) - silent
  setTimeout(() => {
    isManualCheck = false;
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.log('Silent auto-update check failed:', err.message);
    });
  }, 5000);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(processPoller);
  idleProcess?.kill();
  mainWindow?.removeAllListeners('close');
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── Auto Updater Events & IPC ────────────────────────────────────────────────
autoUpdater.autoDownload = true;

autoUpdater.on('checking-for-update', () => {
  if (isManualCheck) {
    mainWindow?.webContents.send('update-status', { status: 'checking' });
  }
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-status', { status: 'available', version: info.version });
});

autoUpdater.on('update-not-available', () => {
  if (isManualCheck) {
    mainWindow?.webContents.send('update-status', { status: 'not-available' });
  }
});

autoUpdater.on('error', (err) => {
  if (isManualCheck) {
    mainWindow?.webContents.send('update-status', { status: 'error', message: err.message || 'Unknown error' });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round(progressObj.percent) });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-status', { status: 'downloaded' });
});

ipcMain.on('check-for-updates-manual', () => {
  isManualCheck = true;
  autoUpdater.checkForUpdatesAndNotify().then((result) => {
    // If check succeeds and the remote version matches current app version, force send 'not-available'
    // to prevent UI from getting stuck if electron-updater caches and skips emitting the event.
    if (result && result.updateInfo) {
      const currentVersion = app.getVersion();
      if (result.updateInfo.version === currentVersion) {
        mainWindow?.webContents.send('update-status', { status: 'not-available' });
      }
    } else {
      // Fallback if result is empty
      mainWindow?.webContents.send('update-status', { status: 'not-available' });
    }
  }).catch(err => {
    mainWindow?.webContents.send('update-status', { status: 'error', message: err.message || 'Unknown error' });
  });
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall(true, true);
});
}


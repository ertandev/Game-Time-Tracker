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
    const args = [];
    if (!app.isPackaged) {
      args.push(app.getAppPath());
    }
    if (startMinimized) {
      args.push('--hidden');
    }
    app.setLoginItemSettings({
      openAtLogin: openAtLogin,
      path: app.getPath('exe'),
      args: args
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
    if (!filePath || !fs.existsSync(filePath)) return null;
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

ipcMain.handle('fetch-hltb-time', async (event, gameName) => {
  const HLTB_BASE_URL = 'https://howlongtobeat.com';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': HLTB_BASE_URL,
    'Origin': HLTB_BASE_URL
  };

  try {
    const initUrl = `${HLTB_BASE_URL}/api/bleed/init?t=${Date.now()}`;
    const initRes = await fetch(initUrl, { headers });
    if (!initRes.ok) {
      throw new Error(`Init failed with status ${initRes.status}`);
    }
    const initData = await initRes.json();
    const { token, hpKey, hpVal } = initData;
    if (!token || !hpKey || !hpVal) {
      throw new Error('Invalid HLTB init token data');
    }

    const searchTerms = gameName.trim().split(/\s+/);
    const payload = {
      searchType: "games",
      searchTerms: searchTerms,
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: { min: null, max: null },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          rangeYear: { min: null, max: null },
          modifier: ""
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0
      },
      useCache: true
    };

    payload[hpKey] = hpVal;

    const searchHeaders = {
      ...headers,
      'Content-Type': 'application/json',
      'x-auth-token': token,
      'x-hp-key': hpKey,
      'x-hp-val': hpVal
    };

    const searchRes = await fetch(`${HLTB_BASE_URL}/api/bleed`, {
      method: 'POST',
      headers: searchHeaders,
      body: JSON.stringify(payload)
    });

    if (!searchRes.ok) {
      throw new Error(`Search failed with status ${searchRes.status}`);
    }

    const result = await searchRes.json();
    return result.data || [];
  } catch (e) {
    console.error('Error fetching from HLTB:', e);
    return null;
  }
});

ipcMain.handle('fetch-game-ratings', async (event, gameName) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  };

  const getMetacriticSlug = (name) => {
    return name.toLowerCase()
               .replace(/[^a-z0-9\s-]/g, '')
               .trim()
               .replace(/\s+/g, '-')
               .replace(/-+/g, '-');
  };

  try {
    const slug = getMetacriticSlug(gameName);
    let url = `https://www.metacritic.com/game/${slug}/`;
    let res = await fetch(url, { headers });
    
    if (res.status === 404) {
      const searchUrl = `https://www.metacritic.com/search/game/${encodeURIComponent(gameName)}/results`;
      const searchRes = await fetch(searchUrl, { headers });
      if (searchRes.ok) {
        const searchHtml = await searchRes.text();
        const match = searchHtml.match(/href="(\/game\/[^"]+)"/i);
        if (match) {
          url = `https://www.metacritic.com${match[1]}`;
          res = await fetch(url, { headers });
        }
      }
    }

    if (!res.ok) return null;
    const html = await res.text();

    // 1. Extract metascore
    let metascore = null;
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      try {
        const data = JSON.parse(ldMatch[1]);
        if (data.aggregateRating && data.aggregateRating.ratingValue) {
          metascore = parseInt(data.aggregateRating.ratingValue);
        }
      } catch (e) {}
    }
    if (!metascore) {
      const metaBlock = html.match(/data-testid="global-score-header">Metascore[\s\S]*?data-testid="global-score-value">([\d.]+)/i);
      if (metaBlock) metascore = parseInt(metaBlock[1]);
    }

    // 2. Extract user score
    let userscore = null;
    const userBlock = html.match(/data-testid="global-score-header">User score[\s\S]*?data-testid="global-score-value">([\d.]+)/i);
    if (userBlock) userscore = parseFloat(userBlock[1]);

    // 3. Extract IGN score and direct review URL (Try direct IGN game page first)
    let ignscore = null;
    let ignUrl = null;
    let ignFetchedDirect = false;

    const getIgnSlugs = (name) => {
      const slugs = [];
      const cleaned = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();
      
      // 1. Standard slug: spaces replaced by hyphens
      slugs.push(cleaned.replace(/\s+/g, '-').replace(/-+/g, '-'));
      
      // 2. F1 games optimization: "f 1" or "f-1" to "f1"
      const f1Cleaned = cleaned.replace(/f\s*1/gi, 'f1');
      slugs.push(f1Cleaned.replace(/\s+/g, '-').replace(/-+/g, '-'));
      
      // 3. Completely compressed: no spaces/hyphens
      slugs.push(cleaned.replace(/[\s-]+/g, ''));

      return [...new Set(slugs)];
    };

    try {
      const ignSlugs = getIgnSlugs(gameName);
      for (const ignSlug of ignSlugs) {
        const ignDirectUrl = `https://www.ign.com/games/${ignSlug}`;
        const ignRes = await fetch(ignDirectUrl, { headers });
        if (ignRes.ok) {
          const ignHtml = await ignRes.text();
          const ldMatch = ignHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
          if (ldMatch) {
            const ldData = JSON.parse(ldMatch[1]);
            if (ldData.review) {
              if (ldData.review.reviewRating && ldData.review.reviewRating.ratingValue !== undefined) {
                ignscore = Math.round(parseFloat(ldData.review.reviewRating.ratingValue) * 10);
              }
              if (ldData.review.url) {
                ignUrl = ldData.review.url.replace(/^https?:\/\/(?:www\.)?ign\.comhttps?:\/\/(?:www\.)?ign\.com/i, 'https://www.ign.com');
              }
              ignFetchedDirect = true;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch direct IGN rating:', e);
    }

    // Fall back to Metacritic critic reviews if direct IGN page did not succeed
    if (!ignFetchedDirect) {
      const criticUrl = url.endsWith('/') ? url + 'critic-reviews/' : url + '/critic-reviews/';
      try {
        const criticRes = await fetch(criticUrl, { headers });
        if (criticRes.ok) {
          const criticHtml = await criticRes.text();
          const ignMatch = criticHtml.match(/<span>(\d+)<\/span><\/div><\/div>\s*IGN/i);
          if (ignMatch) ignscore = parseInt(ignMatch[1]);

          const ignUrlMatch = criticHtml.match(/"(https?:\/\/(?:www\.)?ign\.com\/[^"]+)"/i);
          if (ignUrlMatch) ignUrl = ignUrlMatch[1];
        }
      } catch (e) {
        console.error('Failed to fetch critic reviews in IPC:', e);
      }
    }

    // 4. Extract OpenCritic ratings (score, recommended percent, and game reviews page URL)
    let opencriticScore = null;
    let opencriticPercent = null;
    let opencriticUrl = null;

    try {
      const ocQueryUrl = `https://search.yahoo.com/search?q=site:opencritic.com/game+${encodeURIComponent(gameName)}`;
      const ocSearchRes = await fetch(ocQueryUrl, { headers });
      if (ocSearchRes.ok) {
        const ocSearchHtml = await ocSearchRes.text();
        // Match both normal and URL-encoded versions
        const ocMatch = ocSearchHtml.match(/opencritic\.com%2fgame%2f(\d+)%2f([a-zA-Z0-9-]+)/i) ||
                        ocSearchHtml.match(/opencritic\.com\/game\/(\d+)\/([a-zA-Z0-9-]+)/i);
        if (ocMatch) {
          opencriticUrl = `https://opencritic.com/game/${ocMatch[1]}/${ocMatch[2]}`;
          const ocRes = await fetch(opencriticUrl, { headers });
          if (ocRes.ok) {
            const ocHtml = await ocRes.text();
            
            // 4.1 Parse score from JSON-LD
            const ocLdMatches = ocHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
            if (ocLdMatches) {
              for (const ldBlock of ocLdMatches) {
                try {
                  const cleanJson = ldBlock.replace(/<\/?script[^>]*>/gi, '').trim();
                  const data = JSON.parse(cleanJson);
                  if (data['@type'] === 'VideoGame' && data.aggregateRating && data.aggregateRating.ratingValue !== undefined) {
                    opencriticScore = parseInt(data.aggregateRating.ratingValue);
                  }
                } catch (e) {}
              }
            }
            
            // Fallback for score to description
            if (!opencriticScore) {
              const ocOgDescMatch = ocHtml.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) ||
                                  ocHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
              if (ocOgDescMatch) {
                const desc = ocOgDescMatch[1];
                const scoreMatch = desc.match(/overall average score of (\d+)/i) || desc.match(/average score of (\d+)/i);
                if (scoreMatch) opencriticScore = parseInt(scoreMatch[1]);
              }
            }

            // 4.2 Parse recommended percentage
            const ocRecommendMatch = ocHtml.match(/recommended by (\d+)%/i);
            if (ocRecommendMatch) {
              opencriticPercent = parseInt(ocRecommendMatch[1]);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch OpenCritic rating:', e);
    }

    return { metascore, userscore, ignscore, url, ignUrl, opencriticScore, opencriticPercent, opencriticUrl };
  } catch (err) {
    console.error('Error fetching game ratings in IPC:', err);
    return null;
  }
});

ipcMain.handle('fetch-hltb-dlcs', async (event, gameId) => {
  const HLTB_BASE_URL = 'https://howlongtobeat.com';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': HLTB_BASE_URL,
    'Origin': HLTB_BASE_URL
  };

  try {
    const url = `${HLTB_BASE_URL}/game/${gameId}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch game details with status ${res.status}`);
    }
    const html = await res.text();
    const nextDataPattern = /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/;
    const match = html.match(nextDataPattern);
    if (!match) {
      throw new Error('Could not find __NEXT_DATA__ script in HTML');
    }
    const data = JSON.parse(match[1]);
    const gameObj = data.props?.pageProps?.game?.data;
    if (gameObj && gameObj.relationships) {
      const dlcs = gameObj.relationships.filter(r => r.game_type === 'dlc');
      return dlcs.map(d => d.game_name);
    }
    return [];
  } catch (e) {
    console.error('Error fetching game details/DLCs from HLTB:', e);
    return [];
  }
});

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
    autoUpdater.checkForUpdates().catch(err => {
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
  autoUpdater.checkForUpdates().then((result) => {
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


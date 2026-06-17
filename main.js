const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path  = require('path');
const { exec, spawn } = require('child_process');

let mainWindow    = null;
let tray          = null;
let processPoller = null;
let idleProcess   = null;

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720,
    minWidth: 800, minHeight: 560,
    frame: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide(); });
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

// ─── Polling (auto detect open/close) ────────────────────────────────────────
function startPoller() {
  if (processPoller) return;
  processPoller = setInterval(() => {
    exec('tasklist /fo csv /nh', { windowsHide: true }, (err, stdout) => {
      if (err || !mainWindow) return;
      const names = parseTasklist(stdout).map(p => p.name.toLowerCase());
      mainWindow.webContents.send('process-list', names);
    });
  }, 3000);
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
// One-shot scan (invokable)
ipcMain.handle('scan-processes', () =>
  new Promise(resolve => {
    exec('tasklist /fo csv /nh', { windowsHide: true }, (err, stdout) => {
      resolve(err ? [] : parseTasklist(stdout));
    });
  })
);

// Window controls
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('win-close',    () => mainWindow?.hide());
ipcMain.on('tray-update',  (_, label) => tray?.setToolTip(label || 'GameTime Tracker'));

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const img = nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('GameTime Tracker');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Aç',    click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() }
  ]));
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => { createWindow(); createTray(); startPoller(); startIdlePoller(); });
app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(processPoller);
  idleProcess?.kill();
  mainWindow?.removeAllListeners('close');
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

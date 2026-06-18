'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const GAMES_KEY    = 'gtt_games_v4';
const STATE_KEY    = 'gtt_state_v4';
const SETTINGS_KEY = 'gtt_settings_v4';
const isElectron   = !!window.electronAPI;
window.updateDownloadedState = false;
window.lastUpdateStatus = null;

const PALETTE = [
  'hsl(162,100%,48%)', 'hsl(200,100%,55%)', 'hsl(280,75%,62%)',
  'hsl(40,100%,52%)',  'hsl(0,80%,58%)',    'hsl(320,75%,60%)',
  'hsl(170,80%,48%)',  'hsl(55,95%,50%)',
];

// ─── State ───────────────────────────────────────────────────────────────────
let games        = [];   // [{id,name,exe,color,sessions:[]}]
let settings = {
  afkTimeout: 600,
  altTabTimeout: 120,
  autoSaveOnClose: true,
  startMinimized: false,
  closeToTray: true,
  lang: navigator.language.startsWith('tr') ? 'tr' : 'en'
};
let selectedId   = null; // currently viewed game id
let activeGameId = null; // game that has a running session
let activeState  = null; // {startTs, runningMs, isPaused, isAutoPaused, lastTickTs}

let timerInterval    = null;
let addTabActive     = 'manual';
let scanSelectedExe  = null;
let scanSelectedName = null;
let scanSelectedPath = null;
let lastGameFocusedMs = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');

function msToHMS(ms) {
  const t = Math.floor(ms/1000);
  return { h: Math.floor(t/3600), m: Math.floor((t%3600)/60), s: t%60 };
}
function fmtDur(ms) {
  const {h,m,s} = msToHMS(ms);
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(h>0) return `${h}${dict.dur_hour} ${pad(m)}${dict.dur_min}`;
  if(m>0) return `${m}${dict.dur_min} ${pad(s)}${dict.dur_sec}`;
  return `${s}${dict.dur_sec}`;
}
function fmtShort(ms) {
  const {h,m,s} = msToHMS(ms); return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function todayKey() { return new Date().toISOString().slice(0,10); }
function fmtDate(iso) {
  const d = new Date(iso), key = d.toISOString().slice(0,10);
  const lang = settings.lang || 'tr';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.tr;
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const time = d.toLocaleTimeString(locale, {hour:'2-digit',minute:'2-digit'});
  if(key===todayKey()) return `${dict.date_today} ${time}`;
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(key===yest) return `${dict.date_yesterday} ${time}`;
  return d.toLocaleDateString(locale, {day:'2-digit',month:'short'})+' '+time;
}
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s)  { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatProcessName(procName) {
  if (!procName) return '';
  let name = procName.replace(/\.exe$/i, '');
  name = name.replace(/[_-]+/g, ' ');
  return name.split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1))
             .join(' ');
}
function initials(name) { return name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'??'; }
function gameColor(idx) { return PALETTE[idx % PALETTE.length]; }
function gameById(id)   { return games.find(g=>g.id===id); }
function totalMs(g)     { return g.sessions.reduce((a,s)=>a+s.durationMs,0); }
function todayMs(g)     { const k=todayKey(); return g.sessions.filter(s=>s.dateKey===k).reduce((a,s)=>a+s.durationMs,0); }
function bestMs(g)      { return g.sessions.reduce((a,s)=>Math.max(a,s.durationMs),0); }

// ─── Polling Control sync ───────────────────────────────────────────────────
function updateWatchState() {
  if (isElectron) {
    const hasWatchableGames = games.some(g => g.exe);
    window.electronAPI.setWatchableGames(hasWatchableGames);
  }
}

// ─── Persist ─────────────────────────────────────────────────────────────────
async function saveGames() {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
  if (isElectron) {
    await window.electronAPI.storeWrite(GAMES_KEY, JSON.stringify(games));
  }
  updateWatchState();
}

async function loadGames() {
  if (isElectron) {
    try {
      const data = await window.electronAPI.storeRead(GAMES_KEY);
      if (data) {
        games = JSON.parse(data) || [];
        updateWatchState();
        return;
      }
    } catch (e) {
      console.error('Failed to load games from disk:', e);
    }
  }
  try {
    games = JSON.parse(localStorage.getItem(GAMES_KEY)) || [];
  } catch {
    games = [];
  }
  updateWatchState();
}

async function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (isElectron) {
    await window.electronAPI.storeWrite(SETTINGS_KEY, JSON.stringify(settings));
  }
}

async function loadSettings() {
  let s = null;
  if (isElectron) {
    try {
      const data = await window.electronAPI.storeRead(SETTINGS_KEY);
      if (data) {
        s = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load settings from disk:', e);
    }
  }
  if (!s) {
    try {
      s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch {}
  }
  if (s) {
    settings = { afkTimeout: 600, altTabTimeout: 120, autoSaveOnClose: true, startMinimized: false, closeToTray: true, lang: navigator.language.startsWith('tr') ? 'tr' : 'en', ...s };
  }
  if (isElectron) {
    window.electronAPI.setCloseToTray(settings.closeToTray !== false);
  }
}

async function saveState() {
  if (!activeState || !activeGameId) {
    localStorage.removeItem(STATE_KEY);
    if (isElectron) {
      await window.electronAPI.storeWrite(STATE_KEY, '');
    }
    return;
  }
  const stateStr = JSON.stringify({
    ...activeState, activeGameId,
    lastTickTs: (activeState.isPaused || activeState.isAutoPaused) ? null : Date.now()
  });
  localStorage.setItem(STATE_KEY, stateStr);
  if (isElectron) {
    await window.electronAPI.storeWrite(STATE_KEY, stateStr);
  }
}

async function loadState() {
  try {
    let d = null;
    if (isElectron) {
      try {
        const data = await window.electronAPI.storeRead(STATE_KEY);
        if (data) d = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load state from disk:', e);
      }
    }
    if (!d) {
      d = JSON.parse(localStorage.getItem(STATE_KEY));
    }
    if (!d) return false;
    
    // Discard state if the game no longer exists
    const gameExists = games.some(g => g.id === d.activeGameId);
    if (!gameExists) {
      localStorage.removeItem(STATE_KEY);
      if (isElectron) {
        await window.electronAPI.storeWrite(STATE_KEY, '');
      }
      return false;
    }
    
    activeGameId = d.activeGameId;
    activeState  = { startTs: d.startTs, runningMs: d.runningMs || 0, isPaused: d.isPaused || false, isAutoPaused: d.isAutoPaused || false };
    lastGameFocusedMs = Date.now();
    if (!activeState.isPaused && !activeState.isAutoPaused && d.lastTickTs) {
      activeState.runningMs += Date.now() - d.lastTickTs;
    }
    return true;
  } catch {
    return false;
  }
}

async function updateGameIcon(gameId, iconDataUrl, filePath) {
  const g = gameById(gameId);
  if (!g) return;
  g.icon = iconDataUrl;
  if (filePath) g.path = filePath;
  await saveGames();
}

async function resetGameIcon(gameId) {
  const g = gameById(gameId);
  if (!g) return;
  delete g.icon;
  g.iconAttempted = false;
  await saveGames();
}

async function renameGame(gameId, newName) {
  const g = gameById(gameId);
  if (!g) return;
  g.name = newName;
  await saveGames();
}

async function changeGameColor(gameId) {
  const g = gameById(gameId);
  if (!g) return;
  const currentIdx = PALETTE.indexOf(g.color);
  const nextIdx = (currentIdx + 1) % PALETTE.length;
  g.color = PALETTE[nextIdx];
  await saveGames();
}

async function clearGameSessions(gameId) {
  const g = gameById(gameId);
  if (!g) return;
  g.sessions = [];
  await saveGames();
}

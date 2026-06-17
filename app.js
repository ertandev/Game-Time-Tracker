'use strict';
// ─── Constants ───────────────────────────────────────────────────────────────
const GAMES_KEY    = 'gtt_games_v4';
const STATE_KEY    = 'gtt_state_v4';
const SETTINGS_KEY = 'gtt_settings_v4';
const isElectron   = !!window.electronAPI;

const TRANSLATIONS = {
  tr: {
    my_games: "OYUNLARIM",
    add_game: "Oyun Ekle",
    welcome_title: "Hoş Geldin!",
    welcome_sub: "Sol panelden bir oyun seç veya yeni oyun ekle.",
    welcome_add_btn: "＋ İlk Oyununu Ekle",
    settings_title: "Ayarlar",
    delete_game_title: "Oyunu Sil",
    clear: "Temizle",
    no_sessions: "Henüz oturum yok",
    cancel: "Vazgeç",
    save: "Kaydet",
    add: "Ekle",
    yes: "Evet",
    
    today: "Bugün",
    total: "Toplam",
    best: "En Uzun",
    session: "Oturum",
    session_history: "📋 Oturum Geçmişi",
    
    settings_modal_title: "⚙️ Global Ayarlar",
    settings_section_afk: "Oyun İçi AFK",
    settings_afk_label: "Oyun açıkken hiç input olmayınca ne kadar sonra dursun?",
    settings_afk_hint: "Grafik ayarlarında, menüde mouse/klavye yoksa. <strong>0 = kapalı</strong>",
    settings_section_alttab: "Alt-Tab Toleransı",
    settings_alttab_label: "Oyun arka planda kaç saniye kalabilsin?",
    settings_alttab_hint: "Bu süre geçince oyun alt-tab'dayken sayaç durur. <strong>0 = hiç durma</strong>",
    settings_section_autosave: "Otomatik Kaydetme",
    settings_autosave_label: "Oyun kapanınca oturumu otomatik kaydet ve bitir",
    settings_autosave_hint: "İşaretli ise, oyun kapandığında oturum sonlandırılır ve kaydedilir. İşaretsiz ise, oturum sadece duraklatılır.",
    settings_section_lang: "Dil / Language",
    
    add_game_modal_title: "🎮 Oyun Ekle",
    game_name_label: "Oyun Adı",
    game_name_placeholder: "Örn: Resident Evil 2",
    tab_manual: "✏️ Manuel EXE",
    tab_scan: "🔍 Şu An Açık",
    process_name_label: "Process Adı (.exe)",
    process_name_placeholder: "Örn: re2.exe, Minecraft.exe",
    scan_btn_idle: "Çalışan Processleri Tara",
    scan_btn_loading: "Taranıyor…",
    scan_btn_again: "Yeniden Tara",
    scan_hint: "Taramak için butona bas",
    scan_no_procs: "Hiç process bulunamadı",
    scan_error: "Hata oluştu",
    scan_electron_required: "Electron gerekli",
    
    confirm_title: "Emin misin?",
    confirm_delete_session_title: "Oturumu Sil",
    confirm_delete_session_text: "Bu oturum kalıcı olarak silinecek.",
    confirm_stop_session_title: "Oturumu Bitir",
    confirm_stop_session_text: "Oturumu kaydedip bitir? (DURATION)",
    confirm_clear_sessions_title: "Oturumları Temizle",
    confirm_clear_sessions_text: "COUNT oturum silinecek.",
    confirm_delete_game_title: "Oyunu Sil",
    confirm_delete_game_text: '"NAME" ve tüm oturumları silinecek.',
    
    status_ready: "Hazır",
    status_running: "Çalışıyor",
    status_paused: "Duraklatıldı",
    status_autopaused: "Hareketsizlik",
    
    badge_waiting: "Oturum bekleniyor",
    badge_paused: "⏸ Duraklatıldı",
    badge_running: "▶ Çalışıyor",
    
    exe_not_assigned: "EXE atanmamış",
    exe_watching: "EXE izleniyor",
    exe_manual_mode: "Manuel mod",
    exe_running: "NAME çalışıyor",
    exe_waiting: "Bekleniyor",
    exe_none: "EXE yok",
    
    inact_afk_tolerance: "AFK toleransı",
    inact_ingame_afk: "Oyun içi AFK",
    inact_alttab_time: "Alt-tab süresi",
    
    toast_afk_paused: "⏸ AFK — duraklatıldı",
    toast_returned_resumed: "▶ Oyuna döndün — devam ediyor",
    toast_ingame_afk_paused: "⏸ Oyun içi AFK — duraklatıldı",
    toast_alttab_paused: "⏸ Oyun arka planda — duraklatıldı",
    toast_session_saved: "✅ Oturum kaydedildi!",
    toast_game_opened: "🟢 NAME açıldı — sayaç başladı",
    toast_game_closed_saved: "🔴 NAME kapandı — oturum otomatik kaydedildi",
    toast_game_closed_paused: "🔴 NAME kapandı — duraklatıldı",
    toast_settings_saved: "✅ Ayarlar kaydedildi",
    toast_session_deleted: "🗑 Oturum silindi",
    toast_sessions_cleared: "🗑 Oturumlar temizlendi",
    toast_game_deleted: "🗑 Oyun silindi",
    toast_err_game_name: "⚠️ Oyun adı gir",
    toast_err_select_list: "⚠️ Listeden seç",
    toast_game_added: '✅ "NAME" eklendi',
    toast_prev_session_resumed: "🔄 Önceki oturum devam ettiriliyor…",
    
    dur_hour: "sa",
    dur_min: "dk",
    dur_sec: "sn",
    date_today: "Bugün",
    date_yesterday: "Dün",
    no_games_yet: "Henüz oyun yok",
    
    start: "Başlat",
    pause: "Duraklat",
    resume: "Devam",
    stop: "Bitir"
  },
  en: {
    my_games: "MY GAMES",
    add_game: "Add Game",
    welcome_title: "Welcome!",
    welcome_sub: "Select a game from the left panel or add a new game.",
    welcome_add_btn: "＋ Add Your First Game",
    settings_title: "Settings",
    delete_game_title: "Delete Game",
    clear: "Clear",
    no_sessions: "No sessions yet",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    yes: "Yes",
    
    today: "Today",
    total: "Total",
    best: "Longest",
    session: "Sessions",
    session_history: "📋 Session History",
    
    settings_modal_title: "⚙️ Global Settings",
    settings_section_afk: "In-Game AFK",
    settings_afk_label: "Pause after how much keyboard/mouse inactivity?",
    settings_afk_hint: "Triggers if idle in game menus/settings. <strong>0 = disabled</strong>",
    settings_section_alttab: "Alt-Tab Tolerance",
    settings_alttab_label: "How long can the game stay in background?",
    settings_alttab_hint: "After this, the timer pauses while the game is minimized. <strong>0 = never pause</strong>",
    settings_section_autosave: "Auto-Save",
    settings_autosave_label: "Auto-save and end session when game closes",
    settings_autosave_hint: "If checked, closing the game will end and save the session. If unchecked, the session is paused.",
    settings_section_lang: "Language / Dil",
    
    add_game_modal_title: "🎮 Add Game",
    game_name_label: "Game Name",
    game_name_placeholder: "e.g., Resident Evil 2",
    tab_manual: "✏️ Manual EXE",
    tab_scan: "🔍 Running Now",
    process_name_label: "Process Name (.exe)",
    process_name_placeholder: "e.g., re2.exe, Minecraft.exe",
    scan_btn_idle: "Scan Running Processes",
    scan_btn_loading: "Scanning…",
    scan_btn_again: "Scan Again",
    scan_hint: "Press button to scan",
    scan_no_procs: "No processes found",
    scan_error: "An error occurred",
    scan_electron_required: "Electron required",
    
    confirm_title: "Are you sure?",
    confirm_delete_session_title: "Delete Session",
    confirm_delete_session_text: "This session will be permanently deleted.",
    confirm_stop_session_title: "End Session",
    confirm_stop_session_text: "Save and end session? (DURATION)",
    confirm_clear_sessions_title: "Clear Sessions",
    confirm_clear_sessions_text: "COUNT sessions will be deleted.",
    confirm_delete_game_title: "Delete Game",
    confirm_delete_game_text: '"NAME" and all its sessions will be deleted.',
    
    status_ready: "Ready",
    status_running: "Running",
    status_paused: "Paused",
    status_autopaused: "Inactivity",
    
    badge_waiting: "Waiting for session",
    badge_paused: "⏸ Paused",
    badge_running: "▶ Running",
    
    exe_not_assigned: "EXE not assigned",
    exe_watching: "EXE watching",
    exe_manual_mode: "Manual mode",
    exe_running: "NAME is running",
    exe_waiting: "Waiting",
    exe_none: "No EXE",
    
    inact_afk_tolerance: "AFK tolerance",
    inact_ingame_afk: "In-game AFK",
    inact_alttab_time: "Alt-tab duration",
    
    toast_afk_paused: "⏸ AFK — paused",
    toast_returned_resumed: "▶ Returned to game — resumed",
    toast_ingame_afk_paused: "⏸ In-game AFK — paused",
    toast_alttab_paused: "⏸ Game in background — paused",
    toast_session_saved: "✅ Session saved!",
    toast_game_opened: "🟢 NAME launched — timer started",
    toast_game_closed_saved: "🔴 NAME closed — session saved automatically",
    toast_game_closed_paused: "🔴 NAME closed — paused",
    toast_settings_saved: "✅ Settings saved",
    toast_session_deleted: "🗑 Session deleted",
    toast_sessions_cleared: "🗑 Sessions cleared",
    toast_game_deleted: "🗑 Game deleted",
    toast_err_game_name: "⚠️ Please enter game name",
    toast_err_select_list: "⚠️ Please select from list",
    toast_game_added: '✅ "NAME" added',
    toast_prev_session_resumed: "🔄 Resuming previous session…",
    
    dur_hour: "h",
    dur_min: "m",
    dur_sec: "s",
    date_today: "Today",
    date_yesterday: "Yesterday",
    no_games_yet: "No games yet",
    
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop"
  }
};

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
  lang: navigator.language.startsWith('tr') ? 'tr' : 'en'
};
let selectedId   = null; // currently viewed game id
let activeGameId = null; // game that has a running session
let activeState  = null; // {startTs, runningMs, isPaused, isAutoPaused, lastTickTs}

let timerInterval    = null;
let addTabActive     = 'manual';
let scanSelectedExe  = null;
let scanSelectedName = null;
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

// ─── Persist ─────────────────────────────────────────────────────────────────
function saveGames()    { localStorage.setItem(GAMES_KEY, JSON.stringify(games)); }
function loadGames()    { try { games = JSON.parse(localStorage.getItem(GAMES_KEY))||[]; } catch { games=[]; } }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s) settings = { afkTimeout: 600, altTabTimeout: 120, autoSaveOnClose: true, lang: navigator.language.startsWith('tr') ? 'tr' : 'en', ...s };
  } catch {}
}
function saveState() {
  if(!activeState||!activeGameId) { localStorage.removeItem(STATE_KEY); return; }
  localStorage.setItem(STATE_KEY, JSON.stringify({
    ...activeState, activeGameId,
    lastTickTs: (activeState.isPaused||activeState.isAutoPaused) ? null : Date.now()
  }));
}
function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem(STATE_KEY));
    if(!d) return false;
    activeGameId = d.activeGameId;
    activeState  = { startTs:d.startTs, runningMs:d.runningMs||0, isPaused:d.isPaused||false, isAutoPaused:d.isAutoPaused||false };
    if(!activeState.isPaused && !activeState.isAutoPaused && d.lastTickTs)
      activeState.runningMs += Date.now()-d.lastTickTs;
    return true;
  } catch { return false; }
}

// ─── Timer Engine ─────────────────────────────────────────────────────────────
function startTicking() {
  if(timerInterval) return;
  activeState.lastTickTs = Date.now();
  timerInterval = setInterval(()=>{
    if(!activeState.isPaused && !activeState.isAutoPaused) {
      const now = Date.now();
      activeState.runningMs += now - activeState.lastTickTs;
      activeState.lastTickTs = now;
    }
    if(selectedId===activeGameId) renderTimer();
    renderSidebar();
    saveState();
  }, 500);
}
function stopTicking() { clearInterval(timerInterval); timerInterval=null; }

// ─── Inactivity bar ────────────────────────────────────────────────────────────
function clearInact() {
  $('inactWrap').classList.remove('on');
  $('inactBar').style.setProperty('--p', '100%');
}



function doAutoPause() {
  if (!activeState || activeState.isPaused || activeState.isAutoPaused) return;
  activeState.isAutoPaused = true; activeState.lastTickTs = null;
  clearInact(); renderControls(); renderTimer(); renderStatusPill();
  saveState();
}


// ─── Window Status Handler ─────────────────────────────────────────────────
// İki bağımsız kural:
//  1) Oyun foreground + N saniye input yok  → AFK pause
//  2) Oyun alt-tab'da N saniye              → alt-tab pause
function onWinStatus({ procName, idleMs }) {
  if (!activeState || activeState.isPaused) return;

  const g = gameById(activeGameId);
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;

  // ─ Manual mode (EXE yok) ─────────────────────────────────────────────
  if (!g || !g.exe) {
    const th = settings.afkTimeout * 1000;
    if (!th) { clearInact(); return; }
    if (idleMs >= th) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast(dict.toast_afk_paused); }
    } else {
      if (activeState.isAutoPaused) resumeSession();
      const pct = Math.max(0, 100 - (idleMs / th) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = dict.inact_afk_tolerance;
    }
    return;
  }

  // ─ EXE mode ──────────────────────────────────────────────────────────
  const exeBase = g.exe.toLowerCase().replace(/\.exe$/, '');
  const gameFg  = procName.includes(exeBase);

  if (gameFg) {
    // Oyun ön planda — alt-tab timer'ını sıfırla
    lastGameFocusedMs = Date.now();
    if (activeState.isAutoPaused) { resumeSession(); toast(dict.toast_returned_resumed); }

    // Kural 1: Oyun içi AFK (input yoksa)
    const afkTh = settings.afkTimeout * 1000;
    if (afkTh > 0 && idleMs >= afkTh) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast(dict.toast_ingame_afk_paused); }
    } else if (afkTh > 0) {
      const pct = Math.max(0, 100 - (idleMs / afkTh) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = dict.inact_ingame_afk;
    } else {
      clearInact();
    }
  } else {
    // Kural 2: Oyun arka planda (alt-tab)
    const altTh = settings.altTabTimeout * 1000;
    const outMs = Date.now() - lastGameFocusedMs;

    if (altTh > 0 && outMs >= altTh) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast(dict.toast_alttab_paused); }
    } else if (altTh > 0) {
      const pct = Math.max(0, 100 - (outMs / altTh) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = dict.inact_alttab_time;
    } else {
      clearInact();
    }
  }
}

if (isElectron) window.electronAPI.onWinStatus(onWinStatus);



// ─── Session Logic ────────────────────────────────────────────────────────────
function startSession(gameId) {
  if(activeState) return;
  const g = gameById(gameId); if(!g) return;
  activeGameId = gameId;
  activeState  = { startTs: new Date().toISOString(), runningMs:0, isPaused:false, isAutoPaused:false };
  lastGameFocusedMs = Date.now();
  startTicking();
  renderControls(); renderTimer(); renderStatusPill(); renderGameHeader();
  renderSidebar(); saveState();
}
function pauseSession() {
  if(!activeState||activeState.isPaused) return;
  activeState.isPaused=true; activeState.lastTickTs=null;
  clearInact(); renderControls(); renderTimer(); renderStatusPill(); saveState();
}
function resumeSession() {
  if(!activeState||(!activeState.isPaused&&!activeState.isAutoPaused)) return;
  activeState.isPaused=false; activeState.isAutoPaused=false; activeState.lastTickTs=Date.now();
  lastGameFocusedMs = Date.now();
  renderControls(); renderTimer(); renderStatusPill();
  saveState();
}
function stopSession() {
  if(!activeState) return;
  const g = gameById(activeGameId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  g.sessions.unshift({
    id: genId(), startTs: activeState.startTs, endTs: new Date().toISOString(),
    durationMs: activeState.runningMs, dateKey: todayKey()
  });
  saveGames();
  activeState=null; activeGameId=null;
  stopTicking(); clearInact();
  localStorage.removeItem(STATE_KEY);
  renderControls(); renderTimer(); renderStatusPill(); renderGameHeader();
  renderSessionList(); renderStats(); renderSidebar();
  toast(dict.toast_session_saved);
  if(isElectron) window.electronAPI.updateTray('GameTime Tracker');
}

// ─── EXE Process Monitor ──────────────────────────────────────────────────────
function onProcessList(procs) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  games.forEach(g => {
    if(!g.exe) return;
    const exeKey = g.exe.toLowerCase().replace(/\.exe$/,'');
    const running = procs.some(p => p.includes(exeKey));
    const myActive = activeGameId===g.id && activeState;
    if(running && !myActive && !activeState) {
      startSession(g.id);
      toast(dict.toast_game_opened.replace('NAME', g.name));
    } else if(!running && myActive) {
      if (settings.autoSaveOnClose) {
        stopSession();
        toast(dict.toast_game_closed_saved.replace('NAME', g.name));
      } else if (!activeState?.isPaused) {
        pauseSession();
        toast(dict.toast_game_closed_paused.replace('NAME', g.name));
      }
    }
  });
  // Update auto-status dot for selected game
  if(selectedId) {
    const g = gameById(selectedId);
    if(g&&g.exe) {
      const running = procs.some(p=>p.includes(g.exe.toLowerCase().replace(/\.exe$/,'')));
      const dot = $('autoStatusDot'), txt = $('autoStatusText');
      dot.className='auto-dot'+(running?' active':g.exe?' watching':'');
      txt.textContent=running?dict.exe_running.replace('NAME', g.name):g.exe?dict.exe_waiting:dict.exe_none;
    }
  }
}
if(isElectron) window.electronAPI.onProcessList(onProcessList);

// ─── Render ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const el = $('sidebarGames');
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(!games.length) { el.innerHTML=`<p style="font-size:.72rem;color:var(--muted);text-align:center;padding:14px 8px">${dict.no_games_yet}</p>`; return; }
  el.innerHTML = games.map((g,i)=>{
    const ms = totalMs(g) + (activeGameId===g.id&&activeState?activeState.runningMs:0);
    const running = activeGameId===g.id&&activeState&&!activeState.isPaused&&!activeState.isAutoPaused;
    return `<div class="sg-item${selectedId===g.id?' active':''}" data-gid="${g.id}" style="--game-color:${g.color}">
      <div class="sg-avatar">${initials(g.name)}</div>
      <div class="sg-info">
        <div class="sg-name">${esc(g.name)}</div>
        <div class="sg-total">${fmtShort(ms)}</div>
      </div>
      ${running?'<div class="sg-running"></div>':''}
    </div>`;
  }).join('');
  el.querySelectorAll('.sg-item').forEach(el=>el.addEventListener('click',()=>selectGame(el.dataset.gid)));
}

function selectGame(id) {
  selectedId = id;
  const g = gameById(id); if(!g) return;
  document.documentElement.style.setProperty('--game-color',g.color);
  $('welcomeScreen').classList.add('hidden');
  $('gamePage').classList.remove('hidden');
  renderGameHeader(); renderTimer(); renderControls(); renderStatusPill();
  renderStats(); renderSessionList();
  renderSidebar();
}

function renderGameHeader() {
  const g = gameById(selectedId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const av = $('gameAvatar');
  av.textContent = initials(g.name);
  av.style.background = g.color;
  av.style.boxShadow  = `0 0 16px ${g.color}66`;
  $('gameNameTitle').textContent = g.name;
  $('gameExeBadge').textContent  = g.exe || dict.exe_not_assigned;
  const dot = $('autoStatusDot'), txt = $('autoStatusText');
  dot.className='auto-dot'+(g.exe?' watching':'');
  txt.textContent = g.exe ? dict.exe_watching : dict.exe_manual_mode;
}

function renderTimer() {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(selectedId!==activeGameId||!activeState) {
    $('th').textContent=$('tm').textContent=$('ts').textContent='00';
    $('timerDisplay').className='timer-display';
    document.querySelectorAll('.blink').forEach(c=>c.classList.remove('on'));
    $('sessionBadge').textContent=dict.badge_waiting;
    return;
  }
  const {h,m,s}=msToHMS(activeState.runningMs);
  $('th').textContent=pad(h); $('tm').textContent=pad(m); $('ts').textContent=pad(s);
  const st = activeState.isPaused||activeState.isAutoPaused;
  $('timerDisplay').className='timer-display '+(st?'paused':'running');
  document.querySelectorAll('.blink').forEach(c=>c.classList.toggle('on',!st));
  $('sessionBadge').textContent = st ? dict.badge_paused : dict.badge_running;
  if(isElectron) window.electronAPI.updateTray(`▶ ${gameById(activeGameId)?.name} — ${fmtShort(activeState.runningMs)}`);
}

function renderStatusPill() {
  const dot=$('statusDot'), txt=$('statusText');
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  dot.className='status-dot';
  if(!activeState||selectedId!==activeGameId) {
    txt.textContent=dict.status_ready; return;
  }
  if(activeState.isAutoPaused) { dot.classList.add('autopaused'); txt.textContent=dict.status_autopaused; }
  else if(activeState.isPaused){ dot.classList.add('paused');     txt.textContent=dict.status_paused; }
  else                         { dot.classList.add('running');    txt.textContent=dict.status_running; }
}

function renderControls() {
  const isThisGame = selectedId===activeGameId&&activeState;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  $('startBtn').disabled = !!activeState;
  $('stopBtn').disabled  = !isThisGame;
  $('pauseBtn').disabled = !isThisGame;
  if(isThisGame && (activeState.isPaused||activeState.isAutoPaused)) {
    $('pauseBtn').innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> ${dict.resume}`;
  } else {
    $('pauseBtn').innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> ${dict.pause}`;
  }
}

function renderStats() {
  const g = gameById(selectedId); if(!g) return;
  const ms = totalMs(g)+(activeGameId===g.id&&activeState?activeState.runningMs:0);
  const tod= todayMs(g)+(activeGameId===g.id&&activeState&&g.sessions[0]?.dateKey===todayKey()?activeState.runningMs:0);
  const best=Math.max(bestMs(g), activeGameId===g.id&&activeState?activeState.runningMs:0);
  $('statToday').textContent = fmtDur(tod);
  $('statTotal').textContent = fmtDur(ms);
  $('statBest').textContent  = fmtDur(best);
  $('statCount').textContent = g.sessions.length+(activeState&&activeGameId===g.id?' (+1)':'');
}

function renderSessionList() {
  const g = gameById(selectedId); if(!g) return;
  const el=$('sessionList');
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(!g.sessions.length) {
    el.innerHTML=''; el.appendChild($('emptyState')); return;
  }
  el.innerHTML='';
  g.sessions.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='session-item';
    div.innerHTML=`
      <div class="s-num">#${g.sessions.length-i}</div>
      <div class="s-info">
        <div class="s-date">${fmtDate(s.startTs)}</div>
      </div>
      <div class="s-dur">${fmtDur(s.durationMs)}</div>
      <button class="s-del" data-sid="${s.id}" title="${settings.lang==='tr'?'Sil':'Delete'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/>
          <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
        </svg>
      </button>`;
    div.querySelector('.s-del').addEventListener('click',e=>{
      e.stopPropagation();
      confirm(dict.confirm_delete_session_title, dict.confirm_delete_session_text,()=>{
        const gi=games.findIndex(x=>x.id===selectedId);
        if(gi<0) return;
        games[gi].sessions=games[gi].sessions.filter(x=>x.id!==s.id);
        saveGames(); renderSessionList(); renderStats(); renderSidebar();
        toast(dict.toast_session_deleted);
      });
    });
    el.appendChild(div);
  });
}

// ─── Controls Events ─────────────────────────────────────────────────────────
$('startBtn').addEventListener('click',()=>{ if(selectedId) startSession(selectedId); });
$('pauseBtn').addEventListener('click',()=>{
  if(!activeState) return;
  if(activeState.isPaused||activeState.isAutoPaused) resumeSession(); else pauseSession();
});
$('stopBtn').addEventListener('click',()=>{
  if(!activeState) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  confirm(dict.confirm_stop_session_title, dict.confirm_stop_session_text.replace('DURATION', fmtDur(activeState.runningMs)), stopSession);
});

// ─── Global Settings Modal ──────────────────────────────────────────────────
const afkSliderEl  = $('afkSlider'),    afkValEl  = $('afkVal');
const altTabSliderEl = $('altTabSlider'), altTabValEl = $('altTabVal');

function fmtSec(v) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (v === 0) return settings.lang === 'tr' ? 'Kapalı' : 'Off';
  if (v < 60)  return `${v}${dict.dur_sec}`;
  const m = Math.floor(v/60), s = v%60;
  return s ? `${m}${dict.dur_min} ${s}${dict.dur_sec}` : `${m}${dict.dur_min}`;
}

function openSettingsModal() {
  afkSliderEl.value    = settings.afkTimeout;    afkValEl.textContent    = fmtSec(settings.afkTimeout);
  altTabSliderEl.value = settings.altTabTimeout; altTabValEl.textContent = fmtSec(settings.altTabTimeout);
  $('autoSaveCheckbox').checked = !!settings.autoSaveOnClose;
  $('settingsOverlay').classList.add('open');
}

afkSliderEl.addEventListener('input',    () => { afkValEl.textContent    = fmtSec(parseInt(afkSliderEl.value)); });
altTabSliderEl.addEventListener('input', () => { altTabValEl.textContent = fmtSec(parseInt(altTabSliderEl.value)); });

$('globalSettingsBtn').addEventListener('click', openSettingsModal);
$('settingsClose').addEventListener('click',  () => $('settingsOverlay').classList.remove('open'));
$('settingsCancel').addEventListener('click', () => $('settingsOverlay').classList.remove('open'));
$('settingsSave').addEventListener('click', () => {
  const oldLang = settings.lang;
  settings.afkTimeout    = parseInt(afkSliderEl.value);
  settings.altTabTimeout = parseInt(altTabSliderEl.value);
  settings.autoSaveOnClose = $('autoSaveCheckbox').checked;
  settings.lang = $('langSelect').value;
  saveSettings();
  $('settingsOverlay').classList.remove('open');
  applyLanguage();
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  toast(dict.toast_settings_saved);
  if (oldLang !== settings.lang) {
    renderSidebar();
    if (selectedId) {
      renderGameHeader();
      renderTimer();
      renderStatusPill();
      renderStats();
      renderSessionList();
    }
  }
});
$('settingsOverlay').addEventListener('click', e => { if (e.target === $('settingsOverlay')) $('settingsOverlay').classList.remove('open'); });

$('clearSessionsBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g||!g.sessions.length) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  confirm(dict.confirm_clear_sessions_title, dict.confirm_clear_sessions_text.replace('COUNT', g.sessions.length),()=>{
    g.sessions=[]; saveGames(); renderSessionList(); renderStats(); renderSidebar();
    toast(dict.toast_sessions_cleared);
  });
});

$('deleteGameBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  confirm(dict.confirm_delete_game_title, dict.confirm_delete_game_text.replace('NAME', g.name),()=>{
    if(activeGameId===selectedId) { stopSession(); }
    games=games.filter(x=>x.id!==selectedId);
    saveGames(); selectedId=null;
    $('gamePage').classList.add('hidden');
    $('welcomeScreen').classList.remove('hidden');
    renderSidebar(); toast(dict.toast_game_deleted);
  });
});

// ─── Add Game Modal ───────────────────────────────────────────────────────────
function openAddModal(e) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  $('newGameName').value=''; $('newGameExe').value='';
  scanSelectedExe=null; scanSelectedName=null;
  $('scanList').innerHTML=`<p class="scan-hint">${dict.scan_hint}</p>`;
  
  if (e && e.shiftKey) {
    switchTab('scan');
    setTimeout(() => {
      $('scanBtn').click();
    }, 150);
  } else {
    switchTab('manual');
  }

  $('addGameOverlay').classList.add('open');
  setTimeout(()=>$('newGameName').focus(),50);
}
function closeAddModal() { $('addGameOverlay').classList.remove('open'); }

$('addGameBtn').addEventListener('click', e => openAddModal(e));
$('welcomeAddBtn').addEventListener('click', e => openAddModal(e));
$('addGameClose').addEventListener('click',closeAddModal);
$('addGameCancel').addEventListener('click',closeAddModal);
$('addGameOverlay').addEventListener('click',e=>{ if(e.target===$('addGameOverlay')) closeAddModal(); });
$('newGameExe').addEventListener('input', () => {
  const exeVal = $('newGameExe').value.trim();
  if (exeVal && !$('newGameName').value.trim()) {
    $('newGameName').value = formatProcessName(exeVal);
  }
});

function switchTab(tab) {
  addTabActive=tab;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  $('paneManual').classList.toggle('hidden',tab!=='manual');
  $('paneScan').classList.toggle('hidden',tab!=='scan');
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));

$('addGameConfirm').addEventListener('click',()=>{
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const name=$('newGameName').value.trim();
  if(!name) { toast(dict.toast_err_game_name); return; }
  let exe='';
  if(addTabActive==='manual') {
    exe=$('newGameExe').value.trim();
    if(exe&&!exe.toLowerCase().endsWith('.exe')) exe+='.exe';
  } else {
    exe=scanSelectedExe||'';
    if(!scanSelectedExe&&!$('newGameName').value.trim()) { toast(dict.toast_err_select_list); return; }
  }
  const idx=games.length;
  const g={ id:genId(), name, exe:exe.toLowerCase(), color:gameColor(idx), sessions:[] };
  games.push(g); saveGames();
  closeAddModal(); renderSidebar();
  selectGame(g.id);
  toast(dict.toast_game_added.replace('NAME', name));
});

// ─── Scan ─────────────────────────────────────────────────────────────────────
$('scanBtn').addEventListener('click', async()=>{
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(!isElectron) { $('scanList').innerHTML=`<p class="scan-hint">${dict.scan_electron_required}</p>`; return; }
  const btn=$('scanBtn');
  btn.classList.add('loading'); btn.textContent=dict.scan_btn_loading;
  try {
    const procs = await window.electronAPI.scanProcesses();
    btn.classList.remove('loading');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ${dict.scan_btn_again}`;
    if(!procs.length) { $('scanList').innerHTML=`<p class="scan-hint">${dict.scan_no_procs}</p>`; return; }
    const el=$('scanList');
    el.innerHTML=procs.map(p=>`
      <div class="scan-item" data-exe="${esc(p.name)}" data-name="${esc(p.name.replace(/\.exe$/i,''))}">
        <span class="scan-item-name">${esc(p.name)}</span>
        <span class="scan-item-pid">PID ${p.pid}</span>
      </div>`).join('');
    el.querySelectorAll('.scan-item').forEach(item=>{
      item.addEventListener('click',()=>{
        el.querySelectorAll('.scan-item').forEach(x=>x.classList.remove('selected'));
        item.classList.add('selected');
        scanSelectedExe  = item.dataset.exe;
        scanSelectedName = item.dataset.name;
        $('newGameName').value = formatProcessName(scanSelectedExe);
      });
    });
  } catch(e) {
    btn.classList.remove('loading');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ${dict.scan_btn_again}`;
    $('scanList').innerHTML=`<p class="scan-hint">${dict.scan_error}</p>`;
  }
});

// ─── Confirm Modal ────────────────────────────────────────────────────────────
let confirmCb=null;
function confirm(title,text,cb) {
  $('confirmTitle').textContent=title; $('confirmText').textContent=text;
  confirmCb=cb; $('confirmOverlay').classList.add('open');
}
$('confirmOk').addEventListener('click',()=>{ if(confirmCb) confirmCb(); $('confirmOverlay').classList.remove('open'); confirmCb=null; });
$('confirmCancel').addEventListener('click',()=>{ $('confirmOverlay').classList.remove('open'); confirmCb=null; });
$('confirmOverlay').addEventListener('click',e=>{ if(e.target===$('confirmOverlay')) { $('confirmOverlay').classList.remove('open'); confirmCb=null; }});

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTO=null;
function toast(msg) {
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTO); toastTO=setTimeout(()=>el.classList.remove('show'),3000);
}

// ─── Titlebar ─────────────────────────────────────────────────────────────────
if(isElectron) {
  $('btnMin').addEventListener('click',()=>window.electronAPI.minimize());
  $('btnMax').addEventListener('click',()=>window.electronAPI.maximize());
  $('btnClose').addEventListener('click',()=>window.electronAPI.close());
}

function applyLanguage() {
  const lang = settings.lang || 'tr';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.tr;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.innerHTML = dict[key];
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (dict[key]) el.title = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) el.placeholder = dict[key];
  });

  const langSelect = $('langSelect');
  if (langSelect) langSelect.value = lang;

  const scanBtn = $('scanBtn');
  if (scanBtn && !scanBtn.classList.contains('loading')) {
    const isScanAgain = scanBtn.innerHTML.includes('Yeniden') || scanBtn.innerHTML.includes('Again');
    scanBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ` + (isScanAgain ? dict.scan_btn_again : dict.scan_btn_idle);
  }

  if (isElectron && window.electronAPI.setLanguage) {
    window.electronAPI.setLanguage(lang);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSettings(); loadGames();
  applyLanguage();

  const hadState = loadState();
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (hadState && activeGameId && gameById(activeGameId)) {
    startTicking();
    selectGame(activeGameId);
    toast(dict.toast_prev_session_resumed);
  } else {
    renderSidebar();
    if (games.length) selectGame(games[0].id);
  }
}
init();

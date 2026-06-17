'use strict';
// ─── Constants ───────────────────────────────────────────────────────────────
const GAMES_KEY    = 'gtt_games_v4';
const STATE_KEY    = 'gtt_state_v4';
const SETTINGS_KEY = 'gtt_settings_v4';
const isElectron   = !!window.electronAPI;

const PALETTE = [
  'hsl(162,100%,48%)', 'hsl(200,100%,55%)', 'hsl(280,75%,62%)',
  'hsl(40,100%,52%)',  'hsl(0,80%,58%)',    'hsl(320,75%,60%)',
  'hsl(170,80%,48%)',  'hsl(55,95%,50%)',
];

// ─── State ───────────────────────────────────────────────────────────────────
let games        = [];   // [{id,name,exe,color,sessions:[]}]
let settings = { afkTimeout: 600, altTabTimeout: 120, autoSaveOnClose: true };
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
  if(h>0) return `${h}sa ${pad(m)}dk`;
  if(m>0) return `${m}dk ${pad(s)}sn`;
  return `${s}sn`;
}
function fmtShort(ms) {
  const {h,m,s} = msToHMS(ms); return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function todayKey() { return new Date().toISOString().slice(0,10); }
function fmtDate(iso) {
  const d = new Date(iso), key = d.toISOString().slice(0,10);
  const time = d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  if(key===todayKey()) return `Bugün ${time}`;
  const yest = new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(key===yest) return `Dün ${time}`;
  return d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})+' '+time;
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
    if (s) settings = { afkTimeout: 600, altTabTimeout: 120, autoSaveOnClose: true, ...s };
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

  // ─ Manual mode (EXE yok) ─────────────────────────────────────────────
  if (!g || !g.exe) {
    const th = settings.afkTimeout * 1000;
    if (!th) { clearInact(); return; }
    if (idleMs >= th) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast('⏸ AFK — duraklatıldı'); }
    } else {
      if (activeState.isAutoPaused) resumeSession();
      const pct = Math.max(0, 100 - (idleMs / th) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = 'AFK toleransı';
    }
    return;
  }

  // ─ EXE mode ──────────────────────────────────────────────────────────
  const exeBase = g.exe.toLowerCase().replace(/\.exe$/, '');
  const gameFg  = procName.includes(exeBase);

  if (gameFg) {
    // Oyun ön planda — alt-tab timer'ını sıfırla
    lastGameFocusedMs = Date.now();
    if (activeState.isAutoPaused) { resumeSession(); toast('▶ Oyuna döndün — devam ediyor'); }

    // Kural 1: Oyun içi AFK (input yoksa)
    const afkTh = settings.afkTimeout * 1000;
    if (afkTh > 0 && idleMs >= afkTh) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast('⏸ Oyun içi AFK — duraklatıldı'); }
    } else if (afkTh > 0) {
      const pct = Math.max(0, 100 - (idleMs / afkTh) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = 'Oyun içi AFK';
    } else {
      clearInact();
    }
  } else {
    // Kural 2: Oyun arka planda (alt-tab)
    const altTh = settings.altTabTimeout * 1000;
    const outMs = Date.now() - lastGameFocusedMs;

    if (altTh > 0 && outMs >= altTh) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast('⏸ Oyun arka planda — duraklatıldı'); }
    } else if (altTh > 0) {
      const pct = Math.max(0, 100 - (outMs / altTh) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = 'Alt-tab süresi';
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
  toast('✅ Oturum kaydedildi!');
  if(isElectron) window.electronAPI.updateTray('GameTime Tracker');
}

// ─── EXE Process Monitor ──────────────────────────────────────────────────────
function onProcessList(procs) {
  games.forEach(g => {
    if(!g.exe) return;
    const exeKey = g.exe.toLowerCase().replace(/\.exe$/,'');
    const running = procs.some(p => p.includes(exeKey));
    const myActive = activeGameId===g.id && activeState;
    if(running && !myActive && !activeState) {
      startSession(g.id);
      toast(`🟢 ${g.name} açıldı — sayaç başladı`);
    } else if(!running && myActive) {
      if (settings.autoSaveOnClose) {
        stopSession();
        toast(`🔴 ${g.name} kapandı — oturum otomatik kaydedildi`);
      } else if (!activeState?.isPaused) {
        pauseSession();
        toast(`🔴 ${g.name} kapandı — duraklatıldı`);
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
      txt.textContent=running?`${g.name} çalışıyor`:g.exe?'Bekleniyor':'EXE yok';
    }
  }
}
if(isElectron) window.electronAPI.onProcessList(onProcessList);

// ─── Render ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const el = $('sidebarGames');
  if(!games.length) { el.innerHTML='<p style="font-size:.72rem;color:var(--muted);text-align:center;padding:14px 8px">Henüz oyun yok</p>'; return; }
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
  const av = $('gameAvatar');
  av.textContent = initials(g.name);
  av.style.background = g.color;
  av.style.boxShadow  = `0 0 16px ${g.color}66`;
  $('gameNameTitle').textContent = g.name;
  $('gameExeBadge').textContent  = g.exe || 'EXE atanmamış';
  const dot = $('autoStatusDot'), txt = $('autoStatusText');
  dot.className='auto-dot'+(g.exe?' watching':'');
  txt.textContent = g.exe ? 'EXE izleniyor' : 'Manuel mod';
}

function renderTimer() {
  if(selectedId!==activeGameId||!activeState) {
    $('th').textContent=$('tm').textContent=$('ts').textContent='00';
    $('timerDisplay').className='timer-display';
    document.querySelectorAll('.blink').forEach(c=>c.classList.remove('on'));
    $('sessionBadge').textContent='Oturum bekleniyor';
    return;
  }
  const {h,m,s}=msToHMS(activeState.runningMs);
  $('th').textContent=pad(h); $('tm').textContent=pad(m); $('ts').textContent=pad(s);
  const st = activeState.isPaused||activeState.isAutoPaused;
  $('timerDisplay').className='timer-display '+(st?'paused':'running');
  document.querySelectorAll('.blink').forEach(c=>c.classList.toggle('on',!st));
  $('sessionBadge').textContent = st ? '⏸ Duraklatıldı' : '▶ Çalışıyor';
  if(isElectron) window.electronAPI.updateTray(`▶ ${gameById(activeGameId)?.name} — ${fmtShort(activeState.runningMs)}`);
}

function renderStatusPill() {
  const dot=$('statusDot'), txt=$('statusText');
  dot.className='status-dot';
  if(!activeState||selectedId!==activeGameId) {
    txt.textContent='Hazır'; return;
  }
  if(activeState.isAutoPaused) { dot.classList.add('autopaused'); txt.textContent='Hareketsizlik'; }
  else if(activeState.isPaused){ dot.classList.add('paused');     txt.textContent='Duraklatıldı'; }
  else                         { dot.classList.add('running');    txt.textContent='Çalışıyor'; }
}

function renderControls() {
  const isThisGame = selectedId===activeGameId&&activeState;
  $('startBtn').disabled = !!activeState;
  $('stopBtn').disabled  = !isThisGame;
  $('pauseBtn').disabled = !isThisGame;
  if(isThisGame && (activeState.isPaused||activeState.isAutoPaused)) {
    $('pauseBtn').innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Devam`;
  } else {
    $('pauseBtn').innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Duraklat`;
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
        <div class="s-meta">${fmtShort(s.durationMs)}</div>
      </div>
      <div class="s-dur">${fmtDur(s.durationMs)}</div>
      <button class="s-del" data-sid="${s.id}" title="Sil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/>
          <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
        </svg>
      </button>`;
    div.querySelector('.s-del').addEventListener('click',e=>{
      e.stopPropagation();
      confirm('Oturumu Sil','Bu oturum kalıcı olarak silinecek.',()=>{
        const gi=games.findIndex(x=>x.id===selectedId);
        if(gi<0) return;
        games[gi].sessions=games[gi].sessions.filter(x=>x.id!==s.id);
        saveGames(); renderSessionList(); renderStats(); renderSidebar();
        toast('🗑 Oturum silindi');
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
  confirm('Oturumu Bitir',`Oturumu kaydedip bitir? (${fmtDur(activeState.runningMs)})`,stopSession);
});

// ─── Global Settings Modal ──────────────────────────────────────────────────
const afkSliderEl  = $('afkSlider'),    afkValEl  = $('afkVal');
const altTabSliderEl = $('altTabSlider'), altTabValEl = $('altTabVal');

function fmtSec(v) {
  if (v === 0) return 'Kapalı';
  if (v < 60)  return `${v}sn`;
  const m = Math.floor(v/60), s = v%60;
  return s ? `${m}dk ${s}sn` : `${m}dk`;
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
  settings.afkTimeout    = parseInt(afkSliderEl.value);
  settings.altTabTimeout = parseInt(altTabSliderEl.value);
  settings.autoSaveOnClose = $('autoSaveCheckbox').checked;
  saveSettings();
  $('settingsOverlay').classList.remove('open');
  toast('✅ Ayarlar kaydedildi');
});
$('settingsOverlay').addEventListener('click', e => { if (e.target === $('settingsOverlay')) $('settingsOverlay').classList.remove('open'); });

$('clearSessionsBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g||!g.sessions.length) return;
  confirm('Oturumları Temizle',`${g.sessions.length} oturum silinecek.`,()=>{
    g.sessions=[]; saveGames(); renderSessionList(); renderStats(); renderSidebar();
    toast('🗑 Oturumlar temizlendi');
  });
});

$('deleteGameBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g) return;
  confirm('Oyunu Sil',`"${g.name}" ve tüm oturumları silinecek.`,()=>{
    if(activeGameId===selectedId) { stopSession(); }
    games=games.filter(x=>x.id!==selectedId);
    saveGames(); selectedId=null;
    $('gamePage').classList.add('hidden');
    $('welcomeScreen').classList.remove('hidden');
    renderSidebar(); toast('🗑 Oyun silindi');
  });
});

// ─── Add Game Modal ───────────────────────────────────────────────────────────
function openAddModal() {
  $('newGameName').value=''; $('newGameExe').value='';
  scanSelectedExe=null; scanSelectedName=null;
  $('scanList').innerHTML='<p class="scan-hint">Taramak için butona bas</p>';
  switchTab('manual');
  $('addGameOverlay').classList.add('open');
  setTimeout(()=>$('newGameName').focus(),50);
}
function closeAddModal() { $('addGameOverlay').classList.remove('open'); }

$('addGameBtn').addEventListener('click',openAddModal);
$('welcomeAddBtn').addEventListener('click',openAddModal);
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
  const name=$('newGameName').value.trim();
  if(!name) { toast('⚠️ Oyun adı gir'); return; }
  let exe='';
  if(addTabActive==='manual') {
    exe=$('newGameExe').value.trim();
    if(exe&&!exe.toLowerCase().endsWith('.exe')) exe+='.exe';
  } else {
    exe=scanSelectedExe||'';
    if(!scanSelectedExe&&!$('newGameName').value.trim()) { toast('⚠️ Listeden seç'); return; }
  }
  const idx=games.length;
  const g={ id:genId(), name, exe:exe.toLowerCase(), color:gameColor(idx), sessions:[] };
  games.push(g); saveGames();
  closeAddModal(); renderSidebar();
  selectGame(g.id);
  toast(`✅ "${name}" eklendi`);
});

// ─── Scan ─────────────────────────────────────────────────────────────────────
$('scanBtn').addEventListener('click', async()=>{
  if(!isElectron) { $('scanList').innerHTML='<p class="scan-hint">Electron gerekli</p>'; return; }
  const btn=$('scanBtn');
  btn.classList.add('loading'); btn.textContent='Taranıyor…';
  try {
    const procs = await window.electronAPI.scanProcesses();
    btn.classList.remove('loading');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Yeniden Tara`;
    if(!procs.length) { $('scanList').innerHTML='<p class="scan-hint">Hiç process bulunamadı</p>'; return; }
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
    btn.classList.remove('loading'); btn.textContent='Tara';
    $('scanList').innerHTML='<p class="scan-hint">Hata oluştu</p>';
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

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSettings(); loadGames();

  const hadState = loadState();
  if (hadState && activeGameId && gameById(activeGameId)) {
    startTicking();
    selectGame(activeGameId);
    toast('🔄 Önceki oturum devam ettiriliyor…');
  } else {
    renderSidebar();
    if (games.length) selectGame(games[0].id);
  }
}
init();

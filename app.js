'use strict';

// ─── Controls Events ─────────────────────────────────────────────────────────
$('startBtn').addEventListener('click',()=>{ if(selectedId) startSession(selectedId); });
$('pauseBtn').addEventListener('click',()=>{
  if(!activeState) return;
  if(activeState.isPaused||activeState.isAutoPaused) resumeSession(); else pauseSession();
});
$('stopBtn').addEventListener('click',()=>{
  if(!activeState) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_stop_session_title, dict.confirm_stop_session_text.replace('DURATION', fmtDur(activeState.runningMs)), stopSession);
});

$('clearSessionsBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g||!g.sessions.length) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_clear_sessions_title, dict.confirm_clear_sessions_text.replace('COUNT', g.sessions.length),()=>{
    g.sessions=[]; saveGames(); renderSessionList(); renderStats(); renderSidebar();
    toast(dict.toast_sessions_cleared);
  });
});

$('deleteGameBtn').addEventListener('click',()=>{
  const g=gameById(selectedId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_delete_game_title, dict.confirm_delete_game_text.replace('NAME', g.name),()=>{
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
  scanSelectedExe=null; scanSelectedName=null; scanSelectedPath=null;
  
  const el = $('scanList');
  el.textContent = '';
  const p = document.createElement('p');
  p.className = 'scan-hint';
  p.dataset.i18n = 'scan_hint';
  p.textContent = dict.scan_hint;
  el.appendChild(p);
  
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
$('welcomeIcon').addEventListener('click', e => openAddModal(e));
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

$('addGameConfirm').addEventListener('click', async()=>{
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const name=$('newGameName').value.trim();
  if(!name) { toast(dict.toast_err_game_name); return; }
  let exe='';
  let iconDataUrl = null;
  if(addTabActive==='manual') {
    exe=$('newGameExe').value.trim();
    if(exe&&!exe.toLowerCase().endsWith('.exe')) exe+='.exe';
  } else {
    exe=scanSelectedExe||'';
    if(!scanSelectedExe&&!$('newGameName').value.trim()) { toast(dict.toast_err_select_list); return; }
    if(isElectron && scanSelectedPath) {
      iconDataUrl = await window.electronAPI.getFileIcon(scanSelectedPath);
    }
  }
  const idx=games.length;
  const g={ id:genId(), name, exe:exe.toLowerCase(), path:(addTabActive==='scan' && scanSelectedPath) ? scanSelectedPath : '', color:gameColor(idx), sessions:[], icon:iconDataUrl };
  games.push(g); saveGames();
  closeAddModal(); renderSidebar();
  selectGame(g.id);
  toast(dict.toast_game_added.replace('NAME', name));
});

// ─── Scan ─────────────────────────────────────────────────────────────────────
$('scanBtn').addEventListener('click', async()=>{
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if(!isElectron) {
    const el = $('scanList');
    el.textContent = '';
    const p = document.createElement('p');
    p.className = 'scan-hint';
    p.dataset.i18n = 'scan_electron_required';
    p.textContent = dict.scan_electron_required;
    el.appendChild(p);
    return;
  }
  const btn=$('scanBtn');
  btn.classList.add('loading'); btn.textContent=dict.scan_btn_loading;
  try {
    const procs = await window.electronAPI.scanProcesses();
    btn.classList.remove('loading');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ${dict.scan_btn_again}`;
    if(!procs.length) {
      const el = $('scanList');
      el.textContent = '';
      const p = document.createElement('p');
      p.className = 'scan-hint';
      p.dataset.i18n = 'scan_no_procs';
      p.textContent = dict.scan_no_procs;
      el.appendChild(p);
      return;
    }
    renderScanList(procs);
  } catch(e) {
    btn.classList.remove('loading');
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ${dict.scan_btn_again}`;
    const el = $('scanList');
    el.textContent = '';
    const p = document.createElement('p');
    p.className = 'scan-hint';
    p.dataset.i18n = 'scan_error';
    p.textContent = dict.scan_error;
    el.appendChild(p);
  }
});

// ─── Confirm Modal ────────────────────────────────────────────────────────────
let confirmCb=null;
function showConfirm(title,text,cb) {
  $('confirmTitle').textContent=title; $('confirmText').textContent=text;
  confirmCb=cb; $('confirmOverlay').classList.add('open');
}
$('confirmOk').addEventListener('click',()=>{ if(confirmCb) confirmCb(); $('confirmOverlay').classList.remove('open'); confirmCb=null; });
$('confirmCancel').addEventListener('click',()=>{ $('confirmOverlay').classList.remove('open'); confirmCb=null; });
$('confirmOverlay').addEventListener('click',e=>{ if(e.target===$('confirmOverlay')) { $('confirmOverlay').classList.remove('open'); confirmCb=null; }});

// ─── Prompt Modal ─────────────────────────────────────────────────────────────
let promptCb=null;
function showPrompt(title,label,val,cb) {
  $('promptTitle').textContent=title;
  $('promptLabel').textContent=label;
  $('promptInput').value=val||'';
  promptCb=cb;
  $('promptOverlay').classList.add('open');
  
  // Focus the input field and select all text for quick renaming
  setTimeout(() => {
    $('promptInput').focus();
    $('promptInput').select();
  }, 100);
}
$('promptOk').addEventListener('click',()=>{
  const val = $('promptInput').value.trim();
  if(promptCb) promptCb(val);
  $('promptOverlay').classList.remove('open');
  promptCb=null;
});
$('promptCancel').addEventListener('click',()=>{
  $('promptOverlay').classList.remove('open');
  promptCb=null;
});
$('promptOverlay').addEventListener('click',e=>{
  if(e.target===$('promptOverlay')) {
    $('promptOverlay').classList.remove('open');
    promptCb=null;
  }
});
// Allow Enter key to confirm inside prompt input
$('promptInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    $('promptOk').click();
  }
});

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
async function init() {
  await loadSettings();
  await loadGames();
  applyLanguage();

  // Sync startup settings on launch
  if (isElectron && settings.startMinimized !== undefined) {
    window.electronAPI.setStartup(settings.startMinimized, settings.startMinimized);
  }

  // Bind external links
  const githubLink = $('githubLink');
  if (githubLink) {
    githubLink.addEventListener('click', () => {
      const url = githubLink.dataset.url;
      if (isElectron && url) {
        window.electronAPI.openExternal(url);
      }
    });
  }

  const hadState = await loadState();
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (hadState && activeGameId && gameById(activeGameId)) {
    startTicking();
    selectGame(activeGameId);
    toast(dict.toast_prev_session_resumed);
  } else {
    renderSidebar();
    if (games.length) selectGame(games[0].id);
  }

  // Auto Updater event binding & click listener
  if (isElectron) {
    const btnCheckUpdate = $('btnCheckUpdate');

    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', () => {
        if (window.updateDownloadedState) {
          window.lastUpdateStatus = { status: 'installing' };
          renderUpdateStatus();
          window.electronAPI.quitAndInstall();
          return;
        }
        btnCheckUpdate.disabled = true;
        window.lastUpdateStatus = { status: 'checking' };
        renderUpdateStatus();
        window.electronAPI.checkForUpdates();
      });
    }

    window.electronAPI.onUpdateStatus((data) => {
      window.lastUpdateStatus = data;
      renderUpdateStatus();
    });
  }
}
init();

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
  const g=gameById(selectedId); if(!g) return;
  const target = sessionFilterTab;
  const sessionsToClear = g.sessions.filter(s => {
    if (target === 'overall') return true;
    if (target === null) return !s.dlcId;
    return s.dlcId === target;
  });
  if(!sessionsToClear.length) return;

  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_clear_sessions_title, dict.confirm_clear_sessions_text.replace('COUNT', sessionsToClear.length),()=>{
    g.sessions = g.sessions.filter(s => {
      if (target === 'overall') return false;
      if (target === null) return !!s.dlcId;
      return s.dlcId !== target;
    });
    saveGames(); renderSessionList(); renderStats(); renderSidebar();
    toast(dict.toast_sessions_cleared);
  });
});

$('selectSessionsBtn').addEventListener('click', () => {
  if (!selectedId) return;
  isMultiSelectMode = true;
  selectedSessionIds.clear();
  
  const editBar = $('sessionsEditBar');
  const selectBtn = $('selectSessionsBtn');
  
  if (editBar) editBar.classList.add('open');
  if (selectBtn) selectBtn.classList.add('hidden');
  
  updateSelectCount();
  renderSessionList();
});

$('cancelSelectBtn').addEventListener('click', () => {
  isMultiSelectMode = false;
  selectedSessionIds.clear();
  
  const editBar = $('sessionsEditBar');
  if (editBar) editBar.classList.remove('open');
  
  const selectBtn = $('selectSessionsBtn');
  if (selectBtn) selectBtn.classList.remove('hidden');
  
  updateSelectCount();
  renderSessionList();
});

$('selectAllSessionsCheckbox').addEventListener('change', (e) => {
  const g = gameById(selectedId);
  if (!g) return;
  
  const target = sessionFilterTab;
  const sessionsToRender = g.sessions.filter(s => {
    if (target === 'overall') return true;
    if (target === null) return !s.dlcId;
    return s.dlcId === target;
  });
  
  if (e.target.checked) {
    sessionsToRender.forEach(s => selectedSessionIds.add(s.id));
  } else {
    sessionsToRender.forEach(s => selectedSessionIds.delete(s.id));
  }
  
  renderSessionList();
  updateSelectCount();
});

$('deleteSelectedSessionsBtn').addEventListener('click', () => {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (selectedSessionIds.size === 0) {
    toast(dict.toast_err_no_selected);
    return;
  }
  
  showConfirm(
    dict.confirm_delete_selected_title,
    dict.confirm_delete_selected_text.replace('COUNT', selectedSessionIds.size),
    () => {
      const g = gameById(selectedId);
      if (!g) return;
      
      g.sessions = g.sessions.filter(s => !selectedSessionIds.has(s.id));
      saveGames();
      
      isMultiSelectMode = false;
      selectedSessionIds.clear();
      
      const editBar = $('sessionsEditBar');
      if (editBar) editBar.classList.remove('open');
      
      const selectBtn = $('selectSessionsBtn');
      if (selectBtn) selectBtn.classList.remove('hidden');
      
      updateSelectCount();
      renderSessionList();
      renderStats();
      renderSidebar();
      toast(dict.toast_selected_deleted);
    }
  );
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

$('addDlcBtn').addEventListener('click', () => {
  if (!selectedId) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showPrompt(dict.dlc_add_prompt_title, dict.dlc_add_prompt_label, '', async (name) => {
    if (!name || !name.trim()) {
      toast(dict.toast_err_dlc_name);
      return;
    }
    await addDlc(selectedId, name.trim());
    renderDlcSection();
    toast(dict.toast_dlc_added.replace('NAME', name.trim()));
  });
});

$('selectDlcsBtn').addEventListener('click', () => {
  if (!selectedId) return;
  
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (activeGameId === selectedId && activeState) {
    toast(settings.lang === 'tr' ? 'Oturum çalışırken DLC seçilemez/silinemez!' : 'Cannot select/delete DLCs during a running session!');
    return;
  }

  isDlcMultiSelectMode = true;
  selectedDlcIds.clear();
  
  const editBar = $('dlcsEditBar');
  const selectBtn = $('selectDlcsBtn');
  
  if (editBar) editBar.classList.add('open');
  if (selectBtn) selectBtn.classList.add('hidden');
  
  updateDlcSelectCount();
  renderDlcSection();
});

$('cancelDlcSelectBtn').addEventListener('click', () => {
  isDlcMultiSelectMode = false;
  selectedDlcIds.clear();
  
  const editBar = $('dlcsEditBar');
  if (editBar) editBar.classList.remove('open');
  
  const selectBtn = $('selectDlcsBtn');
  if (selectBtn) selectBtn.classList.remove('hidden');
  
  updateDlcSelectCount();
  renderDlcSection();
});

$('selectAllDlcsCheckbox').addEventListener('change', (e) => {
  const g = gameById(selectedId);
  if (!g) return;
  
  if (e.target.checked) {
    if (g.dlcs) {
      g.dlcs.forEach(d => selectedDlcIds.add(d.id));
    }
  } else {
    selectedDlcIds.clear();
  }
  
  renderDlcSection();
  updateDlcSelectCount();
});

$('deleteSelectedDlcsBtn').addEventListener('click', () => {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (selectedDlcIds.size === 0) {
    toast(dict.toast_err_no_dlc_selected);
    return;
  }
  
  if (activeGameId === selectedId && activeState) {
    toast(settings.lang === 'tr' ? 'Oturum çalışırken DLC silinemez!' : 'Cannot delete DLCs during a running session!');
    return;
  }

  showConfirm(
    dict.confirm_delete_selected_dlc_title,
    dict.confirm_delete_selected_dlc_text.replace('COUNT', selectedDlcIds.size),
    async () => {
      await deleteDlcs(selectedId, Array.from(selectedDlcIds));
      
      isDlcMultiSelectMode = false;
      selectedDlcIds.clear();
      
      const editBar = $('dlcsEditBar');
      if (editBar) editBar.classList.remove('open');
      
      const selectBtn = $('selectDlcsBtn');
      if (selectBtn) selectBtn.classList.remove('hidden');
      
      updateDlcSelectCount();
      renderDlcSection();
      renderSessionList();
      renderStats();
      renderSidebar();
      toast(dict.toast_selected_dlc_deleted);
    }
  );
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

function openHltbModal() {
  const g = gameById(selectedId); if(!g) return;
  $('hltbSearchInput').value = g.name;
  $('hltbResultList').textContent = '';
  $('hltbOverlay').classList.add('open');
  setTimeout(() => $('hltbSearchInput').focus(), 50);
}
function closeHltbModal() {
  $('hltbOverlay').classList.remove('open');
}
window.closeHltbModal = closeHltbModal;

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
  
  if (isElectron) {
    try {
      const hltbResults = await window.electronAPI.fetchHltbTime(name);
      if (hltbResults && hltbResults.length > 0) {
        const match = hltbResults[0];
        g.hltbData = {
          id: match.game_id,
          name: match.game_name,
          main: match.comp_main,
          plus: match.comp_plus,
          completionist: match.comp_100,
          image: match.game_image
        };

        try {
          const dlcNames = await window.electronAPI.fetchHltbDlcs(match.game_id);
          if (dlcNames && dlcNames.length > 0) {
            if (!g.dlcs) g.dlcs = [];
            dlcNames.forEach(dlcName => {
              g.dlcs.push({
                id: genId(),
                name: dlcName.trim(),
                createdTs: new Date().toISOString()
              });
            });
          }
        } catch (de) {
          console.error('Failed to auto fetch HLTB DLCs on addition:', de);
        }
      }
    } catch (e) {
      console.error('Failed to auto-fetch HLTB times on game addition:', e);
    }
  }

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

// ─── HowLongToBeat Events ──────────────────────────────────────────────────────
$('hltbLinkBtn').addEventListener('click', openHltbModal);
$('hltbUnlinkBtn').addEventListener('click', () => {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(
    settings.lang === 'tr' ? 'Eşleşmeyi Kaldır' : 'Unlink Game',
    settings.lang === 'tr' ? 'HowLongToBeat eşleşmesi kaldırılacak. Emin misiniz?' : 'HowLongToBeat link will be removed. Are you sure?',
    async () => {
      await unlinkGameHltbData(selectedId);
      renderHltbSection();
      renderSidebar();
      renderGameHeader();
      toast(dict.toast_hltb_unlinked);
    }
  );
});

$('hltbClose').addEventListener('click', closeHltbModal);
$('hltbCancel').addEventListener('click', closeHltbModal);
$('hltbOverlay').addEventListener('click', e => {
  if (e.target === $('hltbOverlay')) closeHltbModal();
});

async function handleHltbSearch() {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const query = $('hltbSearchInput').value.trim();
  if (!query) return;

  const btn = $('hltbSearchBtn');
  btn.disabled = true;
  btn.textContent = dict.hltb_fetching;
  
  const el = $('hltbResultList');
  el.innerHTML = `<p class="scan-hint">${dict.hltb_fetching}</p>`;

  try {
    const results = await window.electronAPI.fetchHltbTime(query);
    btn.disabled = false;
    btn.textContent = dict.hltb_button_search;
    renderHltbSearchResults(results);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = dict.hltb_button_search;
    el.innerHTML = `<p class="scan-hint">${dict.toast_hltb_fetch_failed}</p>`;
  }
}

$('hltbSearchBtn').addEventListener('click', handleHltbSearch);
$('hltbSearchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    handleHltbSearch();
  }
});

// ─── Custom Tooltip Controller ────────────────────────────────────────────────
let tooltipEl = null;

function initTooltip() {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'custom-tooltip';
  document.body.appendChild(tooltipEl);
  
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip-key], [data-tooltip], [title], [data-original-title]');
    if (!target) return;
    
    // If the target has a native title, swap it to prevent the browser's default tooltip
    if (target.hasAttribute('title')) {
      target.dataset.originalTitle = target.getAttribute('title');
      target.removeAttribute('title');
    }
    
    const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
    let text = '';
    
    if (target.dataset.tooltipKey) {
      text = dict[target.dataset.tooltipKey] || target.dataset.tooltipKey;
    } else if (target.dataset.tooltip) {
      text = dict[target.dataset.tooltip] || target.dataset.tooltip;
    } else if (target.dataset.originalTitle) {
      text = dict[target.dataset.originalTitle] || target.dataset.originalTitle;
    }
    
    if (!text) return;
    
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');
    
    // Position calculations centered above the target element
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.top - tooltipRect.height - 8;
    
    // Boundaries check
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
      // If tooltip goes off-screen at the top, position it below the element instead
      top = rect.bottom + 8;
    }
    
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  });
  
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip-key], [data-tooltip], [data-original-title]');
    if (!target) return;
    
    // Only handle if mouse actually leaves the target (not moving to its child)
    if (e.relatedTarget && target.contains(e.relatedTarget)) return;
    
    if (target.dataset.originalTitle) {
      target.setAttribute('title', target.dataset.originalTitle);
      delete target.dataset.originalTitle;
    }
    
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  });
  
  // Hide tooltip on mouse clicks to prevent tooltip staying visible on button click
  document.addEventListener('click', () => {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadSettings();
  await loadGames();
  applyLanguage();
  initTooltip();
  
  // Fetch and display dynamic app version in settings
  if (isElectron) {
    try {
      const version = await window.electronAPI.getAppVersion();
      if (version) {
        const versionEl = $('appVersion');
        if (versionEl) versionEl.textContent = version;
      }
    } catch (e) {
      console.error('Failed to get app version:', e);
    }
  }

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

'use strict';

// ─── EXE Process Monitor ──────────────────────────────────────────────────────
function onProcessList(procs) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  games.forEach(g => {
    if(!g.exe) return;
    const exeKey = g.exe.toLowerCase().replace(/\.exe$/,'');
    const running = procs.some(p => p.includes(exeKey));
    const myActive = activeGameId===g.id && activeState;
    if (running && !g.icon && !g.iconAttempted) {
      checkAndFetchIcon(g);
    }
    if (running && myActive) {
      activeState.detected = true;
    }
    
    if(running && !myActive && !activeState) {
      startSession(g.id);
      if (activeState) activeState.detected = true;
      toast(dict.toast_game_opened.replace('NAME', g.name));
    } else if(!running && myActive) {
      // Eger oyun bu oturum boyunca en az bir kere calisir durumda algılandıysa tolerans suresini gec,
      // kapatildigi an (veya force-close edildigi an) sayaci aninda durdur/kaydet.
      if (!activeState.detected) {
        const elapsedMs = Date.now() - new Date(activeState.startTs).getTime();
        if (elapsedMs < 30000) return;
      }

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
  el.textContent = ''; // clear existing
  if(!games.length) {
    const p = document.createElement('p');
    p.style.fontSize = '.72rem';
    p.style.color = 'var(--muted)';
    p.style.textAlign = 'center';
    p.style.padding = '14px 8px';
    p.textContent = dict.no_games_yet;
    el.appendChild(p);
    return;
  }
  
  games.forEach((g, i) => {
    const ms = totalMs(g) + (activeGameId===g.id&&activeState?activeState.runningMs:0);
    const running = activeGameId===g.id&&activeState&&!activeState.isPaused&&!activeState.isAutoPaused;
    
    const item = document.createElement('div');
    item.className = `sg-item${selectedId===g.id?' active':''}`;
    item.dataset.gid = g.id;
    item.style.setProperty('--game-color', g.color);
    
    if (g.icon) {
      const img = document.createElement('img');
      img.src = g.icon;
      img.className = 'sg-avatar-img';
      img.alt = g.name;
      item.appendChild(img);
    } else {
      const avatar = document.createElement('div');
      avatar.className = 'sg-avatar';
      avatar.textContent = initials(g.name);
      item.appendChild(avatar);
    }
    
    const info = document.createElement('div');
    info.className = 'sg-info';
    
    const name = document.createElement('div');
    name.className = 'sg-name';
    name.textContent = g.name;
    
    const total = document.createElement('div');
    total.className = 'sg-total';
    total.textContent = fmtShort(ms);
    
    info.appendChild(name);
    info.appendChild(total);
    item.appendChild(info);
    
    if (running) {
      const runningDot = document.createElement('div');
      runningDot.className = 'sg-running';
      item.appendChild(runningDot);
    }
    
    item.addEventListener('click', () => selectGame(g.id));
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (isElectron) {
        showCustomContextMenu(e, g.id);
      }
    });
    el.appendChild(item);
  });
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
  av.textContent = '';
  if (g.icon) {
    const img = document.createElement('img');
    img.src = g.icon;
    img.className = 'game-avatar-img';
    img.alt = g.name;
    av.appendChild(img);
  } else {
    av.textContent = initials(g.name);
  }
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
  el.textContent = '';
  if(!g.sessions.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.id = 'emptyState';
    
    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'empty-icon-wrapper glass-gray';
    emptyIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
      </svg>`;
    
    const p = document.createElement('p');
    p.dataset.i18n = 'no_sessions';
    p.textContent = dict.no_sessions;
    
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(p);
    el.appendChild(emptyState);
    return;
  }
  
  g.sessions.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='session-item';
    
    const num = document.createElement('div');
    num.className = 's-num';
    num.textContent = `#${g.sessions.length-i}`;
    
    const info = document.createElement('div');
    info.className = 's-info';
    
    const date = document.createElement('div');
    date.className = 's-date';
    date.textContent = fmtDate(s.startTs);
    info.appendChild(date);
    
    const dur = document.createElement('div');
    dur.className = 's-dur';
    dur.textContent = fmtDur(s.durationMs);
    
    const del = document.createElement('button');
    del.className = 's-del';
    del.dataset.sid = s.id;
    del.title = settings.lang==='tr'?'Sil':'Delete';
    del.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/>
        <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
      </svg>`;
    
    del.addEventListener('click', e=>{
      e.stopPropagation();
      showConfirm(dict.confirm_delete_session_title, dict.confirm_delete_session_text, ()=>{
        const gi=games.findIndex(x=>x.id===selectedId);
        if(gi<0) return;
        games[gi].sessions=games[gi].sessions.filter(x=>x.id!==s.id);
        saveGames(); renderSessionList(); renderStats(); renderSidebar();
        toast(dict.toast_session_deleted);
      });
    });
    
    div.appendChild(num);
    div.appendChild(info);
    div.appendChild(dur);
    div.appendChild(del);
    el.appendChild(div);
  });
}

function renderScanList(procs) {
  const el = $('scanList');
  el.textContent = '';
  procs.forEach(p => {
    const item = document.createElement('div');
    item.className = 'scan-item';
    item.dataset.exe = p.name;
    item.dataset.name = p.name.replace(/\.exe$/i, '');
    item.dataset.path = p.path || '';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'scan-item-name';
    nameSpan.textContent = p.name;
    
    const pidSpan = document.createElement('span');
    pidSpan.className = 'scan-item-pid';
    pidSpan.textContent = `PID ${p.pid}`;
    
    item.appendChild(nameSpan);
    item.appendChild(pidSpan);
    
    item.addEventListener('click', () => {
      el.querySelectorAll('.scan-item').forEach(x => x.classList.remove('selected'));
      item.classList.add('selected');
      scanSelectedExe  = item.dataset.exe;
      scanSelectedName = item.dataset.name;
      scanSelectedPath = item.dataset.path;
      $('newGameName').value = formatProcessName(scanSelectedExe);
    });
    
    el.appendChild(item);
  });
}

// ─── Custom Context Menu ──────────────────────────────────────────────────────
let currentContextMenuGameId = null;

function showCustomContextMenu(e, gameId) {
  currentContextMenuGameId = gameId;
  const menu = $('gameContextMenu');
  if (!menu) return;

  menu.classList.remove('hidden');
  
  // Position menu
  const menuWidth = 245;
  const menuHeight = 330;
  let left = e.clientX;
  let top = e.clientY;
  
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
  }
  
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  
  // Animation
  menu.style.opacity = '0';
  menu.style.transform = 'scale(0.95)';
  menu.style.pointerEvents = 'none';
  
  menu.offsetHeight; // trigger reflow
  
  menu.style.transition = 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.12s cubic-bezier(0.16, 1, 0.3, 1)';
  menu.style.opacity = '1';
  menu.style.transform = 'scale(1)';
  menu.style.pointerEvents = 'auto';
  
  e.stopPropagation();
}

function hideCustomContextMenu() {
  const menu = $('gameContextMenu');
  if (menu && !menu.classList.contains('hidden')) {
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.95)';
    menu.style.pointerEvents = 'none';
    setTimeout(() => {
      if (menu.style.opacity === '0') {
        menu.classList.add('hidden');
      }
    }, 120);
  }
}

// Bind custom context menu click actions
if (isElectron) {
  const menuEl = $('gameContextMenu');
  if (menuEl) {
    menuEl.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const gameId = currentContextMenuGameId;
        hideCustomContextMenu();
        if (!gameId) return;
        
        const g = gameById(gameId);
        if (!g) return;
        
        switch (action) {
          case 'launch':
            await handleLaunchGame(g);
            break;
          case 'open-location':
            await handleOpenLocation(g);
            break;
          case 'change-icon':
            await handleChangeIcon(g);
            break;
          case 'reset-icon':
            await handleResetIcon(g);
            break;
          case 'change-color':
            await handleChangeColor(g);
            break;
          case 'rename':
            await handleRenameGame(g);
            break;
          case 'clear-sessions':
            await handleClearSessions(g);
            break;
          case 'delete':
            await handleDeleteGame(g);
            break;
        }
      });
    });
    
    window.addEventListener('click', hideCustomContextMenu);
    window.addEventListener('blur', hideCustomContextMenu);
    window.addEventListener('resize', hideCustomContextMenu);
  }
}

async function handleLaunchGame(g) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (activeGameId === g.id) {
    toast(settings.lang === 'tr' ? 'Oyun zaten çalışıyor!' : 'Game is already running!');
    return;
  }
  let exePath = g.path;
  if (!exePath && g.exe) {
    exePath = await window.electronAPI.findProcessPath(g.exe);
    if (exePath) {
      g.path = exePath;
      await saveGames();
    }
  }
  if (!exePath) {
    toast(settings.lang === 'tr' ? 'Lütfen oyunun .exe dosyasını seçin' : 'Please select the game .exe file');
    const selectedPath = await window.electronAPI.selectExePath();
    if (selectedPath) {
      g.path = selectedPath;
      await saveGames();
      exePath = selectedPath;
    }
  }
  if (exePath) {
    const ok = await window.electronAPI.launchGame(exePath);
    if (ok) {
      toast(dict.toast_game_opened.replace('NAME', g.name));
    } else {
      toast(settings.lang === 'tr' ? 'Oyun başlatılamadı' : 'Failed to launch game');
    }
  }
}

async function handleOpenLocation(g) {
  let exePath = g.path;
  if (!exePath && g.exe) {
    exePath = await window.electronAPI.findProcessPath(g.exe);
    if (exePath) {
      g.path = exePath;
      await saveGames();
    }
  }
  if (!exePath) {
    toast(settings.lang === 'tr' ? 'Oyun dosya yolu bulunamadı' : 'Game file path not found');
    return;
  }
  const ok = await window.electronAPI.openFileLocation(exePath);
  if (!ok) {
    toast(settings.lang === 'tr' ? 'Klasör açılamadı' : 'Failed to open folder');
  }
}

async function handleChangeIcon(g) {
  const result = await window.electronAPI.selectCustomIcon();
  if (result && result.icon) {
    await updateGameIcon(g.id, result.icon, result.path);
    renderSidebar();
    if (selectedId === g.id) {
      renderGameHeader();
    }
    toast(settings.lang === 'tr' ? 'Simge güncellendi' : 'Icon updated');
  }
}

async function handleResetIcon(g) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  let success = false;
  let exePath = g.path;
  
  if (!exePath && g.exe) {
    exePath = await window.electronAPI.findProcessPath(g.exe);
    if (exePath) {
      g.path = exePath;
      await saveGames();
    }
  }
  
  if (exePath && isElectron) {
    const iconDataUrl = await window.electronAPI.getFileIcon(exePath);
    if (iconDataUrl) {
      g.icon = iconDataUrl;
      g.iconAttempted = true;
      await saveGames();
      success = true;
    }
  }
  
  if (!success) {
    await resetGameIcon(g.id);
  }
  
  renderSidebar();
  if (selectedId === g.id) {
    renderGameHeader();
  }
  
  toast(settings.lang === 'tr' ? 'Simge orijinal sistem simgesine sıfırlandı' : 'Icon reset to system icon');
}

async function handleChangeColor(g) {
  await changeGameColor(g.id);
  renderSidebar();
  if (selectedId === g.id) {
    renderGameHeader();
    document.documentElement.style.setProperty('--game-color', g.color);
  }
}

async function handleRenameGame(g) {
  const title = settings.lang === 'tr' ? 'Oyunu Yeniden Adlandır' : 'Rename Game';
  const label = settings.lang === 'tr' ? 'Yeni adı girin:' : 'Enter new name:';
  
  showPrompt(title, label, g.name, async (newName) => {
    if (newName && newName.trim()) {
      await renameGame(g.id, newName.trim());
      renderSidebar();
      if (selectedId === g.id) {
        renderGameHeader();
      }
      toast(settings.lang === 'tr' ? 'Oyun yeniden adlandırıldı' : 'Game renamed');
    }
  });
}

async function handleClearSessions(g) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_clear_sessions_title, dict.confirm_clear_sessions_text.replace('COUNT', g.sessions.length), async () => {
    await clearGameSessions(g.id);
    renderSessionList();
    renderStats();
    renderSidebar();
    toast(dict.toast_sessions_cleared);
  });
}

async function handleDeleteGame(g) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_delete_game_title, dict.confirm_delete_game_text.replace('NAME', g.name), async () => {
    if (activeGameId === g.id) {
      stopSession();
    }
    games = games.filter(x => x.id !== g.id);
    await saveGames();
    if (selectedId === g.id) {
      selectedId = null;
      $('gamePage').classList.add('hidden');
      $('welcomeScreen').classList.remove('hidden');
    }
    renderSidebar();
    toast(dict.toast_game_deleted);
  });
}

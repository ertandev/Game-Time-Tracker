'use strict';

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

  // Manuel başlatılan session (detected=false): process eşleşmesi güvenilmez
  // olabilir (korsan/crack oyunlar vs.), sadece AFK kontrolü yap.
  // Otomatik algılanan session (detected=true): hem AFK hem alt-tab kontrolü yap.
  const isAutoSession = !!activeState.detected || (g && !!g.path);

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
  } else if (!isAutoSession) {
    // Manuel session + foreground eşleşmiyor → sadece AFK kontrolü
    // (korsan/crack oyunlarda process adı farklı olabilir)
    if (activeState.isAutoPaused && idleMs < (settings.afkTimeout * 1000 || Infinity)) {
      resumeSession();
    }
    const afkTh = settings.afkTimeout * 1000;
    if (afkTh > 0 && idleMs >= afkTh) {
      if (!activeState.isAutoPaused) { doAutoPause(); toast(dict.toast_afk_paused); }
    } else if (afkTh > 0) {
      const pct = Math.max(0, 100 - (idleMs / afkTh) * 100);
      $('inactWrap').classList.add('on');
      $('inactBar').style.setProperty('--p', pct.toFixed(1) + '%');
      $('inactivityLabel').textContent = dict.inact_afk_tolerance;
    } else {
      clearInact();
    }
  } else {
    // Otomatik session + oyun arka planda (alt-tab)
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

async function checkAndFetchIcon(g) {
  if (!isElectron || !g || !g.exe || g.icon || g.iconAttempted) return;
  g.iconAttempted = true;
  try {
    const path = await window.electronAPI.findProcessPath(g.exe);
    if (path) {
      g.path = path;
      const iconDataUrl = await window.electronAPI.getFileIcon(path);
      if (iconDataUrl) {
        g.icon = iconDataUrl;
        saveGames();
        renderSidebar();
        if (selectedId === g.id) {
          renderGameHeader();
        }
      } else {
        saveGames();
      }
    }
  } catch (e) {
    console.error('Failed to dynamically fetch icon for', g.name, e);
  }
}

// ─── Session Logic ────────────────────────────────────────────────────────────
function startSession(gameId) {
  if(activeState) return;
  const g = gameById(gameId); if(!g) return;
  if (g.activeDlcId === undefined || g.activeDlcId === 'overall') {
    g.activeDlcId = null;
    saveGames();
  }
  activeGameId = gameId;
  activeState  = { startTs: new Date().toISOString(), runningMs:0, isPaused:false, isAutoPaused:false };
  lastGameFocusedMs = Date.now();
  startTicking();
  renderControls(); renderTimer(); renderStatusPill(); renderGameHeader();
  renderSidebar(); saveState();
  if (g.exe) {
    checkAndFetchIcon(g);
  }
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
async function stopSession() {
  if(!activeState) return false;
  const g = gameById(activeGameId); if(!g) return false;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  
  const isTooShort = activeState.runningMs < 60000;
  if (!isTooShort) {
    g.sessions.unshift({
      id: genId(), startTs: activeState.startTs, endTs: new Date().toISOString(),
      durationMs: activeState.runningMs, dateKey: todayKey(),
      dlcId: g.activeDlcId || null
    });
    saveGames();
  }
  
  activeState=null; activeGameId=null;
  stopTicking(); clearInact();
  await saveState();
  renderControls(); renderTimer(); renderStatusPill(); renderGameHeader();
  renderSessionList(); renderStats(); renderSidebar();
  
  if (!isTooShort) {
    toast(dict.toast_session_saved);
  } else {
    toast(dict.toast_session_too_short || (settings.lang === 'tr' ? "⚠️ Oturum 1 dakikadan kısa olduğu için kaydedilmedi" : "⚠️ Session too short (< 1 min) — not saved"));
  }
  if(isElectron) window.electronAPI.updateTray('GameTime Tracker');
  return !isTooShort;
}

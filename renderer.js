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
        stopSession().then(saved => {
          if (saved) {
            toast(dict.toast_game_closed_saved.replace('NAME', g.name));
          }
        });
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
let sessionFilterTab = 'overall';
let isMultiSelectMode = false;
let selectedSessionIds = new Set();
let isDlcMultiSelectMode = false;
let selectedDlcIds = new Set();
function getGameIconUrl(g) {
  if (g.isCustomIcon && g.icon) return g.icon;
  if (g.hltbData && g.hltbData.image) {
    const img = g.hltbData.image;
    if (img.startsWith('http')) return img;
    if (img.startsWith('/')) return 'https://howlongtobeat.com' + img;
    return 'https://howlongtobeat.com/games/' + img;
  }
  if (g.icon) return g.icon;
  return null;
}

// ─── Drag-and-Drop Manager (Smooth Spring-Physics) ──────────────────────────────
const DragManager = (() => {
  let isDragging = false;
  let isMouseDown = false;
  let dragItem = null;
  let dragGhost = null;
  let placeholder = null;
  let container = null;
  let startY = 0;
  let startX = 0;
  let offsetY = 0;
  let dragGameId = null;
  let scrollInterval = null;
  let rafId = null;
  let dropTimeoutId = null;

  // Spring-physics state for ghost
  let mouseY = 0;
  let ghostY = 0;
  let ghostVY = 0;
  let prevMouseY = 0;
  let mouseVelocity = 0;

  // Last mouse position
  let lastClientX = null;
  let lastClientY = null;

  // Source item animation
  let sourceHeight = 0;
  let sourceMargin = 0;

  const SPRING_STIFFNESS = 0.35;
  const SPRING_DAMPING = 0.72;
  const MAX_TILT = 3; // degrees

  function getTransformY(el) {
    const style = window.getComputedStyle(el);
    const transform = style.transform;
    if (!transform || transform === 'none') return 0;
    
    if (transform.startsWith('matrix3d(')) {
      const parts = transform.slice(9, -1).split(',');
      return parseFloat(parts[13]) || 0;
    } else if (transform.startsWith('matrix(')) {
      const parts = transform.slice(7, -1).split(',');
      return parseFloat(parts[5]) || 0;
    }
    return 0;
  }

  function init(itemEl, e) {
    if (e.button !== 0) return;

    container = document.getElementById('sidebarGames');
    if (!container) return;

    isMouseDown = true;
    dragItem = itemEl;
    dragGameId = itemEl.dataset.gid;
    startY = e.clientY;
    startX = e.clientX;

    const rect = itemEl.getBoundingClientRect();
    offsetY = e.clientY - rect.top;

    const onMouseMove = (ev) => {
      if (!isDragging && (Math.abs(ev.clientY - startY) > 5 || Math.abs(ev.clientX - startX) > 5)) {
        beginDrag(ev);
      }
      if (isDragging) {
        updateMousePosition(ev);
      }
    };

    const onMouseUp = (ev) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      isMouseDown = false;
      if (isDragging) {
        endDrag(ev);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function beginDrag(e) {
    isDragging = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    container.classList.add('drag-active');

    // Prevent text selection glitches and escape key/blur cancellations
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    container.addEventListener('scroll', onContainerScroll);

    const rect = dragItem.getBoundingClientRect();
    sourceHeight = rect.height;
    sourceMargin = 2; // margin-bottom from CSS

    // Create ghost element
    dragGhost = document.createElement('div');
    dragGhost.className = 'sg-drag-ghost';
    dragGhost.style.width = rect.width + 'px';
    dragGhost.style.left = rect.left + 'px';
    dragGhost.style.position = 'fixed';
    dragGhost.style.zIndex = '10000';
    dragGhost.style.pointerEvents = 'none';

    const clone = dragItem.cloneNode(true);
    clone.classList.remove('active');
    clone.style.width = '100%';
    clone.style.margin = '0';
    dragGhost.appendChild(clone);
    document.body.appendChild(dragGhost);

    // Initialize spring physics
    mouseY = e.clientY - offsetY;
    ghostY = mouseY;
    ghostVY = 0;
    prevMouseY = e.clientY;
    mouseVelocity = 0;

    dragGhost.style.top = ghostY + 'px';

    // Animate source item collapse (smooth height transition)
    dragItem.classList.add('drag-source');
    dragItem.style.height = sourceHeight + 'px';
    dragItem.style.transition = 'none';
    dragItem.getBoundingClientRect(); // force reflow
    dragItem.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, padding 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), margin 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    dragItem.style.height = '0px';
    dragItem.style.padding = '0 10px';
    dragItem.style.margin = '0';
    dragItem.style.opacity = '0';
    dragItem.style.overflow = 'hidden';

    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'sg-drop-placeholder';
    placeholder.style.height = '0px';
    placeholder.style.opacity = '0';
    dragItem.parentNode.insertBefore(placeholder, dragItem);

    // Animate placeholder expand
    requestAnimationFrame(() => {
      placeholder.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease';
      placeholder.style.height = sourceHeight + 'px';
      placeholder.style.opacity = '1';
    });

    // Start animation loop
    startAnimationLoop();
  }

  function updateMousePosition(e) {
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    mouseVelocity = e.clientY - prevMouseY;
    prevMouseY = e.clientY;
    mouseY = e.clientY - offsetY;

    // Edge scrolling with smooth acceleration
    const scrollZone = 50;
    const containerRect = container.getBoundingClientRect();
    if (e.clientY < containerRect.top + scrollZone) {
      const intensity = 1 - (e.clientY - containerRect.top) / scrollZone;
      startEdgeScroll(-1, Math.max(0.2, intensity));
    } else if (e.clientY > containerRect.bottom - scrollZone) {
      const intensity = 1 - (containerRect.bottom - e.clientY) / scrollZone;
      startEdgeScroll(1, Math.max(0.2, intensity));
    } else {
      stopEdgeScroll();
    }

    // Find insertion point
    const items = Array.from(container.querySelectorAll('.sg-item:not(.drag-source)'));
    let insertBefore = null;

    for (const item of items) {
      const r = item.getBoundingClientRect();
      const midY = r.top + r.height / 2;
      if (e.clientY < midY) {
        insertBefore = item;
        break;
      }
    }

    // Check if placeholder needs to move
    let nextVisible = placeholder.nextElementSibling;
    while (nextVisible && nextVisible.classList.contains('drag-source')) {
      nextVisible = nextVisible.nextElementSibling;
    }

    let needsMove = false;
    if (insertBefore) {
      needsMove = nextVisible !== insertBefore;
    } else {
      needsMove = nextVisible !== null;
    }

    if (needsMove) {
      // FLIP animation for sibling items
      const allItems = Array.from(container.querySelectorAll('.sg-item:not(.drag-source)'));
      const firstPositions = new Map();
      allItems.forEach(item => {
        firstPositions.set(item, item.offsetTop + getTransformY(item));
      });

      if (insertBefore) {
        container.insertBefore(placeholder, insertBefore);
      } else {
        container.appendChild(placeholder);
      }

      // Animate displaced items with spring-like FLIP
      allItems.forEach(item => {
        const firstTop = firstPositions.get(item);
        if (firstTop === undefined) return;
        const newTop = item.offsetTop;
        const dy = firstTop - newTop;
        if (Math.abs(dy) > 0.5) {
          if (item._transitionHandler) {
            item.removeEventListener('transitionend', item._transitionHandler);
            item.removeEventListener('transitioncancel', item._transitionHandler);
          }

          // Cancel any running animation
          item.style.transition = 'none';
          item.style.transform = `translateY(${dy}px)`;
          item.getBoundingClientRect(); // force reflow
          item.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
          item.style.transform = 'translateY(0)';
          
          const handler = (ev) => {
            if (item._transitionHandler !== handler) return;
            if (ev.propertyName === 'transform') {
              item.style.transition = '';
              item.style.transform = '';
              item.removeEventListener('transitionend', handler);
              item.removeEventListener('transitioncancel', handler);
              delete item._transitionHandler;
            }
          };
          item._transitionHandler = handler;
          item.addEventListener('transitionend', handler);
          item.addEventListener('transitioncancel', handler);
        }
      });
    }
  }

  function startAnimationLoop() {
    function tick() {
      if (!isDragging || !dragGhost) return;

      // Spring physics: smoothly interpolate ghost position toward mouse
      const targetY = mouseY;
      const springForce = (targetY - ghostY) * SPRING_STIFFNESS;
      ghostVY += springForce;
      ghostVY *= SPRING_DAMPING;
      ghostY += ghostVY;

      // Decay mouse velocity for smooth leveling when mouse stops
      mouseVelocity *= 0.8;

      // Apply position with tilt based on velocity
      const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, mouseVelocity * 0.15));
      const scale = 1.03 + Math.abs(ghostVY) * 0.0005;
      dragGhost.style.top = ghostY + 'px';
      dragGhost.style.transform = `scale(${Math.min(scale, 1.08)}) rotate(${tilt}deg)`;

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function endDrag(e) {
    stopEdgeScroll();

    // Stop animation loop
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (!dragGhost || !placeholder || !container) {
      cleanup();
      return;
    }

    // Animate ghost to placeholder position
    const placeholderRect = placeholder.getBoundingClientRect();

    dragGhost.style.transition = 'top 0.3s cubic-bezier(0.25, 1, 0.5, 1), transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease, box-shadow 0.3s ease';
    dragGhost.style.top = placeholderRect.top + 'px';
    dragGhost.style.transform = 'scale(1) rotate(0deg)';
    dragGhost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    dragGhost.style.opacity = '0.85';

    let dropDone = false;
    const onDropEnd = () => {
      if (dropDone) return;
      dropDone = true;

      if (dropTimeoutId) {
        clearTimeout(dropTimeoutId);
        dropTimeoutId = null;
      }

      if (!dragItem || !container) {
        cleanup();
        return;
      }

      // Move item in DOM safely
      dragItem.classList.remove('drag-source');
      dragItem.style.transition = 'none';
      dragItem.style.height = '';
      dragItem.style.padding = '';
      dragItem.style.margin = '';
      dragItem.style.opacity = '';
      dragItem.style.overflow = '';
      dragItem.style.transform = '';

      if (placeholder && placeholder.parentNode === container) {
        container.insertBefore(dragItem, placeholder);
      } else {
        container.appendChild(dragItem);
      }

      if (placeholder) {
        placeholder.remove();
      }

      // Read new order
      const items = Array.from(container.querySelectorAll('.sg-item'));
      const newOrder = [];
      items.forEach(el => {
        const gid = el.dataset.gid;
        const game = games.find(g => g.id === gid);
        if (game) newOrder.push(game);
      });

      if (newOrder.length === games.length) {
        games = newOrder;
        saveGames();
      }

      // Remove ghost with a subtle fade
      if (dragGhost && dragGhost.parentNode) {
        dragGhost.parentNode.removeChild(dragGhost);
      }

      // Re-render to sync state
      renderSidebar();
      cleanup();
    };

    // Listen for the transition to finish
    dragGhost.addEventListener('transitionend', function handler(ev) {
      if (ev.propertyName === 'top') {
        dragGhost.removeEventListener('transitionend', handler);
        onDropEnd();
      }
    });

    // Fallback timeout in case transitionend doesn't fire
    dropTimeoutId = setTimeout(onDropEnd, 350);
  }

  function startEdgeScroll(direction, intensity) {
    stopEdgeScroll();
    const speed = 3 + intensity * 8;
    scrollInterval = setInterval(() => {
      if (container) {
        container.scrollTop += direction * speed;
        if (lastClientY !== null) {
          updateMousePosition({
            clientX: lastClientX,
            clientY: lastClientY
          });
        }
      }
    }, 16);
  }

  function stopEdgeScroll() {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      cancelDrag();
    }
  };

  const onWindowBlur = () => {
    cancelDrag();
  };

  const onContainerScroll = () => {
    if (isDragging && lastClientY !== null) {
      updateMousePosition({
        clientX: lastClientX,
        clientY: lastClientY
      });
    }
  };

  function cancelDrag() {
    if (!isDragging) return;

    stopEdgeScroll();

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (dragItem) {
      dragItem.classList.remove('drag-source');
      dragItem.style.transition = 'none';
      dragItem.style.height = '';
      dragItem.style.padding = '';
      dragItem.style.margin = '';
      dragItem.style.opacity = '';
      dragItem.style.overflow = '';
      dragItem.style.transform = '';
    }

    // Re-render sidebar to restore original DOM order and clean up any transforms on siblings
    renderSidebar();
    cleanup();
  }

  function cleanup() {
    isDragging = false;
    isMouseDown = false;
    dragItem = null;
    dragGameId = null;
    mouseVelocity = 0;
    ghostVY = 0;
    lastClientX = null;
    lastClientY = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', onWindowBlur);
    if (container) {
      container.removeEventListener('scroll', onContainerScroll);
      container.classList.remove('drag-active');
    }
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
    dragGhost = null;
    placeholder = null;
    container = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (dropTimeoutId) {
      clearTimeout(dropTimeoutId);
      dropTimeoutId = null;
    }
    stopEdgeScroll();
  }

  return {
    init,
    isDragging: () => isDragging || isMouseDown
  };
})();


function renderSidebar() {
  if (typeof DragManager !== 'undefined' && DragManager.isDragging && DragManager.isDragging()) {
    return;
  }
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
    const target = (selectedId === g.id) ? sessionFilterTab : 'overall';
    const ms = filteredTotalMs(g, target);
    const running = activeGameId===g.id&&activeState&&!activeState.isPaused&&!activeState.isAutoPaused;
    
    const item = document.createElement('div');
    item.className = `sg-item${selectedId===g.id?' active':''}`;
    item.dataset.gid = g.id;
    item.style.setProperty('--game-color', g.color);
    
    // Custom drag-and-drop via DragManager (replaces HTML5 drag API)
    item.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // Don't start drag if clicking on buttons or interactive elements
      if (e.target.closest('button')) return;
      e.preventDefault();
      DragManager.init(item, e);
    });
    item.addEventListener('dragstart', (e) => e.preventDefault());

    const iconUrl = getGameIconUrl(g);
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.className = 'sg-avatar-img cover-fit';
      img.alt = g.name;
      img.draggable = false;
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
  sessionFilterTab = 'overall';
  isMultiSelectMode = false;
  selectedSessionIds.clear();
  const editBar = $('sessionsEditBar');
  if (editBar) editBar.classList.remove('open');
  const selectBtn = $('selectSessionsBtn');
  if (selectBtn) {
    const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
    selectBtn.textContent = dict.select;
  }
  
  isDlcMultiSelectMode = false;
  selectedDlcIds.clear();
  const dlcEditBar = $('dlcsEditBar');
  if (dlcEditBar) dlcEditBar.classList.remove('open');
  const selectDlcBtn = $('selectDlcsBtn');
  if (selectDlcBtn) selectDlcBtn.classList.remove('hidden');

  document.documentElement.style.setProperty('--game-color',g.color);
  $('welcomeScreen').classList.add('hidden');
  $('gamePage').classList.remove('hidden');
  renderGameHeader(); renderTimer(); renderControls(); renderStatusPill();
  renderStats(); renderSessionList(); renderDlcSection(); renderHltbSection();
  renderSidebar();
}

function renderGameHeader() {
  const g = gameById(selectedId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const av = $('gameAvatar');
  av.textContent = '';
  const iconUrl = getGameIconUrl(g);
  if (iconUrl) {
    const img = document.createElement('img');
    img.src = iconUrl;
    img.className = 'game-avatar-img cover-fit';
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
    renderDlcSection();
    return;
  }
  const {h,m,s}=msToHMS(activeState.runningMs);
  $('th').textContent=pad(h); $('tm').textContent=pad(m); $('ts').textContent=pad(s);
  const st = activeState.isPaused||activeState.isAutoPaused;
  $('timerDisplay').className='timer-display '+(st?'paused':'running');
  document.querySelectorAll('.blink').forEach(c=>c.classList.toggle('on',!st));
  $('sessionBadge').textContent = st ? dict.badge_paused : dict.badge_running;
  if(isElectron) window.electronAPI.updateTray(`▶ ${gameById(activeGameId)?.name} — ${fmtShort(activeState.runningMs)}`);
  renderDlcSection();
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
  const target = sessionFilterTab;
  const ms = filteredTotalMs(g, target);
  const tod = filteredTodayMs(g, target);
  const best = filteredBestMs(g, target);
  const count = filteredSessionCount(g, target);
  $('statToday').textContent = fmtDur(tod);
  $('statTotal').textContent = fmtDur(ms);
  $('statBest').textContent  = fmtDur(best);
  $('statCount').textContent = count;
}

function renderSessionTabs(g) {
  const bar = $('sessionsTabBar'); if(!bar) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  bar.textContent = '';

  const targets = [
    { id: 'overall', name: dict.dlc_overall },
    { id: null, name: dict.dlc_main_game }
  ];
  if (g.dlcs && g.dlcs.length) {
    g.dlcs.forEach(d => {
      targets.push({ id: d.id, name: d.name });
    });
  }

  targets.forEach(t => {
    const tab = document.createElement('button');
    tab.className = 'session-tab' + (sessionFilterTab === t.id ? ' active' : '');
    
    const count = g.sessions.filter(s => {
      if (t.id === 'overall') return true;
      if (t.id === null) return !s.dlcId;
      return s.dlcId === t.id;
    }).length;

    tab.textContent = `${t.name} (${count})`;
    tab.addEventListener('click', () => {
      sessionFilterTab = t.id;
      renderSessionList();
      renderStats();
      renderSidebar();
    });
    bar.appendChild(tab);
  });
}

function updateSelectCount() {
  const countEl = $('selectCountText'); if (!countEl) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  countEl.textContent = dict.selected_count.replace('COUNT', selectedSessionIds.size);
  
  const selectAllCb = $('selectAllSessionsCheckbox');
  if (selectAllCb) {
    const g = gameById(selectedId);
    if (g) {
      const target = sessionFilterTab;
      const sessionsToRender = g.sessions.filter(s => {
        if (target === 'overall') return true;
        if (target === null) return !s.dlcId;
        return s.dlcId === target;
      });
      const allSelected = sessionsToRender.length > 0 && sessionsToRender.every(s => selectedSessionIds.has(s.id));
      selectAllCb.checked = allSelected;
    }
  }
}

function updateDlcSelectCount() {
  const countEl = $('selectDlcCountText'); if (!countEl) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  countEl.textContent = dict.selected_count.replace('COUNT', selectedDlcIds.size);
  
  const selectAllCb = $('selectAllDlcsCheckbox');
  if (selectAllCb) {
    const g = gameById(selectedId);
    if (g && g.dlcs) {
      const allSelected = g.dlcs.length > 0 && g.dlcs.every(d => selectedDlcIds.has(d.id));
      selectAllCb.checked = allSelected;
    } else {
      selectAllCb.checked = false;
    }
  }
}

function renderSessionList() {
  const g = gameById(selectedId); if(!g) return;
  const el=$('sessionList');
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  el.textContent = '';

  renderSessionTabs(g);

  const sessionsToRender = g.sessions.filter(s => {
    if (sessionFilterTab === 'overall') return true;
    if (sessionFilterTab === null) return !s.dlcId;
    return s.dlcId === sessionFilterTab;
  });

  if(!sessionsToRender.length) {
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
    updateSelectCount();
    return;
  }
  
  sessionsToRender.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='session-item';
    if (isMultiSelectMode) {
      div.style.cursor = 'pointer';
    }
    
    const num = document.createElement('div');
    num.className = 's-num';
    num.textContent = `#${sessionsToRender.length-i}`;
    
    const info = document.createElement('div');
    info.className = 's-info';
    
    const date = document.createElement('div');
    date.className = 's-date';
    date.textContent = fmtSessionTime(s);
    if (s.dlcId) {
      const dlc = g.dlcs && g.dlcs.find(d => d.id === s.dlcId);
      if (dlc) {
        const badge = document.createElement('span');
        badge.className = 's-dlc-badge';
        badge.textContent = dlc.name;
        date.appendChild(badge);
      }
    }
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

    if (isMultiSelectMode) {
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.className = 'session-item-checkbox-wrapper';
      const checkbox = document.createElement('div');
      checkbox.className = 'session-item-checkbox' + (selectedSessionIds.has(s.id) ? ' checked' : '');
      checkboxWrapper.appendChild(checkbox);
      div.prepend(checkboxWrapper);

      div.addEventListener('click', e => {
        if (selectedSessionIds.has(s.id)) {
          selectedSessionIds.delete(s.id);
        } else {
          selectedSessionIds.add(s.id);
        }
        renderSessionList();
        updateSelectCount();
      });
    }
    
    div.appendChild(num);
    div.appendChild(info);
    div.appendChild(dur);
    if (!isMultiSelectMode) {
      div.appendChild(del);
    }
    el.appendChild(div);
  });
  updateSelectCount();
}

function renderDlcSection() {
  const g = gameById(selectedId); if(!g) return;
  const el = $('dlcList'); if(!el) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  el.textContent = '';

  const activeDlc = g.activeDlcId || null;

  // 1. Main Game Target
  const mainItem = document.createElement('div');
  mainItem.className = 'dlc-item' + (activeDlc === null ? ' active' : '');
  
  if (isDlcMultiSelectMode) {
    mainItem.style.opacity = '0.5';
    mainItem.style.pointerEvents = 'none';
  }
  
  const mainRadio = document.createElement('div');
  mainRadio.className = 'dlc-item-radio';
  mainItem.appendChild(mainRadio);

  const mainName = document.createElement('div');
  mainName.className = 'dlc-item-name';
  mainName.textContent = dict.dlc_main_game;
  mainItem.appendChild(mainName);

  const mainTotal = document.createElement('div');
  mainTotal.className = 'dlc-item-total';
  mainTotal.textContent = fmtDur(filteredTotalMs(g, null));
  mainItem.appendChild(mainTotal);

  mainItem.addEventListener('click', async () => {
    if (activeGameId === g.id && activeState) {
      toast(settings.lang === 'tr' ? 'Oturum çalışırken hedef değiştirilemez!' : 'Cannot change target during a running session!');
      return;
    }
    await setActiveDlc(g.id, null);
    sessionFilterTab = null;
    renderDlcSection();
    renderSessionList();
    renderStats();
    renderSidebar();
  });

  el.appendChild(mainItem);

  // 2. Custom DLCs
  if (g.dlcs && g.dlcs.length) {
    g.dlcs.forEach(d => {
      const item = document.createElement('div');
      item.className = 'dlc-item' + (activeDlc === d.id ? ' active' : '');

      if (isDlcMultiSelectMode) {
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'session-item-checkbox-wrapper';
        checkboxWrapper.style.marginRight = '8px';
        const checkbox = document.createElement('div');
        checkbox.className = 'session-item-checkbox' + (selectedDlcIds.has(d.id) ? ' checked' : '');
        checkboxWrapper.appendChild(checkbox);
        item.appendChild(checkboxWrapper);
      } else {
        const radio = document.createElement('div');
        radio.className = 'dlc-item-radio';
        item.appendChild(radio);
      }

      const name = document.createElement('div');
      name.className = 'dlc-item-name';
      name.textContent = d.name;
      item.appendChild(name);

      const total = document.createElement('div');
      total.className = 'dlc-item-total';
      total.textContent = fmtDur(filteredTotalMs(g, d.id));
      item.appendChild(total);

      if (!isDlcMultiSelectMode) {
        const del = document.createElement('button');
        del.className = 'dlc-item-del';
        del.title = dict.confirm_delete_dlc_title;
        del.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/>
            <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
          </svg>`;

        del.addEventListener('click', e => {
          e.stopPropagation();
          if (activeGameId === g.id && activeState) {
            toast(settings.lang === 'tr' ? 'Oturum çalışırken DLC silinemez!' : 'Cannot delete DLC during a running session!');
            return;
          }
          showConfirm(dict.confirm_delete_dlc_title, dict.confirm_delete_dlc_text, async () => {
            await deleteDlc(g.id, d.id);
            if (sessionFilterTab === d.id) {
              sessionFilterTab = 'overall';
            }
            renderDlcSection();
            renderSessionList();
            renderStats();
            renderSidebar();
            toast(dict.toast_dlc_deleted);
          });
        });
        item.appendChild(del);
      }

      if (isDlcMultiSelectMode) {
        item.addEventListener('click', () => {
          if (selectedDlcIds.has(d.id)) {
            selectedDlcIds.delete(d.id);
          } else {
            selectedDlcIds.add(d.id);
          }
          renderDlcSection();
          updateDlcSelectCount();
        });
      } else {
        item.addEventListener('click', async () => {
          if (activeGameId === g.id && activeState) {
            toast(settings.lang === 'tr' ? 'Oturum çalışırken hedef değiştirilemez!' : 'Cannot change target during a running session!');
            return;
          }
          await setActiveDlc(g.id, d.id);
          sessionFilterTab = d.id;
          renderDlcSection();
          renderSessionList();
          renderStats();
          renderSidebar();
        });
      }

      el.appendChild(item);
    });
  }
  updateDlcSelectCount();
}

async function renderRatings(g) {
  const container = $('hltbRatingsContainer');
  if (!container) return;

  const mItem = $('ratingMetacritic');
  const iItem = $('ratingIgn');
  const ocItem = $('ratingOpencritic');
  
  const mVal = $('valMetacritic');
  const iVal = $('valIgn');
  const ocVal = $('valOpencritic');

  if (!g.hltbData) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';

  const updateMetacriticBadge = (item, valEl, metascore, userscore) => {
    if ((metascore === null || metascore === undefined) && (userscore === null || userscore === undefined)) {
      item.style.display = 'none';
      return;
    }
    item.style.display = 'flex';
    
    let text = '';
    let scoreForColor = null;
    let isUserScoreForColor = false;
    
    if (metascore !== null && metascore !== undefined) {
      text += metascore;
      scoreForColor = metascore;
    }
    if (userscore !== null && userscore !== undefined) {
      if (text) text += ' / ';
      text += userscore.toFixed(1);
      if (scoreForColor === null) {
        scoreForColor = userscore;
        isUserScoreForColor = true;
      }
    }
    
    valEl.textContent = text;
    
    let percent = 0;
    if (scoreForColor !== null) {
      percent = isUserScoreForColor ? scoreForColor * 10 : scoreForColor;
    }
    
    item.style.borderColor = percent >= 75 ? 'rgba(0, 200, 100, 0.4)' : percent >= 50 ? 'rgba(255, 170, 0, 0.4)' : 'rgba(255, 50, 50, 0.4)';
    valEl.style.color = percent >= 75 ? '#00ff7f' : percent >= 50 ? '#ffaa00' : '#ff5555';
  };

  const updateIgnBadge = (item, valEl, score) => {
    if (score === null || score === undefined) {
      item.style.display = 'none';
      return;
    }
    item.style.display = 'flex';
    valEl.textContent = score;
    item.style.borderColor = score >= 75 ? 'rgba(0, 200, 100, 0.4)' : score >= 50 ? 'rgba(255, 170, 0, 0.4)' : 'rgba(255, 50, 50, 0.4)';
    valEl.style.color = score >= 75 ? '#00ff7f' : score >= 50 ? '#ffaa00' : '#ff5555';
  };

  const updateOpencriticBadge = (item, valEl, score, percent) => {
    if (score === null || score === undefined) {
      item.style.display = 'none';
      return;
    }
    item.style.display = 'flex';
    let text = score.toString();
    if (percent !== null && percent !== undefined) {
      text += ` / ${percent}%`;
    }
    valEl.textContent = text;
    item.style.borderColor = score >= 75 ? 'rgba(0, 200, 100, 0.4)' : score >= 50 ? 'rgba(255, 170, 0, 0.4)' : 'rgba(255, 50, 50, 0.4)';
    valEl.style.color = score >= 75 ? '#00ff7f' : score >= 50 ? '#ffaa00' : '#ff5555';
  };

  mItem.onclick = () => {
    if (g.ratings && g.ratings.url) {
      if (isElectron) window.electronAPI.openExternal(g.ratings.url);
    } else {
      const url = `https://www.metacritic.com/search/game/${encodeURIComponent(g.hltbData.name || g.name)}/results`;
      if (isElectron) window.electronAPI.openExternal(url);
    }
  };
  
  iItem.onclick = () => {
    if (g.ratings && g.ratings.ignUrl) {
      if (isElectron) window.electronAPI.openExternal(g.ratings.ignUrl);
    } else {
      const url = `https://www.google.com/search?q=${encodeURIComponent((g.hltbData.name || g.name) + ' IGN review')}`;
      if (isElectron) window.electronAPI.openExternal(url);
    }
  };

  ocItem.onclick = () => {
    if (g.ratings && g.ratings.opencriticUrl) {
      if (isElectron) window.electronAPI.openExternal(g.ratings.opencriticUrl);
    } else {
      const url = `https://search.yahoo.com/search?q=site:opencritic.com/game+${encodeURIComponent(g.hltbData.name || g.name)}`;
      if (isElectron) window.electronAPI.openExternal(url);
    }
  };

  const hasSubdomainIgn = g.ratings && g.ratings.ignUrl && !/^https?:\/\/(?:www\.)?ign\.com/i.test(g.ratings.ignUrl);
  const hasOpencritic = g.ratings && (g.ratings.opencriticScore !== undefined || g.ratings.opencriticUrl !== undefined);

  if (g.ratings && !hasSubdomainIgn && hasOpencritic) {
    updateMetacriticBadge(mItem, mVal, g.ratings.metascore, g.ratings.userscore);
    updateIgnBadge(iItem, iVal, g.ratings.ignscore);
    updateOpencriticBadge(ocItem, ocVal, g.ratings.opencriticScore, g.ratings.opencriticPercent);
  } else {
    mItem.style.display = 'none';
    iItem.style.display = 'none';
    ocItem.style.display = 'none';

    if (g._fetchingRatings) return;
    g._fetchingRatings = true;

    try {
      const ratings = await window.electronAPI.fetchGameRatings(g.hltbData.name || g.name);
      g.ratings = ratings || { metascore: null, userscore: null, ignscore: null, url: null, ignUrl: null, opencriticScore: null, opencriticPercent: null, opencriticUrl: null };
      await saveGames();
      
      if (selectedId === g.id) {
        renderRatings(g);
      }
    } catch (e) {
      console.error('Failed to fetch ratings:', e);
    } finally {
      delete g._fetchingRatings;
    }
  }
}

function renderHltbSection() {
  const g = gameById(selectedId); if(!g) return;
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  const container = $('hltbTimesContainer');
  const emptyState = $('hltbEmptyState');
  const unlinkBtn = $('hltbUnlinkBtn');
  const titleEl = $('hltbGameTitle');
  const nameEl = $('hltbGameTitleName');
  const imgEl = $('hltbGameImage');
  const headerTitleEl = $('hltbHeaderTitle');

  if (g.hltbData) {
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    unlinkBtn.style.display = 'inline-flex';

    const hltbUrl = 'https://howlongtobeat.com/game/' + g.hltbData.id;
    const openHltb = () => {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(hltbUrl);
      }
    };
    const openHltbMain = () => {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal('https://howlongtobeat.com');
      }
    };

    if (headerTitleEl) {
      headerTitleEl.style.cursor = 'pointer';
      headerTitleEl.onclick = openHltbMain;
    }
    if (imgEl) {
      imgEl.style.cursor = 'pointer';
      imgEl.onclick = openHltb;
    }
    if (nameEl) {
      nameEl.style.cursor = 'pointer';
      nameEl.onclick = openHltb;
    }

    if (titleEl) {
      titleEl.style.display = 'flex';
      if (nameEl) nameEl.textContent = g.hltbData.name || '';
      renderRatings(g);
      
      if (imgEl) {
        if (g.hltbData.image) {
          let imageUrl = '';
          if (g.hltbData.image.startsWith('http')) {
            imageUrl = g.hltbData.image;
          } else if (g.hltbData.image.startsWith('/')) {
            imageUrl = 'https://howlongtobeat.com' + g.hltbData.image;
          } else {
            imageUrl = 'https://howlongtobeat.com/games/' + g.hltbData.image;
          }
          imgEl.src = imageUrl;
          imgEl.style.display = 'block';
        } else {
          imgEl.src = '';
          imgEl.style.display = 'none';
        }
      }
    }
    $('hltbLinkBtn').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
      </svg>
      <span>${settings.lang === 'tr' ? 'Güncelle' : 'Update'}</span>
    `;

    const formatHltbSeconds = (seconds) => {
      if (!seconds) return '--';
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      if (hours > 0 && mins > 0) {
        return `${hours}${dict.dur_hour} ${mins}${dict.dur_min}`;
      } else if (hours > 0) {
        return `${hours}${dict.dur_hour}`;
      } else {
        return `${mins}${dict.dur_min}`;
      }
    };

    $('hltbMainTime').textContent = formatHltbSeconds(g.hltbData.main);
    $('hltbPlusTime').textContent = formatHltbSeconds(g.hltbData.plus);
    $('hltb100Time').textContent = formatHltbSeconds(g.hltbData.completionist);
    
    // HLTB Rating card removed as requested
  } else {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    unlinkBtn.style.display = 'none';
    if (titleEl) titleEl.style.display = 'none';
    const ratingsContainer = $('hltbRatingsContainer');
    if (ratingsContainer) ratingsContainer.style.display = 'none';

    if (headerTitleEl) {
      headerTitleEl.style.cursor = 'default';
      headerTitleEl.onclick = null;
    }
    if (imgEl) {
      imgEl.style.cursor = 'default';
      imgEl.onclick = null;
    }
    if (nameEl) {
      nameEl.style.cursor = 'default';
      nameEl.onclick = null;
    }

    $('hltbLinkBtn').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
      <span>${dict.hltb_link_manually || (settings.lang === 'tr' ? 'HLTB Eşleştir' : 'Match HLTB')}</span>
    `;
  }
}

function renderHltbSearchResults(results) {
  const el = $('hltbResultList');
  el.textContent = '';
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;

  if (!results || !results.length) {
    const p = document.createElement('p');
    p.className = 'scan-hint';
    p.dataset.i18n = 'hltb_no_results';
    p.textContent = dict.hltb_no_results;
    el.appendChild(p);
    return;
  }

  results.forEach(res => {
    const item = document.createElement('div');
    item.className = 'hltb-result-item';
    
    const info = document.createElement('div');
    info.className = 'hltb-result-info';
    
    const title = document.createElement('span');
    title.className = 'hltb-result-title';
    title.textContent = res.game_name;
    info.appendChild(title);
    
    const subtitle = document.createElement('span');
    subtitle.className = 'hltb-result-subtitle';
    const release = res.release_world ? `, ${res.release_world}` : '';
    const platform = res.profile_platform ? ` (${res.profile_platform})` : '';
    subtitle.textContent = `${res.game_type}${release}${platform}`;
    info.appendChild(subtitle);
    
    item.appendChild(info);
    
    const btn = document.createElement('button');
    btn.className = 'hltb-result-btn';
    btn.textContent = dict.select || 'Seç';
    item.appendChild(btn);
    
    item.addEventListener('click', async () => {
      const hltbData = {
        id: res.game_id,
        name: res.game_name,
        main: res.comp_main,
        plus: res.comp_plus,
        completionist: res.comp_100,
        image: res.game_image,
        rating: res.review_score
      };
      await updateGameHltbData(selectedId, hltbData);
      
      try {
        const dlcNames = await window.electronAPI.fetchHltbDlcs(hltbData.id);
        if (dlcNames && dlcNames.length > 0) {
          const g = gameById(selectedId);
          if (g) {
            if (!g.dlcs) g.dlcs = [];
            const existingNames = new Set(g.dlcs.map(d => d.name.toLowerCase().trim()));
            let addedCount = 0;
            dlcNames.forEach(dlcName => {
              if (!existingNames.has(dlcName.toLowerCase().trim())) {
                g.dlcs.push({
                  id: genId(),
                  name: dlcName.trim(),
                  createdTs: new Date().toISOString()
                });
                addedCount++;
              }
            });
            if (addedCount > 0) {
              await saveGames();
              renderDlcSection();
            }
          }
        }
      } catch (e) {
        console.error('Failed to populate DLCs on manual link:', e);
      }

      closeHltbModal();
      renderHltbSection();
      renderSidebar();
      renderGameHeader();
      toast(dict.toast_hltb_linked);
    });
    
    el.appendChild(item);
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
      $('newGameName').dispatchEvent(new Event('input'));
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
  const menuWidth = 210;
  const menuHeight = 250;
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
    await updateGameIcon(g.id, result.icon, result.path, true);
    renderSidebar();
    if (selectedId === g.id) {
      renderGameHeader();
    }
    toast(settings.lang === 'tr' ? 'Simge güncellendi' : 'Icon updated');
  }
}

async function handleResetIcon(g) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  
  // If the path is an image file (corrupted by the custom icon bug), clear it
  if (g.path && /\.(png|jpg|jpeg|gif|ico|bmp|webp)$/i.test(g.path)) {
    g.path = '';
  }

  // 1. Delete custom icon flags to reset back to default
  delete g.isCustomIcon;
  delete g.icon;
  g.iconAttempted = false;

  // 2. Try fetching HLTB first and filling it
  let hltbSuccess = false;
  try {
    const results = await window.electronAPI.fetchHltbTime(g.name);
    if (results && results.length > 0) {
      const res = results[0];
      g.hltbData = {
        id: res.game_id,
        name: res.game_name,
        main: res.comp_main,
        plus: res.comp_plus,
        completionist: res.comp_100,
        image: res.game_image,
        rating: res.review_score
      };
      hltbSuccess = true;
      
      // Fetch DLCs in background
      try {
        const dlcNames = await window.electronAPI.fetchHltbDlcs(res.game_id);
        if (dlcNames && dlcNames.length > 0) {
          if (!g.dlcs) g.dlcs = [];
          const existingNames = new Set(g.dlcs.map(d => d.name.toLowerCase().trim()));
          dlcNames.forEach(dlcName => {
            if (!existingNames.has(dlcName.toLowerCase().trim())) {
              g.dlcs.push({
                id: genId(),
                name: dlcName.trim(),
                createdTs: new Date().toISOString()
              });
            }
          });
        }
      } catch (dlcErr) {
        console.error('Failed to fetch DLCs on icon reset:', dlcErr);
      }
    }
  } catch (err) {
    console.error('Failed to fetch HLTB data on icon reset:', err);
  }

  // 3. Fallback to extracting the EXE system icon if HLTB failed
  if (!hltbSuccess) {
    let exePath = g.path;
    if (!exePath && g.exe) {
      exePath = await window.electronAPI.findProcessPath(g.exe);
      if (exePath) {
        g.path = exePath;
      }
    }
    
    if (exePath && isElectron) {
      const iconDataUrl = await window.electronAPI.getFileIcon(exePath);
      if (iconDataUrl) {
        g.icon = iconDataUrl;
        g.iconAttempted = true;
      }
    }
  }

  await saveGames();
  
  renderSidebar();
  if (selectedId === g.id) {
    renderGameHeader();
    renderHltbSection();
    renderDlcSection();
    renderStats();
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
  const defaultName = (g.hltbData && g.hltbData.name) ? g.hltbData.name : (g.exe ? formatProcessName(g.exe) : '');
  
  showPrompt(title, label, g.name, async (newName) => {
    if (newName && newName.trim()) {
      await renameGame(g.id, newName.trim());
      renderSidebar();
      if (selectedId === g.id) {
        renderGameHeader();
      }
      toast(settings.lang === 'tr' ? 'Oyun yeniden adlandırıldı' : 'Game renamed');
    }
  }, defaultName);
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

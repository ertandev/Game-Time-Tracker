'use strict';

const afkSliderEl  = $('afkSlider'),    afkValEl  = $('afkVal');
const altTabSliderEl = $('altTabSlider'), altTabValEl = $('altTabVal');

function fmtSec(v) {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  if (v === 0) return settings.lang === 'tr' ? 'Kapalı' : 'Off';
  return `${v}${dict.dur_sec}`;
}

function openSettingsModal() {
  afkSliderEl.value    = settings.afkTimeout;    afkValEl.textContent    = fmtSec(settings.afkTimeout);
  altTabSliderEl.value = settings.altTabTimeout; altTabValEl.textContent = fmtSec(settings.altTabTimeout);
  $('autoSaveCheckbox').checked = !!settings.autoSaveOnClose;
  $('startupCheckbox').checked = !!settings.startMinimized;
  $('closeToTrayCheckbox').checked = settings.closeToTray !== false;
  
  const modalBody = $('settingsOverlay').querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;

  $('settingsOverlay').classList.add('open');
}

let isManualChange = false;

afkSliderEl.addEventListener('input', () => {
  if (!isManualChange) {
    const val = parseInt(afkSliderEl.value) || 0;
    const snapped = Math.round(val / 30) * 30;
    if (snapped !== val) {
      afkSliderEl.value = snapped;
    }
  }
  afkValEl.textContent = fmtSec(parseInt(afkSliderEl.value));
});

altTabSliderEl.addEventListener('input', () => {
  if (!isManualChange) {
    const val = parseInt(altTabSliderEl.value) || 0;
    const snapped = Math.round(val / 15) * 15;
    if (snapped !== val) {
      altTabSliderEl.value = snapped;
    }
  }
  altTabValEl.textContent = fmtSec(parseInt(altTabSliderEl.value));
});

function makeValEditable(valEl, sliderEl, maxVal) {
  if (valEl.querySelector('input')) return;
  const currentVal = parseInt(sliderEl.value);
  valEl.style.borderBottom = 'none';
  const oldText = valEl.textContent;
  valEl.textContent = '';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'setting-num-input';
  input.min = 0;
  input.max = maxVal;
  input.value = currentVal;
  valEl.appendChild(input);
  input.focus();
  input.select();
  function saveEdit() {
    input.removeEventListener('blur', saveEdit);
    let newVal = parseInt(input.value);
    if (isNaN(newVal) || newVal < 0) newVal = 0;
    else if (newVal > maxVal) newVal = maxVal;
    isManualChange = true;
    sliderEl.value = newVal;
    valEl.innerHTML = '';
    valEl.textContent = fmtSec(newVal);
    valEl.style.borderBottom = '';
    sliderEl.dispatchEvent(new Event('input'));
    isManualChange = false;
  }
  input.addEventListener('blur', saveEdit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') {
      valEl.innerHTML = '';
      valEl.textContent = oldText;
      valEl.style.borderBottom = '';
    }
  });

  // Prevent page scroll and manually adjust input value on wheel scroll
  input.addEventListener('wheel', e => {
    e.preventDefault();
    const step = 1;
    let val = parseInt(input.value) || 0;
    if (e.deltaY < 0) {
      val = Math.min(maxVal, val + step);
    } else if (e.deltaY > 0) {
      val = Math.max(0, val - step);
    }
    input.value = val;
  }, { passive: false });
}

// Add mouse wheel adjust support for range sliders while preventing page scroll
function bindSliderWheel(sliderEl, maxVal, step) {
  sliderEl.addEventListener('wheel', e => {
    e.preventDefault();
    let val = parseInt(sliderEl.value) || 0;
    if (e.deltaY < 0) {
      val = Math.min(maxVal, val + step);
    } else if (e.deltaY > 0) {
      val = Math.max(0, val - step);
    }
    isManualChange = true;
    sliderEl.value = val;
    sliderEl.dispatchEvent(new Event('input'));
    isManualChange = false;
  }, { passive: false });
}

bindSliderWheel(afkSliderEl, 3600, 1);
bindSliderWheel(altTabSliderEl, 600, 1);

afkValEl.addEventListener('click', () => makeValEditable(afkValEl, afkSliderEl, 3600));
altTabValEl.addEventListener('click', () => makeValEditable(altTabValEl, altTabSliderEl, 600));

$('globalSettingsBtn').addEventListener('click', openSettingsModal);
$('settingsClose').addEventListener('click',  () => $('settingsOverlay').classList.remove('open'));
$('settingsCancel').addEventListener('click', () => $('settingsOverlay').classList.remove('open'));
$('settingsSave').addEventListener('click', () => {
  const oldLang = settings.lang;
  settings.afkTimeout    = parseInt(afkSliderEl.value);
  settings.altTabTimeout = parseInt(altTabSliderEl.value);
  settings.autoSaveOnClose = $('autoSaveCheckbox').checked;
  settings.startMinimized = $('startupCheckbox').checked;
  settings.closeToTray = $('closeToTrayCheckbox').checked;
  settings.lang = $('langSelect').value;
  saveSettings();
  if (isElectron) {
    window.electronAPI.setStartup(settings.startMinimized, settings.startMinimized);
    window.electronAPI.setCloseToTray(settings.closeToTray);
  }
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

$('resetSettingsBtn').addEventListener('click', () => {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_reset_settings_title, dict.confirm_reset_settings_text, () => {
    settings = {
      afkTimeout: 600,
      altTabTimeout: 120,
      autoSaveOnClose: true,
      startMinimized: false,
      closeToTray: true,
      lang: navigator.language.startsWith('tr') ? 'tr' : 'en'
    };
    saveSettings();
    afkSliderEl.value = settings.afkTimeout;
    afkValEl.textContent = fmtSec(settings.afkTimeout);
    altTabSliderEl.value = settings.altTabTimeout;
    altTabValEl.textContent = fmtSec(settings.altTabTimeout);
    $('autoSaveCheckbox').checked = !!settings.autoSaveOnClose;
    $('startupCheckbox').checked = !!settings.startMinimized;
    $('closeToTrayCheckbox').checked = settings.closeToTray !== false;
    $('langSelect').value = settings.lang;
    
    if (isElectron) {
      window.electronAPI.setStartup(settings.startMinimized, settings.startMinimized);
      window.electronAPI.setCloseToTray(settings.closeToTray);
    }
    applyLanguage();
    toast(TRANSLATIONS[settings.lang || 'tr']?.toast_settings_reset || '🔄 Settings reset to defaults');
  });
});

$('deleteAllDataBtn').addEventListener('click', () => {
  const dict = TRANSLATIONS[settings.lang || 'tr'] || TRANSLATIONS.tr;
  showConfirm(dict.confirm_delete_all_data_title, dict.confirm_delete_all_data_text, async () => {
    if (activeState) {
      await stopSession();
    }
    games = [];
    await saveGames();
    selectedId = null;
    $('gamePage').classList.add('hidden');
    $('welcomeScreen').classList.remove('hidden');
    renderSidebar();
    $('settingsOverlay').classList.remove('open');
    toast(TRANSLATIONS[settings.lang || 'tr']?.toast_all_data_deleted || '🗑 All games and session history deleted');
  });
});



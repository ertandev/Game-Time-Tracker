'use strict';

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
  $('startupCheckbox').checked = !!settings.startMinimized;
  $('closeToTrayCheckbox').checked = settings.closeToTray !== false;
  $('settingsOverlay').classList.add('open');
}

afkSliderEl.addEventListener('input',    () => { afkValEl.textContent    = fmtSec(parseInt(afkSliderEl.value)); });
altTabSliderEl.addEventListener('input', () => { altTabValEl.textContent = fmtSec(parseInt(altTabSliderEl.value)); });

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
    let newVal = parseInt(input.value);
    if (isNaN(newVal) || newVal < 0) newVal = 0;
    else if (newVal > maxVal) newVal = maxVal;
    sliderEl.value = newVal;
    valEl.innerHTML = '';
    valEl.textContent = fmtSec(newVal);
    valEl.style.borderBottom = '';
    sliderEl.dispatchEvent(new Event('input'));
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
}
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
$('settingsOverlay').addEventListener('click', e => { if (e.target === $('settingsOverlay')) $('settingsOverlay').classList.remove('open'); });

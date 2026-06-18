'use strict';

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
    session_history: "Oturum Geçmişi",
    
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
    settings_section_system: "Sistem",
    settings_startup_label: "Sistem başlangıcında minimize olarak çalıştır",
    settings_startup_hint: "Uygulama Windows açıldığında otomatik olarak arka planda (sistem tepsisinde) başlar.",
    settings_closetotray_label: "Sistem tepsisine küçült",
    settings_closetotray_hint: "Pencereyi kapatırken, çıkış yapmak yerine uygulamayı sistem tepsisine küçült",
    about_rights: "Tüm Hakları Saklıdır.",
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
    stop: "Bitir",
    
    check_updates: "Güncellemeleri Denetle",
    update_checking: "Güncellemeler denetleniyor...",
    update_available: "Yeni sürüm (vVERSION) mevcut. İndiriliyor...",
    update_not_available: "Uygulama güncel. En son sürümü kullanıyorsunuz.",
    update_downloading: "İndiriliyor: %PERCENT%",
    update_downloaded: "Güncelleme hazır. Yüklemek için Yeniden Başlat.",
    update_error: "Güncelleme hatası: MSG",
    update_btn_restart: "Yeniden Başlat",
    update_installing: "Güncelleme kuruluyor, lütfen bekleyin...",
    update_btn_installing: "Kuruluyor...",
    menu_launch: "Oyunu Başlat",
    menu_open_location: "Dosya Konumunu Aç",
    menu_change_icon: "Özel Simge Seç...",
    menu_reset_icon: "Simgeyi Sıfırla",
    menu_change_color: "Accent Rengini Değiştir",
    menu_rename: "Oyunu Yeniden Adlandır",
    menu_clear_sessions: "Oturum Geçmişini Temizle",
    menu_delete: "Oyunu Sil",
    
    settings_reset_btn: "Ayarları Sıfırla",
    settings_delete_all_data_btn: "Tüm Verileri Temizle (Oyunlar & Oturumlar)",
    confirm_reset_settings_title: "Ayarları Sıfırla",
    confirm_reset_settings_text: "Tüm ayarlar varsayılan değerlerine sıfırlanacak. Devam etmek istiyor musunuz?",
    confirm_delete_all_data_title: "Tüm Verileri Sil",
    confirm_delete_all_data_text: "DİKKAT: Kayıtlı tüm oyunlarınız ve oturum geçmişleriniz kalıcı olarak silinecek! Bu işlem geri alınamaz. Devam etmek istiyor musunuz?",
    toast_settings_reset: "🔄 Ayarlar varsayılana sıfırlandı",
    toast_all_data_deleted: "🗑 Tüm oyunlar ve oturum geçmişleri silindi"
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
    session_history: "Session History",
    
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
    settings_section_system: "System",
    settings_startup_label: "Run minimized on system startup",
    settings_startup_hint: "The application starts automatically in the background (system tray) when Windows boots.",
    settings_closetotray_label: "Minimize to system tray",
    settings_closetotray_hint: "When closing the window, minimize the application to the system tray instead of exiting",
    about_rights: "All Rights Reserved.",
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
    stop: "Stop",
    
    check_updates: "Check for Updates",
    update_checking: "Checking for updates...",
    update_available: "New version (vVERSION) is available. Downloading...",
    update_not_available: "Application is up-to-date.",
    update_downloading: "Downloading: %PERCENT%",
    update_downloaded: "Update ready. Restart to install.",
    update_error: "Update error: MSG",
    update_btn_restart: "Restart Now",
    update_installing: "Installing update, please wait...",
    update_btn_installing: "Installing...",
    menu_launch: "Launch Game",
    menu_open_location: "Open File Location",
    menu_change_icon: "Choose Custom Icon...",
    menu_reset_icon: "Reset Icon",
    menu_change_color: "Change Accent Color",
    menu_rename: "Rename Game",
    menu_clear_sessions: "Clear Session History",
    menu_delete: "Delete Game",
    
    settings_reset_btn: "Reset Settings",
    settings_delete_all_data_btn: "Delete All Data (Games & Sessions)",
    confirm_reset_settings_title: "Reset Settings",
    confirm_reset_settings_text: "All settings will be reset to their default values. Do you want to continue?",
    confirm_delete_all_data_title: "Delete All Data",
    confirm_delete_all_data_text: "WARNING: All your games and session history will be permanently deleted! This action cannot be undone. Do you want to continue?",
    toast_settings_reset: "🔄 Settings reset to defaults",
    toast_all_data_deleted: "🗑 All games and session history deleted"
  }
};

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

  const btnCheckUpdate = $('btnCheckUpdate');
  if (btnCheckUpdate) {
    if (window.updateDownloadedState) {
      btnCheckUpdate.innerHTML = dict.update_btn_restart;
    } else {
      btnCheckUpdate.innerHTML = dict.check_updates;
    }
  }

  renderUpdateStatus();
}

function renderUpdateStatus() {
  const btnCheckUpdate = $('btnCheckUpdate');
  const updateStatusText = $('updateStatusText');
  if (!updateStatusText || !window.lastUpdateStatus) return;

  const lang = settings.lang || 'tr';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.tr;

  switch (window.lastUpdateStatus.status) {
    case 'checking':
      updateStatusText.textContent = dict.update_checking;
      if (btnCheckUpdate) btnCheckUpdate.disabled = true;
      break;
    case 'available':
      updateStatusText.textContent = dict.update_available.replace('vVERSION', window.lastUpdateStatus.version);
      if (btnCheckUpdate) btnCheckUpdate.disabled = true;
      break;
    case 'not-available':
      updateStatusText.textContent = dict.update_not_available;
      if (btnCheckUpdate) btnCheckUpdate.disabled = false;
      break;
    case 'downloading':
      updateStatusText.textContent = dict.update_downloading.replace('%PERCENT%', window.lastUpdateStatus.percent + '%');
      if (btnCheckUpdate) btnCheckUpdate.disabled = true;
      break;
    case 'installing':
      updateStatusText.textContent = dict.update_installing;
      if (btnCheckUpdate) {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.textContent = dict.update_btn_installing;
      }
      break;
    case 'downloaded':
      window.updateDownloadedState = true;
      updateStatusText.textContent = dict.update_downloaded;
      if (btnCheckUpdate) {
        btnCheckUpdate.disabled = false;
        btnCheckUpdate.textContent = dict.update_btn_restart;
      }
      break;
    case 'error':
      updateStatusText.textContent = dict.update_error.replace('MSG', window.lastUpdateStatus.message ? window.lastUpdateStatus.message.split('\n')[0] : 'Unknown error');
      if (btnCheckUpdate) {
        btnCheckUpdate.disabled = false;
        btnCheckUpdate.textContent = dict.check_updates;
      }
      break;
  }
}

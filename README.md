# Game-Time Tracker 🎮🕰️

Game-Time Tracker is a modern, high-performance desktop application built with **Electron** and vanilla JavaScript/CSS that automatically tracks your gaming sessions. It runs silently in the background, monitors your active game processes on Windows, and dynamically handles idle time and Alt-Tab detection to ensure your recorded playtimes are 100% accurate.

Featuring a premium **"Liquid Glass" (glassmorphic)** user interface, customizable sidebar context menus, and native Windows integrations, it is the ultimate tool for keeping track of your gaming history.

---

## 🌟 Key Features

- **Automated Game Tracking:** Automatically detects when a game is launched and starts the stopwatch timer. When the game process exits, it automatically stops and saves the session.
- **Smart AFK (Away From Keyboard) Detection:** Uses native Windows API integration to detect system-wide keyboard and mouse inactivity. If you step away from your PC for longer than a configurable threshold (default: 10 minutes), the timer automatically pauses and resumes when you return.
- **Alt-Tab / Background Window Detection:** Monitors which window currently has focus. If you Alt-Tab out of your game for more than a set time limit (default: 2 minutes), the session is paused until you click back into the game.
- **System Tray Integration:** Minimize the app to the system tray. The tray tooltip dynamically updates to show which game is running and how long you've been playing.
- **Detailed History & Statistics:** View historical sessions with timestamps, durations, daily playtimes, personal records, and session count statistics.
- **Liquid Glass UI & Design:** A state-of-the-art dark-mode interface featuring vibrant gradients, glassmorphism blur effects (`backdrop-filter`), smooth hover animations, and custom-designed inline SVG icons replacing standard emojis.
- **Custom HTML Context Menu:** Right-click any game card in the sidebar to open a premium context menu to launch the game, open its folder, change its accent color, rename it, reset its icon, or delete it.
- **Auto Game-Executable Detection (Scan List):** The app automatically scans currently running processes. Adding games directly from this list automatically saves their executable paths, enabling instant launching and file location tracking.
- **Native Game Icon Extraction:** Automatically extracts the high-resolution original icon of the game executable (`.exe`) via the Windows shell to display in the dashboard.
- **Anti-Cheat Compatibility (Shell Launching):** Spawns games directly via Windows Shell (`explorer.exe`) to detach processes from the Node.js/Electron tree, ensuring compatibility with modern anti-cheat systems (e.g., Easy Anti-Cheat, BattlEye).
- **Single-Instance Application Lock:** Prevents multiple instances of the app from running simultaneously. Launching a new instance focuses the already running dashboard.

---

## 🛠️ How It Works Under the Hood

The application relies on several core tracking mechanisms to monitor games and system activity on Windows:

1. **Process List Scanning (`tasklist`):**
   Every **3 seconds**, Electron scans running processes using the Windows utility `tasklist`. This determines whether any of your added game executable files (e.g., `cyberpunk2077.exe`) are currently active.
   - *CPU Optimization:* If no games are currently set to be watched, process scanning is dynamically paused to save CPU cycles.

2. **PowerShell Window & Idle Watcher:**
   A lightweight, persistent PowerShell script runs in the background. Using `.NET / PInvoke` calls to native Windows DLLs (`user32.dll`), it checks the system state every **1 second**:
   - `GetForegroundWindow` & `GetWindowThreadProcessId`: Retrieves the process name of the active foreground window.
   - `GetLastInputInfo`: Measures the duration (in milliseconds) since the last keyboard or mouse event across the entire system.

3. **Immediate Session Saving:**
   When a game is launched, a 30-second launch grace period is active to accommodate startup times. Once the game process is detected running, the grace period is instantly skipped, allowing the tracker to save/pause the session within 3 seconds of closing or ALT+TAB.

---

## 🚀 Getting Started

### Prerequisites

- **Operating System:** Windows 10/11 (required for PowerShell/Win32 API components)
- **Runtime:** [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)

### Installation

1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/ertandev/Game-Time-Tracker.git
   cd Game-Time-Tracker
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:
```bash
npm start
```

### Packaging / Building Yükleyici (Installer)

To build a standalone, offline English-only NSIS Windows installer:
```bash
npm run dist
```
The compiled setup executable (`GameTime-Tracker-Setup-1.0.0.exe`) will be generated inside the `dist` directory.

---

## ⚙️ Configuration & Customization

You can fine-tune tracking behaviors via the **Global Settings** modal inside the app:

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| **AFK Timeout** | 10 minutes | Time of inactivity before the session is auto-paused. Set to **Off** to disable. |
| **Alt-Tab Timeout** | 2 minutes | Time allowed outside the game window before auto-pausing. Set to **Off** to disable. |
| **Auto-Save on Close** | Enabled | If enabled, the session is saved automatically when you close the game. If disabled, the session is paused instead. |

---

## 📁 Project Structure

The project has been refactored into modular, clean scripts to separate concerns and prevent monolithic file growth:

```text
Game-Time-Tracker/
├── dist/                 # Compiled distribution files and setup installer
├── index.html            # Main frontend HTML5 view & structure
├── style.css             # Main styling, layouts, custom scrollbars, animations, context menu styles
├── main.js               # Electron main process (OS integration, process launcher, tray menu, single-instance lock)
├── preload.js            # Secure IPC gateway connecting frontend and main process
├── app.js                # Application bootstrapper (init, event binding, modal overlays)
├── i18n.js               # Localization dictionary (English & Turkish) and translation utilities
├── state.js              # State manager (LocalStorage read/write, game lists, historical logs)
├── timer.js              # Stopwatch, active session tracker, grace period handling
├── renderer.js           # UI drawer (sidebar lists, stats cards, active session render, custom context menu)
├── settings.js           # Settings manager & layout updates
├── installer.nsh         # Custom NSIS script containing Windows registry and shortcut configs
├── package.json          # Node scripts, dependency versions, electron-builder setup
└── .gitignore            # Files excluded from git
```

---

## 🔒 Technologies Used

- **Framework:** Electron (v42+)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6 Modules)
- **System Integration:** Windows PowerShell Scripting (System-wide Hooking & PInvoke)
- **Packaging:** electron-builder with NSIS Custom Scripting

---

## 📝 License

This project is licensed under the ISC License. See the [package.json](file:///c:/Users/v0rteX/Desktop/Game-Time%20Tracker/package.json) file for details.

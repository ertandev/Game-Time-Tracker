# Game-Time Tracker 🎮🕰️

Game-Time Tracker is a modern, high-performance desktop application built with **Electron** and vanilla JavaScript/CSS that automatically tracks your gaming sessions. It runs silently in the background, monitors your active game processes on Windows, and dynamically handles idle time and Alt-Tab detection to ensure your recorded playtimes are 100% accurate.

---

## 🌟 Key Features

- **Automated Game Tracking:** Automatically detects when a game is launched and starts the stopwatch timer. When the game process exits, it automatically stops and saves the session.
- **Smart AFK (Away From Keyboard) Detection:** Uses native Windows API integration to detect system-wide keyboard and mouse inactivity. If you step away from your PC for longer than a configurable threshold (default: 10 minutes), the timer automatically pauses and resumes when you return.
- **Alt-Tab / Background Window Detection:** Monitors which window currently has focus. If you Alt-Tab out of your game for more than a set time limit (default: 2 minutes), the session is paused until you click back into the game.
- **System Tray Integration:** Minimize the app to the system tray. The tray tooltip dynamically updates to show which game is running and how long you've been playing.
- **Detailed History & Statistics:** View historical sessions with timestamps, durations, daily playtimes, personal records, and session count statistics.
- **Modern Premium Design:** Built with a clean, responsive dark-mode dashboard featuring vibrant colors, smooth transitions, custom visual indicators, and a custom frameless window titlebar.

---

## 🛠️ How It Works Under the Hood

The application relies on two core tracking mechanisms to monitor games and system activity on Windows:

1. **Process List Scanning (`tasklist`):**
   Every **3 seconds**, Electron scans running processes using the Windows utility `tasklist`. This determines whether any of your added game executable files (e.g., `cyberpunk2077.exe`) are currently active.

2. **PowerShell Window & Idle Watcher:**
   A lightweight, persistent PowerShell script runs in the background. Using `.NET / PInvoke` calls to native Windows DLLs (`user32.dll`), it checks the system state every **1 second**:
   - `GetForegroundWindow` & `GetWindowThreadProcessId`: Retrieves the process name of the active foreground window.
   - `GetLastInputInfo`: Measures the duration (in milliseconds) since the last keyboard or mouse event across the entire system.
   
   This enables the application to react instantly to Alt-Tab actions and user inactivity.

---

## 🚀 Getting Started

### Prerequisites

- **Operating System:** Windows (required for PowerShell/Win32 API components)
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

```text
Game-Time-Tracker/
├── node_modules/         # Package dependencies (ignored in git)
├── index.html            # Core frontend UI structure
├── style.css             # Main styling, layout, custom scrollbars and dark theme
├── app.js                # Core frontend client-side application logic (state, UI rendering, event listeners)
├── main.js               # Electron main process (OS integrations, tray menu, background PowerShell watcher)
├── preload.js            # Electron IPC gateway for secure front-to-back communication
├── package.json          # Node dependencies & launch scripts
├── package-lock.json     # Locked dependency versions
└── .gitignore            # Files excluded from git tracking
```

---

## 🔒 Technologies Used

- **Framework:** Electron (v42+)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **System Integration:** Windows PowerShell Scripting (System-wide Hooking)

---

## 📝 License

This project is licensed under the ISC License. See the [package.json](file:///c:/Users/v0rteX/Desktop/Game-Time%20Tracker/package.json) file for details.

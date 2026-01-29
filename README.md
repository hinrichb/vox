<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="Vox Logo" width="128" height="128">
</p>

<h1 align="center">Vox</h1>

<p align="center">
  <strong>Voice to text, reimagined.</strong>
</p>

<p align="center">
  A fast, native desktop app for speech recognition with AI-powered text processing.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#building-from-source">Building</a> •
  <a href="#license">License</a>
</p>

---

## The Problem

Dictating text on a computer is often cumbersome:

- **Cloud services** are slow, expensive, and raise privacy concerns
- **Built-in speech recognition** is unreliable and hard to activate
- **Professional software** costs hundreds and is bloated with features
- **No AI integration** — transcribed text still needs manual editing

## The Solution

**Vox** solves these problems with an elegant approach:

1. **Global hotkey** — Press `Option+M` (Mac) or `Alt+M` (Windows) from anywhere
2. **Local transcription** — Whisper.cpp runs completely offline on your machine
3. **AI modes** — Automatic grammar correction, translation, or custom prompts
4. **Instant clipboard** — Result is immediately ready to paste

---

## Features

| Feature | Description |
|---------|-------------|
| **Global Hotkey** | Start/stop recording from any app |
| **Offline Transcription** | Whisper.cpp — no cloud, no per-minute costs |
| **Multi-Language** | Auto-detect or manually select (EN, DE, FR, ES, ...) |
| **AI Modes** | Grammar fix, translation, or custom prompts |
| **Statistics** | Track your recordings, words, and characters |
| **Background App** | Runs quietly without cluttering your Dock |

### Supported AI Models

Via [OpenRouter](https://openrouter.ai):

- GPT-4o / GPT-4o Mini
- Claude 3.5 Sonnet
- Gemini Flash 1.5
- Llama 3.1 70B

---

## Installation

### Download

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| **macOS** (Apple Silicon) | [Download DMG](https://github.com/hinrichb/vox/releases/latest/download/Vox_0.1.1_aarch64.dmg) |
| **macOS** (Intel) | Coming soon |
| **Windows** | Coming soon |

### First Launch (macOS)

1. Open the `.dmg` file
2. Drag **Vox** to your Applications folder
3. **Important:** Open Terminal and run:
   ```bash
   xattr -cr /Applications/Vox.app
   ```
4. Double-click to open Vox
5. Grant microphone permission when prompted

> **Note:** The `xattr` command is required because the app is not signed with an Apple Developer certificate. This removes the macOS quarantine flag that would otherwise block the app.

---

## Usage

### Basic Workflow

1. Press **Option+M** (Mac) or **Alt+M** (Windows) to start recording
2. Speak your text
3. Press the hotkey again to transcribe
4. Text is automatically copied to your clipboard
5. Paste anywhere with **Cmd+V** / **Ctrl+V**

### Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Start/Stop Recording | `Option + M` | `Alt + M` |
| Cancel Recording | `ESC` | `ESC` |

*The hotkey can be customized in Settings.*

### AI Modes

1. **Normal** — Pure transcription, no AI processing
2. **Fix Grammar** — Corrects spelling and grammar mistakes
3. **Translate to English** — Translates any language to English
4. **Custom** — Create your own prompts for any text transformation

> **Note:** AI modes require an [OpenRouter API key](https://openrouter.ai/keys). Normal mode works completely offline.

---

## Building from Source

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Rust** (for Tauri)
- **CMake** and C++ compiler (for Whisper.cpp)

#### macOS
```bash
xcode-select --install
```

#### Windows
- Visual Studio Build Tools with C++ workload
- Git

### Build Steps

```bash
# Clone the repository
git clone https://github.com/hinrichb/vox.git
cd vox

# Install dependencies
pnpm install

# Setup Whisper (compiles whisper.cpp and downloads the model)
pnpm setup          # macOS/Linux
pnpm setup:win      # Windows (PowerShell)

# Development
pnpm tauri dev

# Production build
pnpm tauri build
```

Build output: `src-tauri/target/release/bundle/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   React/Next.js Frontend                     │
│           (Settings, Overlay UI, Audio Capture)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC/Events
┌──────────────────────────▼──────────────────────────────────┐
│                 Tauri Runtime (Rust)                         │
│     • Global Hotkey Handler                                  │
│     • Window Management                                      │
│     • Clipboard Integration                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Whisper  │    │OpenRouter│    │  System  │
    │   .cpp   │    │   API    │    │  (Mic,   │
    │ (local)  │    │(optional)│    │Clipboard)│
    └──────────┘    └──────────┘    └──────────┘
```

### Tech Stack

- **Frontend:** React 19, Next.js 16, Tailwind CSS
- **Backend:** Tauri 2, Rust
- **Transcription:** Whisper.cpp (ggml-base model)
- **AI:** OpenRouter API

---

## License

MIT

---

<p align="center">
  <sub>Built with Tauri, React, Next.js, and Whisper.cpp</sub>
</p>

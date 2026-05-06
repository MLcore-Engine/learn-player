# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LEP (Learn English Player) is an Electron desktop app for learning English through video. Users play videos with subtitles, select words/sentences for AI-powered explanations (via StepFun LLM API), and review vocabulary through a spaced repetition system (SRS). The UI is in Chinese; the learning content is English.

## Development Commands

```bash
npm run dev              # Start React dev server + Electron concurrently
npm run build            # Build web app + copy Electron files to build/
npm run build:electron   # Full Electron build (web + main process files)
npm run package          # Full packaging with electron-builder
npm run build:mac        # macOS package (dmg/zip)
npm run build:win        # Windows package (nsis/portable)
npm run debug            # Electron with inspector on port 5858
```

There is no test suite configured. No jest/vitest/mocha.

## Architecture

### Process Model (Electron)

```
Main Process (main.js)
  ├── IPC handlers (main/ipc/index.js) — all 50+ handlers in one file
  ├── SQLite database (better-sqlite3)
  ├── HTTP video server (main/services/videoServer.js, port 6459)
  ├── FFmpeg wrapper (main/media/ffmpeg.js)
  └── Frame extraction for OCR (main/videoFrameExtractor.js)

    ↕ IPC via preload.js bridge (channel whitelist)

Renderer Process (React, src/)
  ├── Containers — orchestrate state (VideoContainer, OCRContainer, AIContainer)
  ├── Components — presentational (VideoPlayer, LearningAssistant, LearningAgent, etc.)
  ├── Services — business logic & API calls (aiService, highlightService, etc.)
  ├── Hooks — feature-specific (useApiKey, useExplainFlow, useVideoJsPlayer, etc.)
  └── Context + Reducers — state management
```

### State Management Pattern

State follows a strict layered pattern: **Reducer -> Context/Provider -> Custom Hook -> Component**.

- **Reducers** (`src/reducers/index.js`): `videoReducer`, `timeStatsReducer`, `aiReducer`, `apiKeyReducer`. All state changes go through dispatch.
- **Contexts** (`src/contexts/AppContext.js`): Each reducer has a paired Context and Provider.
- **Providers** (`src/providers/index.js`): Composed as `VideoProviders` (Video + TimeStats), `AIProviders`, `AppProviders` (ApiKey + Error).
- **Hooks** (`src/hooks/`): Components access state via custom hooks (e.g., `useApiKey`, `useVideo`), never raw Context.

### IPC Communication

- `preload.js` exposes a whitelisted set of IPC channels to the renderer.
- `src/services/ipcClient.js` provides typed wrapper methods for renderer-side calls.
- `main/ipc/index.js` (68KB) contains all handler implementations — video ops, AI proxy, DB queries, file ops, study planning.
- API keys are encrypted (AES-256-CBC) in electron-store.

### AI Integration

- LLM provider: **StepFun** (阶跃星辰) Chat Completions API.
- `src/services/aiService.js` handles prompt construction with system prompts and few-shot examples (focused on KK phonetic transcription).
- `src/services/aiConfigService.js` resolves config: env vars -> electron-store -> defaults.
- AI requests are proxied through the main process to avoid CORS.

### Video & Subtitles

- video.js for playback; HTTP range-request server for streaming.
- Subtitle parsing via the `subtitle` npm package; supports external .srt/.vtt files.
- OCR mode: FFmpeg extracts frames -> server-side vision API for text recognition.

### Spaced Repetition (SRS)

- `src/services/spacedRepetitionService.js`: scheduling algorithm.
- `src/services/highlightService.js`: CRUD for highlight/vocabulary records in SQLite.
- `src/components/HighlightCard.jsx`: flip-card review UI.

## Key Environment Variables

```
STEP_API_KEY / REACT_APP_STEP_API_KEY   # StepFun API key
STEP_API_URL / REACT_APP_STEP_API_URL   # StepFun API endpoint
PORT=3000                                # React dev server port
```

## Build Configuration

- `config-overrides.js` customizes CRA webpack: sets Node.js core module fallbacks to `false`, uses relative public path in production.
- Native modules (`better-sqlite3`, `@ffmpeg-installer/ffmpeg`) are ASAR-unpacked via electron-builder config in package.json.
- `postinstall` runs `electron-builder install-app-deps` then `npm prune --production`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LEP (Learn English Player) is an Electron.js-based desktop video player for language learning. It supports video playback with interactive subtitles, AI-powered explanations, vocabulary learning with spaced repetition, and learning analytics.

## Commands

```bash
# Development
npm run dev              # Start React dev server + Electron concurrently
npm run start-react      # Start React dev server only (port 3000)
npm run start-electron   # Start Electron with dev server URL

# Build
npm run build            # Build React app and copy Electron files
npm run build:mac        # Build macOS DMG
npm run build:win        # Build Windows installer
npm run build:linux      # Build Linux AppImage

# Other
npm run clean            # Remove build and dist directories
npm run analyze          # Analyze bundle size with source-map-explorer
```

## Architecture

### Process Model
- **Main Process** (`main.js`): Electron main process, handles window creation, native dialogs, database operations, file system access, and auto-updates
- **Preload Script** (`preload.js`): Bridges main and renderer processes via `contextBridge`, exposes whitelisted IPC channels through `window.electronAPI`
- **Renderer Process** (`src/`): React application with Material-UI components

### Main Process Structure (`main/`)
- `ipc/`: IPC handler registration for all main process operations
- `services/videoServer.js`: Local HTTP server for video streaming (handles range requests)
- `videoFrameExtractor.js`: FFmpeg-based frame extraction for OCR

### Renderer (React) Structure (`src/`)
- **State Management**: Context + useReducer pattern
  - `reducers/`: State update logic (video, timeStats, ai, ocr, apiKey)
  - `contexts/`: Context providers for each domain
  - `hooks/`: Custom hooks for accessing context state
- **Components**: Material-UI based, receive state/callbacks via props
- **Services**:
  - `aiService.js`: LLM API integration for explanations
  - `ipcClient.js`: Wrapper for electron IPC calls
  - `spacedRepetitionService.js`: SM-2 algorithm for vocabulary review
  - `learningAnalyticsService.js`: Learning pattern analysis

### Database
SQLite via `better-sqlite3`, stored in user data directory:
- `global_usage`: Total learning time
- `daily_usage`: Per-day session time
- `video_progress`: Playback position per video
- `ai_queries`: Cached AI explanations (indexed by query)
- `vocabulary`: Words with SM-2 spaced repetition fields
- `study_plans`: Structured learning plans

### IPC Communication
All renderer-to-main communication uses whitelisted channels defined in `preload.js`:
- `invoke` channels: Request-response pattern (e.g., `performAIRequest`, `getWatchTime`)
- `send` channels: Fire-and-forget (e.g., `updateWatchTime`)
- `receive` channels: Main-to-renderer events (e.g., `videoSelectedFromMenu`, `ai-stream`)

Rate limiting (5 requests/second) is applied per channel.

### Video Playback
- Video.js player component
- Local HTTP streaming server with range request support
- Automatic conversion of mkv/avi to mp4 via FFmpeg
- Custom `lep://` protocol for secure local file access

## Key Patterns

### State Modification
All state changes go through reducers with action objects. Components are pure presentational; business logic lives in hooks and services.

### AI Integration
- Configurable API endpoint and model via settings
- Streaming responses supported via `performAIStream`
- Query caching in SQLite to avoid redundant API calls

### Learning Agent
The LearningAgent component provides:
- Vocabulary extraction from AI queries
- Spaced repetition review cards
- Study plan creation and tracking
- Learning analytics and reports

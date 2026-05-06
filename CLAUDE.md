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
npx tsc --noEmit         # Type-check renderer (src/) without emitting
```

There is no test suite configured.

## Language Split

- **Renderer (`src/`)**: TypeScript, full `strict: true`. Every `.ts`/`.tsx`.
- **Main process (`main.js`, `preload.js`, `main/**/*.js`)**: Plain JavaScript. The boundary type is described in `src/types/ipc.ts` (`ElectronAPI` interface) which must stay in sync with `preload.js` and the `ipcMain.handle(...)` return shapes in `main/ipc/index.js`.

## Architecture

### Process Model (Electron)

```
Main Process (main.js — JS)
  ├── IPC handlers (main/ipc/index.js)
  ├── SQLite database (better-sqlite3)
  ├── HTTP video server (main/services/videoServer.js, port 6459)
  ├── FFmpeg wrapper (main/media/ffmpeg.js)
  └── Frame extraction for OCR

    ↕ IPC via preload.js bridge (channel whitelist)

Renderer Process (React, src/ — TS)
  ├── types/ — ElectronAPI / Highlight / State / AI / Plan boundary contracts
  ├── services/ — aiService, highlightService, studyPlanService, ipcClient
  ├── hooks/ — useExplainFlow, useApiKey, useTimeStats, useVideoJsPlayer, …
  ├── reducers/ — discriminated-union reducers
  ├── contexts/ — AppContext with 5 typed contexts
  ├── containers/ — VideoContainer, OCRContainer, AIContainer
  └── components/ — SidePanel, VideoPlayer, LearningAssistant, tabs/*, …
```

### State Management Pattern

State follows: **Reducer → Context/Provider → Custom Hook → Component**.

- **Reducers** (`src/reducers/index.ts`): `videoReducer`, `timeStatsReducer`, `aiReducer`, `apiKeyReducer`. Actions are discriminated unions defined in `src/types/state.ts`.
- **Contexts** (`src/contexts/AppContext.tsx`): 5 contexts (Video / TimeStats / AI / ApiKey / Error). Each exposes `ContextValue = State & Actions`.
- **Providers** (`src/providers/index.tsx`): Composed as `VideoProviders` (Video + TimeStats), `AIProviders`, `AppProviders` (ApiKey + Error).
- **Hooks** (`src/hooks/`): Components access state via custom hooks (`useApiKey`, `useVideo`, etc.). Hooks throw if used outside their Provider.

### IPC Communication

- `preload.js` exposes a whitelisted set of IPC channels to the renderer.
- `src/services/ipcClient.ts` provides typed wrapper methods over `window.electronAPI`. Channel names centralized in `IPC_CHANNELS`.
- `main/ipc/index.js` contains all handler implementations — video ops, AI proxy, DB queries, file ops, study planning, highlights CRUD/SRS/stats.
- API keys are encrypted (AES-256-CBC) in electron-store.

**When adding a new IPC channel**: update all four places: (1) `main/ipc/index.js` handler, (2) `preload.js` whitelist + explicit method, (3) `src/services/ipcClient.ts` method + `IPC_CHANNELS`, (4) `src/types/ipc.ts` `ElectronAPI` interface.

### Single Data Source: `highlights`

The `highlights` SQLite table is the canonical store for every learning artifact. Every AI explanation UPSERTs a row (`UNIQUE(video_path, original_text)` triggers `query_count++`). Review (SM-2) updates the SRS columns on the same row.

Deprecated tables removed: `ai_queries`, `vocabulary`, `vocabulary_reviews`, `query_history`. Schema: see `main.js` `CREATE TABLE highlights` and the `Highlight` interface in `src/types/highlight.ts`.

### AI Integration

- LLM provider: **StepFun** (阶跃星辰) Chat Completions API.
- `src/services/aiService.ts` handles prompt construction with system prompts and few-shot examples (KK phonetic transcription).
- `src/services/aiConfigService.ts` resolves config: env vars → electron-store → defaults.
- AI requests proxied through the main process to avoid CORS.
- Stream explanation uses a generation counter in `useExplainFlow` so stale chunks (after "返回字幕" or language switch) are discarded without aborting the underlying stream.

### Video & Subtitles

- video.js for playback; HTTP range-request server for streaming.
- Subtitle parsing via the `subtitle` npm package; external .srt/.vtt supported.
- OCR mode: FFmpeg extracts frames → server-side vision API (StepFun multimodal) for text recognition.
- video.js official TS types are partial; a handful of `as unknown as {…}` casts exist in `useVideoJsPlayer.ts` and `VideoPlayer.tsx` around `player.tech()`, `currentTime()`, `textTracks()`.

### Spaced Repetition (SRS)

- Schedule + review writes: `main/ipc/index.js` `submitReview` handler runs SM-2 directly on `highlights`.
- Frontend CRUD: `src/services/highlightService.ts`.
- Review UI: `src/components/HighlightCard.tsx` (flip-card) + `src/components/tabs/ReviewTab.tsx` (driver).

### Sidebar Tabs (5)

Tab index convention (see `src/components/SidePanelTabs.tsx`):

| # | Name | File |
|---|---|---|
| 0 | 解释 | `containers/AIContainer.tsx` → `components/LearningAssistant.tsx` |
| 1 | 复习 | `components/tabs/ReviewTab.tsx` |
| 2 | 统计 | `components/tabs/StatsTab.tsx` |
| 3 | 计划 | `components/tabs/PlanTab.tsx` |
| 4 | 总结 | `components/tabs/SummaryTab.tsx` |

## TypeScript Conventions

- `tsconfig.json` runs `strict: true`, `allowJs: false` for renderer.
- Ambient declarations (CSS imports, CRA env) live in `src/react-app-env.d.ts`.
- `window.electronAPI` is declared optional in `src/types/global.d.ts` — callers null-check or use `ipcClient.isAvailable()`.
- Reducer actions use `as const` discriminated unions in `src/types/state.ts`.
- Prefer explicit `| null` / `| undefined` in interface definitions. The codebase never uses implicit `any`; zero `@ts-ignore` and zero `any` casts.
- When a library has incomplete typings (e.g. video.js), use narrow `as unknown as { specificMethod: ... }` casts at the call site, not file-wide.

## Key Environment Variables

```
STEP_API_KEY / REACT_APP_STEP_API_KEY   # StepFun API key
STEP_API_URL / REACT_APP_STEP_API_URL   # StepFun API endpoint
PORT=3000                                # React dev server port
```

## Build Configuration

- `config-overrides.js` customizes CRA webpack: Node.js core module fallbacks set to `false`, relative public path in production.
- Native modules (`better-sqlite3`, `@ffmpeg-installer/ffmpeg`) are ASAR-unpacked via electron-builder config in `package.json`.
- `postinstall` runs `electron-builder install-app-deps` then `npm prune --production`.

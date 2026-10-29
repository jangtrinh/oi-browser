# Session Handoff — Ổi Browser (`berry-browser`)
**Updated**: 2026-10-29T15:19:00+07:00
**Branch**: `main` (pushed to `origin/main`)
**Live Dev Server**: `http://127.0.0.1:4104` (`PORT=4104 npm start`)
**Test Suite**: `48/48` tests passing (`npm test` -> `test/berry-browser.test.js` + `test/spec-002.test.js` .. `test/spec-008.test.js`)

## What Was Accomplished
1. **All 8 Spec-Driven Packages (`Spec 001` – `Spec 008`) Shipped & Verified**:
   - **Spec 001 (`c557818`)**: Zero-Placeholder Runtime across all 30 routes.
   - **Spec 002 (`src/server/domains/spec-002-chat-loop.js`)**: 48 `chat:*`, `context:*`, `tokens:*` channels (turn abort/steer/retry/edit, tool permission rules, chunked attachment staging, session fork/delete/compaction, system prompt preview, in-session text find).
   - **Spec 003 (`src/server/domains/spec-003-syncedfs-artifacts.js`)**: 44 `synced-fs:*`, `fs:*`, `artifact-*`, `table:*`, `report:*` channels (`.versions/` snapshots, `.trash/` recovery, FTS5 search, artifact KV store, CSV/XLSX/PDF exports).
   - **Spec 004 (`src/server/domains/spec-004-companions-skills.js`)**: 32 `companions:*`, `skills:*`, `onboarding:*` channels (companion CRUD + `COMPANION.md` sync, Skills Forge `SKILL.md` disk CRUD).
   - **Spec 005 (`src/server/routine-cron-daemon.js`, `src/server/domains/spec-005-routines-cron.js`)**: 14 `routines:*` channels + `RoutineCronDaemon` background cron & one-off scheduler (`routine_runs`, `routine_one_offs`).
   - **Spec 006 (`src/server/mcp-client-bridge.js`, `src/server/domains/spec-006-mcp-databases.js`)**: 24 `integration:*`, `agent-db:*` channels (live Stdio & HTTP JSON-RPC 2.0 `McpClientBridge`, multi-database `.sqlite` provisioning with full DDL/DML, grants & companion access).
   - **Spec 007 (`src/server/domains/spec-007-meetings-voice.js`)**: 38 `audio:*`, `meeting:*`, `voiceCommand:*`, `quick-pill:*`, `gia-activity-memory:*` channels (meeting search/delete/post-meeting chat, voice & quick-pill dispatch, SQLite `activity_events` search & deletion).
   - **Spec 008 (`src/server/domains/spec-008-vault-shell-evals.js`)**: 52 `passwords:*`, `profile:*`, `history:*`, `bookmark:*`, `downloads:*`, `sandbox:reset`, `benchmark:*` channels (AES-256-GCM password vault + CSV import, multi-profile/history/bookmarks/downloads CRUD, sandbox reset, interactive local benchmark runner with transcripts & step logs).
2. **Unified Server & Client IPC Wiring**:
   - Wired all 7 domain services into `src/server/berry-http-server.js` (`POST /api/ipc`) and `src/client/berry-electron-queries.js` (`dispatchServerIpc`).

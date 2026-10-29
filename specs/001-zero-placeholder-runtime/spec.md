# SPEC 001 · Ổi Browser · ZPR — Zero-Placeholder Runtime & Full IPC-to-SQLite Wiring

**Feature Branch**: `main` (Spec-Driven Delivery `001-zero-placeholder-runtime`)
**Created**: 2026-10-29
**Status**: Approved for Execution
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)

---

## 1. Problem & Telemetry Evidence

A full 30-route Playwright & IPC audit of **Ổi Browser** (`5dd10fd`) revealed **9 feature areas** where the SvelteKit 5 UI either renders error/hang states due to missing IPC handlers or displays static hardcoded mocks instead of reading/mutating the real SQLite database (`.berry-data/workspace.sqlite`), Karpathy-Wiki filesystem (`.berry-data/karpathy-wiki/`), and OpenJarvis CLI/Telemetry engines:

| ID | Surface / Route | Observed Defect (Pre-Spec) | Root Cause in Codebase |
|---|---|---|---|
| **G1** | `/settings/memory` (`Memory`) | Global & Companion memory show `"Couldn't load memory. \| Retry"`; Backfill & Reflection hang forever at `"Calculating…"`. | `berry-electron-queries.js` lacks handlers for `memory:read-curated-file`, `memory:write-curated-file`, `memory:backfill:get-status`, `memory:backfill:estimate`, `memory:reflect-only:estimate`, `memory:backfill:start`, `memory:reflect-only:start`, and `memory:purge`. |
| **G2** | `/settings/benchmarks` (`Benchmarks & Evals`) | Crashes with `"Cannot read properties of undefined (reading 'runs') \| Retry"`. | `CXSfSeMt.js` expects `query:benchmark:listRuns` to return `{ success: true, page: { runs, count, page, pageSize, totalPages } }` and `query:benchmark:listPackages` to return `{ success: true, packages }`, wired to `/api/telemetry` & `cliStatus.recentRuns`. |
| **G3** | `/settings/sandbox`, `/settings/storage`, `/settings/about`, `/settings/ai-permissions`, `/settings/search-engine` | `/settings/sandbox` shows `"The sandbox isn't running"`; `/settings/storage` shows blank usage; `/settings/about` shows blank version. | Missing IPC handlers for `sandbox:get-boot-status`, `chat-permissions:get-sandbox-mode`, `chat-permissions:get-mode`, `chat-permissions:list-rules`, `storage:get-info`, `syncedFs:storageUsage`, `app:get-version`, `search-engine:get`, `browser:is-default`. |
| **G4** | `/library` (`Library` & Karpathy-Wiki Reader) | `knowledge:read-file` returns a 1-line placeholder string (`"Dữ liệu bộ nhớ Karpathy-Wiki được đồng bộ..."`) instead of reading disk; `knowledge:read-report` always returns `artifacts[0]`. | `berry-electron-queries.js:99-106` never calls `GET /api/memory/file?path=...` and ignores `payload.agentId` / `payload.sandboxPath`. |
| **G5** | `/databases` (`Agent Databases`) | `agent-db:list-databases` and `agent-db:get-schema` return 3 hardcoded fake tables with 3 fake columns; cannot inspect real SQLite schema or run SQL queries. | `berry-electron-domains.js:65-83` uses static arrays instead of querying `GET /api/databases` (real `sqlite_master` + `PRAGMA table_info` + row counts from `workspace.sqlite`). |
| **G6** | `/timeline` & `/settings/activity-memory` (`Timeline`) | `activity-memory:get-summary` & `get-sessions-for-day` return hardcoded strings; `activity-memory:get-sessions-for-range` is unhandled. | `berry-electron-domains.js:84-105` uses static text instead of synthesizing live activity sessions, domain distribution, and todos from `state.messages`, `state.tabs`, `state.routines`, and `state.cliStatus.recentRuns`. |
| **G7** | `/routines` (`Scheduled Routines`) | `routines:listRuns` always returns `runs: []`; creating, toggling, or deleting routines via IPC does not persist to SQLite. | `berry-electron-queries.js:178` hardcodes `runs: []`; `berry-http-server.js` lacks `PATCH`/`DELETE` on `/api/routines`. |
| **G8** | `/apps` & `/settings/integrations` (`Connected Apps & Custom MCP`) | `CONNECTED_APPS` is a frozen in-memory constant; connecting, disconnecting, or adding a custom MCP server does not persist. | `SqliteWorkspaceStore` has no `integrations` table and `berry-http-server.js` has no `/api/integrations` endpoint. |
| **G9** | `/meetings` & `/settings/transcription` (`Meetings & Audio`) | `audio:start-recording`, `audio:stop-recording`, `transcription:get-session-state`, `audio:list-input-devices` are unwired stubs. | `berry-electron-queries.js:107-108` only returns `{ status: "idle" }` without wiring recording completion to `POST /api/meetings`. |

---

## 2. Functional Requirements (`FR-001` … `FR-009`)

### FR-001: Real Curated Memory, Backfill & Dream Reflection (`/settings/memory`)
1. `invoke("memory:read-curated-file", { scope })`:
   - When `scope === "global"` or `scope?.scope === "global"`, fetch `GET /api/memory/file?path=PROFILE.md` and return `{ content }`.
   - When `scope?.scope === "companion"`, fetch `GET /api/memory/file?path=companions/${scope.companionId}/COMPANION.md` and return `{ content }`.
2. `invoke("memory:write-curated-file", { scope, content })` / `invoke("memory:update-curated-file", ...)`:
   - Persist via `POST /api/memory/file` and re-index in `WikiFtsIndex`.
3. `invoke("memory:backfill:get-status")`:
   - Return `{ activeRunId: null, latestProgress: null }`.
4. `invoke("memory:backfill:estimate")`:
   - Return `{ messageCount: state.messages.length, chatCount: state.companions.length, estimatedCredits: 0 }`.
5. `invoke("memory:reflect-only:estimate")`:
   - Return `{ totalDays: Math.max(1, state.memoryFiles.length), observationCount: state.messages.length, estimatedCredits: 0 }`.
6. `invoke("memory:backfill:start")` & `invoke("memory:reflect-only:start")`:
   - Call `POST /api/memory/dream` to consolidate observations into `COMPANION.md`, refresh `bridge.fetchServerState()`, and return `{ runId: "dream-" + Date.now(), status: "completed" }`.
7. `invoke("memory:purge")`:
   - Call `POST /api/memory/purge` to reset `observations/` while preserving core companion profiles, then refresh state.

### FR-002: Real Benchmarks & OpenJarvis Telemetry (`/settings/benchmarks`)
1. `invoke("benchmark:get-running-state")`:
   - Return `{ running: false, activeRunIds: [] }`.
2. `query({ domain: "benchmark", action: "listRuns", payload })`:
   - Map real CLI harness execution history (`state.cliStatus.recentRuns`) and telemetry records into `{ success: true, page: { runs, count: runs.length, page: 1, pageSize: 20, totalPages: 1 } }`.
3. `query({ domain: "benchmark", action: "listPackages" })` & `query({ domain: "benchmark", action: "listTasks" })`:
   - Return the 7 CLI harnesses and 5 OpenJarvis evaluation suites (`Adaptive Cascade Router`, `Intelligence-Per-Watt Telemetry`, `SQLite FTS5 BM25`, `Guardrails Sanitizer`, `Progressive Skills XML`) with live pass/latency metrics from `/api/telemetry`.

### FR-003: Real Sandbox, Storage, About, Permissions & Browser Settings
1. `invoke("sandbox:get-boot-status")`:
   - Return `{ status: "ready", message: "OpenJarvis Guardrails & CLI Sandbox active", progress: 100, reason: null, errorEventId: null, backendKind: "local-guardrails", isSandboxed: true, repairAvailable: false }`.
2. `invoke("chat-permissions:get-sandbox-mode")` & `invoke("chat-permissions:set-sandbox-mode")`:
   - Return `{ mode: "sandboxed", success: true }`.
3. `invoke("chat-permissions:get-mode")` & `invoke("chat-permissions:list-rules")`:
   - Return `{ mode: "ask", rules: state.PermissionRules || [] }`.
4. `invoke("storage:get-info")` & `query({ domain: "syncedFs", action: "storageUsage" })`:
   - Compute real byte sizes and file counts from `.berry-data/workspace.sqlite` and `.berry-data/karpathy-wiki/` via `GET /api/storage` and return `{ success: true, locations: [{ kind: "my-files", name: "Karpathy-Wiki & Workspace", fileCount, bytesUsed }, { kind: "profile", name: "SQLite Workspace DB", fileCount: 1, bytesUsed: dbBytes }] }`.
5. `invoke("app:get-version")`:
   - Return `{ version: "1.0.0 (Ổi Browser Self-Service)" }`.
6. `invoke("search-engine:get")` / `invoke("search-engine:set")`, `invoke("browser:is-default")`, `invoke("adblocker:get-enabled")`, `invoke("profile:get-all-profiles")`, `query("profile:listAccountProfiles")`:
   - Persist and return real settings from SQLite `workspace_settings` table.

### FR-004: Real File & Artifact Reading in `/library`
1. `invoke("knowledge:read-file", { path })` & `query({ domain: "syncedFs", action: "readFile", payload })`:
   - Fetch real Markdown content from `GET /api/memory/file?path=${encodeURIComponent(path)}` instead of returning a hardcoded string.
2. `invoke("knowledge:read-report", { agentId, sandboxPath })`:
   - Look up the matching artifact in `state.artifacts` by `id` or `sandboxPath` (falling back to `state.artifacts[0]` only when no ID is specified) and return its real `content_markdown`.

### FR-005: Live SQLite Introspection & Querying for `/databases`
1. Add `GET /api/databases` and `POST /api/databases/query` in `berry-http-server.js` backed by `SqliteWorkspaceStore.introspectDatabase()` and `SqliteWorkspaceStore.executeReadOnlyQuery(sql)`.
2. `invoke("agent-db:list-databases")`, `invoke("agent-db:get-schema")`, and `invoke("agent-db:execute-sql")`:
   - Return live tables (`tabs`, `companions`, `chat_messages`, `routines`, `artifacts`, `meetings`, `integrations`, `workspace_settings`, `wiki_fts`) and real column definitions (`PRAGMA table_info`) + row counts from `workspace.sqlite`.

### FR-006: Live Activity Memory & Range Synthesis for `/timeline` & `/settings/activity-memory`
1. Compute `activity-memory:get-summary`, `activity-memory:get-week-summary`, `activity-memory:get-sessions-for-day`, and `activity-memory:get-sessions-for-range` dynamically from `state.messages`, `state.tabs`, `state.routines`, and `state.cliStatus.recentRuns`.
2. Support `gia-activity-memory:status-set` and `activity-memory:clear` by persisting to `workspace_settings`.

### FR-007: Full CRUD & Run History for `/routines`
1. Extend `/api/routines` to support `POST` (create/update/toggle/delete) and populate `routines:listRuns` from `state.routines` (`last_run_at`, `last_result`, `sessionId`).
2. Wire `sendIPCCommand` and `invokeIPCQuery` for `routines:create`, `routines:update`, `routines:delete`, `routines:toggle`, and `routines:listRuns`.

### FR-008: Persistent Connected Apps & Custom MCP in SQLite (`/apps` & `/settings/integrations`)
1. Add `integrations` table in `SqliteWorkspaceStore` seeded with the 5 default integrations (`linkedin`, `github`, `gmail`, `notion`, `slack`).
2. Add `POST /api/integrations` to handle `toggle` (`connect`/`disconnect`) and `addCustomMcp` (`name`, `url`/`command`).
3. Wire `integration:connect`, `integration:disconnect`, `integration:create-custom`, and `integration:pipedream-search-apps` to `/api/integrations`.

### FR-009: Live Meeting Recording & Transcription Flow (`/meetings` & `/settings/transcription`)
1. Wire `audio:start-recording`, `audio:stop-recording`, `transcription:get-session-state`, and `audio:list-input-devices` so starting/stopping a recording creates a real meeting entry in SQLite via `POST /api/meetings`, extracts action items, logs a Karpathy-Wiki observation, and refreshes `state.meetings`.

---

## 3. Acceptance Criteria (`AC-1` … `AC-9`)

- **AC-1 (`/settings/memory`):** Renders actual Markdown from `PROFILE.md` and `COMPANION.md` with `0` occurrences of `"Couldn't load memory."` or stuck `"Calculating…"`.
- **AC-2 (`/settings/benchmarks`):** Renders CLI harness & OpenJarvis benchmark runs with `0` occurrences of `"Cannot read properties of undefined"`.
- **AC-3 (`/settings/sandbox`, `/settings/storage`, `/settings/about`):** Sandbox shows `"Protection"` active (`status: "ready"`), Storage shows real byte/file counts from `.berry-data/`, About shows version `"1.0.0"`.
- **AC-4 (`/library` & `knowledge:read-file`):** Invoking `knowledge:read-file` for `PROFILE.md` or `knowledge/crm.md` returns the real disk file content from `.berry-data/karpathy-wiki/`.
- **AC-5 (`/databases`):** `agent-db:get-schema` returns all real SQLite tables (`tabs`, `companions`, `chat_messages`, `routines`, `artifacts`, `meetings`, `integrations`, `workspace_settings`) and real columns from `PRAGMA table_info`.
- **AC-6 (`/timeline`):** `activity-memory:get-sessions-for-range` returns a valid `sessionsByDate` map keyed by `YYYY-MM-DD` derived from real workspace activity.
- **AC-7 (`/routines`):** `routines:listRuns` returns completed run records for executed routines, and creating/toggling routines persists in SQLite.
- **AC-8 (`/apps` & `/settings/integrations`):** Connecting/disconnecting an integration or adding a custom MCP persists in SQLite `integrations` table across server restarts.
- **AC-9 (`/meetings`):** Triggering `audio:stop-recording` creates a persisted meeting with extracted action items in SQLite and updates `meetings:list`.

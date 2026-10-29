# Implementation Plan — Spec 001: Zero-Placeholder Runtime & Full IPC-to-SQLite Wiring

**Spec**: `specs/001-zero-placeholder-runtime/spec.md`
**Target Repo**: `/Users/jangtrinh/Products/berry-browser`

---

## 1. Architecture & Data Flow

```text
SvelteKit 5 Frontend (30 Routes)
  │
  ├── window.electronAPI.invoke(eventName, payload)
  ├── window.electronAPI.invokeIPCQuery({ domain, action, payload })
  └── window.electronAPI.sendIPCCommand({ domain, action, payload })
        │
        ▼
Client Bridge Layer (src/client/)
  ├── berry-electron-domains.js   (Memory, Benchmarks, Databases, Activity, Integrations, Audio)
  ├── berry-electron-queries.js   (Curated files, Storage, Sandbox, Settings, Library, Routines)
  └── berry-electron-bridge.js    (State sync, IPC command dispatch, event publishing)
        │
        ▼  HTTP JSON REST (/api/*)
Server & Persistence Layer (src/server/)
  ├── berry-http-server.js        (/api/state, /api/memory/*, /api/databases, /api/integrations, /api/storage, /api/routines/*, /api/meetings)
  ├── sqlite-workspace-store.js   (SQLite tables: tabs, companions, chat_messages, routines, artifacts, meetings, integrations, workspace_settings)
  └── karpathy-wiki-memory-engine.js (Real Markdown files in .berry-data/karpathy-wiki/)
```

---

## 2. Phased Delivery & File Ownership

### Phase 1 (P1): SQLite Schema Expansion & Backend Endpoints (`src/server/`)
**Files:**
- `src/server/sqlite-workspace-store.js`
- `src/server/berry-http-server.js`

**Deliverables:**
1. Add `integrations` and `workspace_settings` tables in `SqliteWorkspaceStore.#initSchema()` and seed default integrations (`linkedin`, `github`, `gmail`, `notion`, `slack`) + default settings (`searchEngine: "google"`, `sandboxMode: "sandboxed"`, `chatPermissionMode: "ask"`, `adblockerEnabled: true`, `activityMemoryEnabled: true`).
2. Add `introspectDatabase()` (queries `sqlite_master` and `PRAGMA table_info` + row counts for every table) and `executeReadOnlyQuery(sql)` in `SqliteWorkspaceStore`.
3. Add `toggleRoutine(id, enabled)`, `deleteRoutine(id)`, `toggleIntegration(id, isConnected)`, `addCustomMcp(mcp)`, `getSetting(key)`, `setSetting(key, value)` in `SqliteWorkspaceStore`.
4. Expose in `berry-http-server.js`:
   - `GET /api/state` → include `integrations`, `dbSchema`, `settings`, `storageUsage`, `telemetry`
   - `GET /api/databases` & `POST /api/databases/query`
   - `POST /api/integrations` (`toggle`, `addCustomMcp`)
   - `POST /api/settings` (`key`, `value`)
   - `POST /api/memory/purge`

---

### Phase 2 (P2): Client IPC Domain & Query Handlers (`src/client/`)
**Files:**
- `src/client/berry-electron-domains.js`
- `src/client/berry-electron-queries.js`
- `src/client/berry-electron-bridge.js`

**Deliverables:**
1. **`/settings/memory` (`FR-001`):** Implement `memory:read-curated-file` (fetches real content from `/api/memory/file`), `memory:write-curated-file`, `memory:backfill:get-status`, `memory:backfill:estimate`, `memory:reflect-only:estimate`, `memory:backfill:start`, `memory:reflect-only:start`, and `memory:purge`.
2. **`/settings/benchmarks` (`FR-002`):** Implement `benchmark:get-running-state`, `query:benchmark:listRuns` (returning `{ success: true, page: { runs, count, page: 1, pageSize: 20, totalPages: 1 } }` from real CLI runs & telemetry), `query:benchmark:listPackages`, and `query:benchmark:listTasks`.
3. **`/settings/sandbox`, `/settings/storage`, `/settings/about`, `/settings/search-engine`, `/settings/ai-permissions` (`FR-003`):** Implement `sandbox:get-boot-status`, `chat-permissions:get-sandbox-mode`, `chat-permissions:set-sandbox-mode`, `chat-permissions:get-mode`, `chat-permissions:list-rules`, `storage:get-info`, `query:syncedFs:storageUsage`, `app:get-version`, `search-engine:get`, `search-engine:set`, `browser:is-default`, `adblocker:get-enabled`, `profile:get-all-profiles`, `query:profile:listAccountProfiles`, `extensions:get-all`, `passwords:get-all`.
4. **`/library`, `/databases`, `/timeline`, `/routines`, `/apps`, `/meetings` (`FR-004` … `FR-009`):**
   - Wire `knowledge:read-file` to `GET /api/memory/file?path=...` and `knowledge:read-report` to lookup by `agentId`/`sandboxPath`.
   - Wire `agent-db:list-databases`, `agent-db:get-schema`, and `agent-db:execute-sql` to live `state.dbSchema` and `POST /api/databases/query`.
   - Wire `activity-memory:get-sessions-for-range`, `get-sessions-for-day`, and `get-summary` to live `state.messages`, `state.tabs`, and `state.cliStatus.recentRuns`.
   - Wire `routines:listRuns` and `routines:create` / `toggle` / `delete` to `/api/routines`.
   - Wire `integration:connect`, `integration:disconnect`, and `integration:create-custom` to `/api/integrations`.
   - Wire `audio:start-recording`, `audio:stop-recording`, `transcription:get-session-state`, and `audio:list-input-devices` to `POST /api/meetings`.

---

### Phase 3 (P3): End-to-End Test Suite & 30-Route Playwright Verification
**Files:**
- `test/berry-browser.test.js`

**Deliverables:**
1. Add comprehensive test cases in `test/berry-browser.test.js` covering `AC-1` through `AC-9`.
2. Run the 30-route Playwright verification probe to confirm `0` `"Couldn't load memory"`, `0` `"Cannot read properties of undefined"`, `0` `"Calculating…"` hangs, and `0` `"The sandbox isn't running"` warnings.

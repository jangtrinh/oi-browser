# SPEC 005 · Ổi Browser · ARCD — Autonomous Routines, One-Off Schedules & Cron Daemon

**Spec ID**: `005-autonomous-routines-and-cron-daemon`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

In `Spec 001`, `/routines` gained basic `runNow`, `toggle`, `delete`, and `listRuns`. However, the SvelteKit `/routines` workspace exposes **14 additional routine & cron lifecycle operations** and lacks a live background scheduler tick loop:
- **Routine & One-Off CRUD**: `routines:create`, `routines:update`, `routines:delete`, `routines:createOneOff`, `routines:updateOneOff`, `routines:deleteOneOff`, `routines:runOneOffNow`.
- **Subscriptions & Triggers**: `routines:setSubscription`, `routines:listAvailableTriggers`, `routines:resolveSuggestion`, `routines:refresh`, `routines:takeOver`.
- **Background Cron Daemon**: Currently routines only run when the user manually clicks `Run Now`; there is no background scheduler in `berry-http-server.js` evaluating cron expressions and `nextRunAt` timestamps.

---

## 2. Functional Requirements (`FR-501` … `FR-504`)

### FR-501: Background Cron & One-Off Scheduler Daemon (`src/server/routine-cron-daemon.js`)
1. Create `RoutineCronDaemon` (`src/server/routine-cron-daemon.js`) with a deterministic cron expression parser (`minute hour dayOfMonth month dayOfWeek`) and a 60-second check loop (plus `tickNow(timestampMs)` for deterministic unit testing).
2. When an enabled routine or one-off task reaches its scheduled execution window:
   - Execute `CompanionChatOrchestrator.handleUserTurn({ companionId: routine.companion_id, message: ... })`.
   - Record run history in a dedicated `routine_runs` SQLite table (`id`, `routine_id`, `status`, `summary`, `session_id`, `started_at`, `finished_at`).
   - Update `routines.last_run_at` and `routines.last_result`.

### FR-502: One-Off Scheduled Tasks (`oneOffs` in `routines.list`)
1. Extend `routines` table in `SqliteWorkspaceStore` with `kind TEXT DEFAULT 'cron'` (`'cron'` | `'one-off'`), `scheduled_at INTEGER`, and `timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh'`.
2. Populate both `routines` and `oneOffs` in `resolveTopicState("routines.list")`.

### FR-503: Trigger Catalog & Routine Takeover (`routines:listAvailableTriggers`, `routines:takeOver`)
1. `routines:listAvailableTriggers`: Return available trigger toolkits from connected integrations (`cron`, `github:pull_request`, `gmail:new_email`, `linkedin:lead_signal`, `notion:page_updated`).
2. `routines:takeOver`: Open the routine's execution session `/chat/session-<companionId>` so the user can interactively steer the companion.

---

## 3. Acceptance Criteria (`AC-501` … `AC-503`)

- **AC-501:** Calling `RoutineCronDaemon.tickNow()` executes due routines, writes a record into `routine_runs`, and updates `routines:listRuns` with full run history.
- **AC-502:** Creating, updating, running, and deleting a one-off task (`routines:createOneOff`, `routines:runOneOffNow`, `routines:deleteOneOff`) persists in SQLite and updates `routines.list.oneOffs`.
- **AC-503:** `routines:listAvailableTriggers` returns trigger definitions for all connected integrations in SQLite.

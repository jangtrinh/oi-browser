# Implementation Plan — Spec 005: Autonomous Routines, One-Off Schedules & Cron Daemon

**Spec**: `specs/005-autonomous-routines-and-cron-daemon/spec.md`

## 1. File Touch List
- `src/server/routine-cron-daemon.js` *(new)*: Deterministic 5-field cron evaluator and background tick runner.
- `src/server/sqlite-workspace-store.js`: Add `routine_runs` table, `updateRoutine()`, and `one-off` task support.
- `src/server/berry-http-server.js`: Mount `RoutineCronDaemon` and extend `POST /api/routines` for `update`, `createOneOff`, `updateOneOff`, `deleteOneOff`, `runOneOffNow`.
- `src/client/berry-electron-queries.js` & `src/client/berry-electron-state.js`: Wire all 14 `routines:*` queries/commands and populate `oneOffs`.
- `test/spec-005-routines-cron.test.js`: Integration tests for `AC-501` … `AC-503`.

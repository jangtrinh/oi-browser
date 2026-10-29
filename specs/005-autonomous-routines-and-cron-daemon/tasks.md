# Tasks — Spec 005: Autonomous Routines, One-Off Schedules & Cron Daemon

- [ ] **501.1 (P1 — Cron Daemon & Run History Table):** Create `src/server/routine-cron-daemon.js` and add `routine_runs` table in `src/server/sqlite-workspace-store.js`.
- [ ] **501.2 (P1 — One-Off & Update API):** Extend `POST /api/routines` in `src/server/berry-http-server.js` to handle `update`, `createOneOff`, `updateOneOff`, `deleteOneOff`, and `runOneOffNow`.
- [ ] **502.1 (P2 — Client Routines IPC):** Wire `routines:update`, `routines:createOneOff`, `routines:updateOneOff`, `routines:deleteOneOff`, `routines:runOneOffNow`, `routines:setSubscription`, `routines:listAvailableTriggers`, and `routines:takeOver` in `src/client/berry-electron-queries.js`.
- [ ] **503.1 (P3 — Verification):** Add `test/spec-005-routines-cron.test.js` covering `AC-501` … `AC-503`.

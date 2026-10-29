# Tasks — Spec 007: Meetings Studio, Voice Command Engine & Activity Memory Observer

- [ ] **701.1 (P1 — Meetings Search/Delete & `activity_events` Table):** Extend `SqliteWorkspaceStore` and `src/server/berry-http-server.js` (`POST /api/meetings`, `POST /api/activity-memory`).
- [ ] **702.1 (P2 — Client Audio, Voice & Activity IPC):** Wire `transcription:*`, `audio:*`, `meeting:*`, `voiceCommand:*`, `tts:preview-voice`, `quick-pill:*`, and `gia-activity-memory:*` in `src/client/berry-electron-domains.js`.
- [ ] **703.1 (P3 — Verification):** Add `test/spec-007-meetings-voice-activity.test.js` covering `AC-701` … `AC-703`.

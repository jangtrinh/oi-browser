# Implementation Plan — Spec 007: Meetings Studio, Voice Command Engine & Activity Memory Observer

**Spec**: `specs/007-meetings-voice-and-activity-observer/spec.md`

## 1. File Touch List
- `src/server/sqlite-workspace-store.js`: Add `activity_events` table, `deleteMeeting(id)`, `searchMeetings(q)`, `listActivityEvents()`, `deleteActivityDay(dateKey)`, `clearAllActivity()`.
- `src/server/berry-http-server.js`: Extend `POST /api/meetings` (`delete`, `search`) and add `POST /api/activity-memory`.
- `src/client/berry-electron-domains.js` & `src/client/berry-electron-queries.js`: Wire all 38 `audio:*`, `meeting:*`, `transcription:*`, `voiceCommand:*`, `tts:*`, `quick-pill:*`, and `gia-activity-memory:*` channels.
- `test/spec-007-meetings-voice-activity.test.js`: Integration tests for `AC-701` … `AC-703`.

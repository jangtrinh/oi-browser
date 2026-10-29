# SPEC 007 · Ổi Browser · MVAO — Meetings Studio, Voice Command Engine & Activity Memory Observer

**Spec ID**: `007-meetings-voice-and-activity-observer`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

While `/meetings`, `/timeline`, `/settings/transcription`, `/settings/voice`, and `/settings/activity-memory` render and record basic meetings (`Spec 001`), the SvelteKit UI exposes **38 audio, transcription, voice-command, and activity-memory mutation IPC channels**:
- **Meetings & Audio Lifecycle**: `transcription:start`, `transcription:stop`, `transcription:levels-test:start`, `transcription:levels-test:stop`, `audio:transcribe-recording`, `audio:delete-recording`, `audio:search-recordings`, `audio:attach-recording-to-chat`, `meeting:continue-recording`, `meeting:finish-recording`, `meeting:open-post-meeting-chat`, `meeting:open-post-meeting-page`, `meeting-toast:*`.
- **Voice Commands, Quick-Pill & TTS**: `voiceCommand:confirm`, `voiceCommand:cancel`, `voiceCommand:openChat`, `voiceCommand:openUrl`, `voiceCommand:readAloud`, `tts:preview-voice`, `quick-pill:start-recording`, `quick-pill:stop-recording`, `quick-pill:submit`.
- **Activity Memory Search, Schedule & Deletion**: `gia-activity-memory:status-set`, `gia-activity-memory:search`, `gia-activity-memory:delete-day`, `gia-activity-memory:delete-all`, `activity-memory:get-screenshots-for-day`, `activity-memory:get-screenshots-for-session`, `activity-memory:dev-force-regenerate-day`.

---

## 2. Functional Requirements (`FR-701` … `FR-704`)

### FR-701: Complete Meeting Recording, Search, Deletion & Post-Meeting Chat
1. Extend `SqliteWorkspaceStore` (`meetings` table) with `deleteMeeting(id)` and `searchMeetings(query)`.
2. Wire `transcription:start`, `transcription:stop`, `meeting:continue-recording`, `meeting:finish-recording`, `audio:delete-recording`, `audio:search-recordings`, `audio:attach-recording-to-chat`, and `meeting:open-post-meeting-chat` to `POST /api/meetings`.
3. When `meeting:open-post-meeting-chat` or `audio:attach-recording-to-chat` is triggered, create/open a companion chat session prefilled with the meeting's `summary_markdown` and `actionItems`.

### FR-702: Voice Commands, Quick-Pill & Web Speech TTS (`tts:preview-voice`)
1. Wire `tts:preview-voice` and `voiceCommand:readAloud` to the browser's native `window.speechSynthesis` (`vi-VN` / `en-US`) when available, with deterministic status return `{ playing: true, success: true }`.
2. Wire `quick-pill:submit`, `voiceCommand:confirm`, and `voiceCommand:openChat` to dispatch prompts directly to `CompanionChatOrchestrator` (`POST /api/chat`).

### FR-703: Activity Memory Search, Schedule Toggle & Day/Full Deletion
1. Add `activity_events` table in `SqliteWorkspaceStore` (`id`, `date_key`, `domain`, `title`, `description`, `companion_id`, `created_at`) automatically populated on every chat turn, tab navigation, and CLI execution.
2. Wire `gia-activity-memory:status-set` (weekday schedule & enable/pause toggle), `gia-activity-memory:search`, `gia-activity-memory:delete-day`, and `gia-activity-memory:delete-all` (`Clear…` button in `/settings/activity-memory`) to `POST /api/activity-memory`.

---

## 3. Acceptance Criteria (`AC-701` … `AC-703`)

- **AC-701:** Searching meetings via `audio:search-recordings` filters SQLite `meetings` by title/transcript, and deleting a meeting via `audio:delete-recording` removes it from `/meetings`.
- **AC-702:** Clicking `Clear…` in `/settings/activity-memory` (`gia-activity-memory:delete-all` / `delete-day`) deletes matching rows in SQLite `activity_events` and updates `/timeline`.
- **AC-703:** Submitting a voice prompt via `quick-pill:submit` or `voiceCommand:openChat` creates a companion chat turn and navigates to the session.

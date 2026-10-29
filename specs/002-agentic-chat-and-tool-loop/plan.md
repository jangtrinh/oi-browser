# Implementation Plan — Spec 002: Agentic Chat, Streaming Turn Control & Tool Permission Loop

**Spec**: `specs/002-agentic-chat-and-tool-loop/spec.md`

## 1. File Touch List
- `src/server/sqlite-workspace-store.js`: Add `editMessage()`, `deleteMessagesFrom()`, `duplicateSessionMessages()`, `deleteSessionMessages()`.
- `src/server/companion-chat-orchestrator.js`: Add `previewSystemPrompt(companionId)`, `compactSession(companionId)`, and attachment context injection.
- `src/server/berry-http-server.js`: Add `POST /api/chat/mutate` (`edit`, `retry`, `duplicate`, `compact`, `stop`) and `POST /api/attachments`.
- `src/client/berry-electron-queries.js` & `src/client/berry-electron-state.js`: Wire all 48 `chat:*`, `context:*`, and `tokens:*` IPC invokes/queries.
- `test/spec-002-chat-loop.test.js`: Integration tests for `AC-201` … `AC-205`.

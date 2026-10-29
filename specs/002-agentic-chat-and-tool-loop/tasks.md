# Tasks — Spec 002: Agentic Chat, Streaming Turn Control & Tool Permission Loop

- [ ] **201.1 (P1 — Server Chat Mutations):** Add `POST /api/chat/mutate` (`stop`, `retry`, `edit`, `duplicate`, `compact`, `previewPrompt`) in `src/server/berry-http-server.js` and `SqliteWorkspaceStore`.
- [ ] **201.2 (P1 — Attachment Staging API):** Add `POST /api/attachments` in `src/server/berry-http-server.js` to persist chunked uploads into `.berry-data/attachments/`.
- [ ] **202.1 (P2 — Client Chat IPC Wiring):** Implement `chat:stopGenerating`, `chat:retryCompletion`, `chat:editMessage`, `chat:duplicate-session`, `chat:forceCompaction`, `chat:previewSystemPrompt`, `tokens:estimate-messages`, `chat:answerToolInput`, `chat:answerCodeToolPermission`, `chat:findTextPage`, and `chat:*AttachmentStaging*` in `src/client/berry-electron-queries.js`.
- [ ] **203.1 (P3 — Verification):** Add `test/spec-002-chat-loop.test.js` verifying `AC-201` … `AC-205`.

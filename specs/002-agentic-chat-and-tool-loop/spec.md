# SPEC 002 · Ổi Browser · ACTL — Agentic Chat, Streaming Turn Control & Tool Permission Loop

**Spec ID**: `002-agentic-chat-and-tool-loop`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

While `POST /api/chat` and `chat:completion-requested` execute a single-turn chat with a companion, the SvelteKit 5 chat view (`public/_app/immutable/nodes/`) exposes **48 interactive chat & composer IPC operations** that are currently unhandled (falling into `{ success: true }`):
- **Active Turn Control**: Stop generating (`chat:stopGenerating`), steer active turn (`chat:steer-active-turn`), retry completion (`chat:retryCompletion`), edit user message (`chat:editMessage`), continue execution (`chat:continue-execution`).
- **Interactive Tool & Permission Approvals**: Approve/deny tool calls (`chat:answerToolInput`, `chat:answerCodeToolPermission`, `chat:answerUserRequest`, `chat:update-tool-result`).
- **Composer File & URL Attachment Staging**: Chunked file upload staging (`chat:beginAttachmentStaging`, `chat:appendAttachmentStagingChunk`, `chat:finishAttachmentStaging`, `chat:cancelAttachmentStaging`, `context:upload-file-dialog`, `context:add-attachment-from-url`).
- **Session Lifecycle & Search**: Duplicate/fork session (`chat:duplicate-session`), delete session (`storage:delete-session`), in-chat text find (`chat:findTextPage`, `chat:loadFindMessage`, `chat:cancelPageFind`), context compaction (`chat:forceCompaction`), system prompt preview (`chat:previewSystemPrompt`), token estimation (`tokens:estimate-messages`).

---

## 2. Functional Requirements (`FR-201` … `FR-206`)

### FR-201: Active Turn Abort, Steer, Edit & Retry
1. **`chat:stopGenerating` (`query`)**:
   - Abort any in-flight CLI harness subprocess (`AbortController` in `CliHarnessRouter`) for `payload.sessionId`, set `session.chatStatus = "idle"`, and publish `chat.session` + `chat.cloudLoop`.
2. **`chat:retryCompletion` & `chat:editMessage` (`query`)**:
   - Truncate or update the target message in `chat_messages` (`POST /api/chat/mutate`), re-run `CompanionChatOrchestrator.handleUserTurn()`, and stream updated state to `chat.session.messages`.
3. **`chat:steer-active-turn` & `chat:continue-execution` (`invoke`)**:
   - Append steering guidance to the active turn or resume a paused tool turn.

### FR-202: Human-in-the-Loop Tool Confirmation Gate
1. **`chat:answerToolInput`, `chat:answerCodeToolPermission`, `chat:answerUserRequest` (`query`)**:
   - Resolve pending tool confirmations in `chat.pendingTools` (`allow-once`, `allow-always`, `deny`), persist `"allow-always"` rules into SQLite `workspace_settings.toolPermissionRules`, and resume tool execution.

### FR-203: Multi-Part Attachment Staging & Tab Context Injection
1. **`chat:beginAttachmentStaging` → `chat:appendAttachmentStagingChunk` → `chat:finishAttachmentStaging` (`query`)**:
   - Buffer base64/binary chunks into `.berry-data/attachments/<stagingId>_<filename>`, register the attachment in `chat.input` (`attachments: [...]`), and pass file paths into `CliHarnessRouter` + `CompanionChatOrchestrator`.
2. **`context:add-attachment-from-url` (`invoke`)**:
   - Inspect target URL via `AgentDOMBrowserService.inspectUrl(url)` and attach extracted DOM markdown to the active composer draft.

### FR-204: Session Forking, Deletion, Compaction & System Prompt Preview
1. **`chat:duplicate-session` (`invoke`)**:
   - Clone all messages of `payload.sessionId` into a new `session-<uuid>` in SQLite `chat_messages`.
2. **`chat:forceCompaction` (`query`)**:
   - Summarize older messages in the session into a Karpathy-Wiki summary block and set `triggeredCompaction: true` on the compaction marker message.
3. **`chat:previewSystemPrompt` (`query`) & `tokens:estimate-messages` (`invoke`)**:
   - Return the assembled system prompt (Companion prompt + `PROFILE.md` + `COMPANION.md` + progressive `<available_skills>` XML) and exact token estimate (`Math.ceil(chars / 4)`).

### FR-205: In-Session Full-Text Find (`chat:findTextPage`)
1. **`chat:findTextPage`, `chat:loadFindMessage`, `chat:cancelPageFind` (`query`)**:
   - Search `session.messages` case-insensitively and publish matches to `chat.pageFind` and `chat.pageFindResults`.

---

## 3. Acceptance Criteria (`AC-201` … `AC-205`)

- **AC-201:** Calling `chat:stopGenerating` cancels an active CLI turn within `< 100ms` and transitions `chatStatus` to `"idle"`.
- **AC-202:** Editing a previous message via `chat:editMessage` or retrying via `chat:retryCompletion` updates SQLite `chat_messages` and produces a fresh assistant response.
- **AC-203:** Staging a file attachment via `beginAttachmentStaging` → `appendAttachmentStagingChunk` → `finishAttachmentStaging` writes the file to `.berry-data/attachments/` and exposes it in `chat.input.attachments`.
- **AC-204:** `chat:previewSystemPrompt` returns the combined Companion + Karpathy-Wiki + OpenJarvis Skills XML prompt, and `tokens:estimate-messages` returns a deterministic token count.
- **AC-205:** `chat:findTextPage` locates matching message IDs and character offsets across the active session transcript.

# Architecture Context: Spec-Driven Development Roadmap (`Specs 001–008`)

## Full IPC Inventory (`public/_app/immutable/**/*.js`)
- **Total `electronAPI.invoke` channels**: 414
- **Total `domain:action` queries/commands**: 351
- **Master Index**: `specs/README.md` (Committed in `ce0f5b8`)

## Spec Packages
1. **`specs/001-zero-placeholder-runtime/` (`SHIPPED` — `c557818`)**: Core runtime wiring across all 30 routes (Memory `CLAUDE.md`, Benchmarks, SyncedFS Storage, Sandbox status, Starter Kits, CRUD for Routines/Databases/Apps/Meetings).
2. **`specs/002-agentic-chat-and-tool-loop/` (`READY`)**: 48 `chat:*`, `context:*`, `tokens:*` operations — multi-step tool loop, permission approvals, context attachments, conversation fork/truncate, FTS5 search, live token counting.
3. **`specs/003-syncedfs-library-and-visual-artifacts/` (`READY`)**: 44 `synced-fs:*`, `syncedFs:*`, `fs:*`, `file:*`, `artifact-*`, `table:*`, `report:*` operations — bidirectional `~/.oi-browser/library/` watcher, spreadsheet cell editor, report editor, visual artifact sandbox.
4. **`specs/004-companions-studio-and-skills-forge/` (`READY`)**: 32 `companions:*`, `skills:*`, `onboarding:*` operations — custom companion creator, filesystem `SKILL.md` sync & zip import/export.
5. **`specs/005-autonomous-routines-and-cron-daemon/` (`READY`)**: 14 `routines:*` operations + `RoutineCronDaemon` background cron scheduler and pre-approval queue.
6. **`specs/006-live-mcp-client-and-agent-databases/` (`READY`)**: 24 `integration:*`, `agent-db:*` operations — `McpClientBridge` for live stdio/SSE MCP servers and dedicated per-database SQLite engines (`~/.oi-browser/databases/<dbId>.sqlite`).
7. **`specs/007-meetings-voice-and-activity-observer/` (`READY`)**: 38 `audio:*`, `meeting:*`, `transcription:*`, `voiceCommand:*`, `tts:*`, `quick-pill:*`, `gia-activity-memory:*` operations — local audio recording, Whisper/CLI transcription, CLI meeting summary, macOS `say` TTS, and `/timeline` observer.
8. **`specs/008-browser-shell-vault-and-local-evals/` (`READY`)**: 52 `passwords:*`, `profile:*`, `history:*`, `bookmark:*`, `downloads:*`, `sandbox:reset`, `benchmark:*` operations — AES-256-GCM password vault, multi-profile browser switcher, history/bookmarks/downloads, and local eval runner.

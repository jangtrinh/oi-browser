# Technical Plan: Multi-CLI Shell Harness Core (`plans/cli-harness-router/plan.md`)

## Agreed Seams Under Test
1. `GET /api/cli/status` & `GET /api/state` (verifies CLI harness auto-discovery, active harness state, and companion affinity table).
2. `POST /api/cli/select` & `POST /api/cli/exec` (verifies switching the active CLI harness and executing a real CLI binary / prompt such as `orca status --json` or `local` / `agy` / `claude` with structured stdout, command line, and duration telemetry).
3. `POST /api/chat` with `harnessId` (verifies `CompanionChatOrchestrator` executes `cli_harness_dispatch` alongside `browser_inspect_dom`, `create_visual_artifact`, and `karpathy_wiki_memory_write`).

## Vertical Slices (All files in `src/` strictly `< 200` lines)

### Slice 1: `src/server/cli-harness-router.js` (`< 195` lines)
- Defines `CLI_HARNESS_CATALOG` (`auto`, `claude`, `agy`, `codex`, `grok`, `gemini`, `orca`, `local`) and `COMPANION_CLI_AFFINITY` for all 9 Vietnamese fruit companions.
- Resolves binary paths across `/opt/homebrew/bin`, `/usr/local/bin`, `~/.grok/bin`, `~/.local/bin`, and `process.env.PATH`.
- Implements `getStatus()`, `setActiveHarness(harnessId)`, `buildContextPrompt({ companion, message, snap, skillPaths })`, and `executeHarness({ harnessId, companion, prompt, mode, timeoutMs })` using `child_process.spawn` with clean timeout protection and automatic fallback.

### Slice 2: Wire `CliHarnessRouter` into `CompanionChatOrchestrator` & `berry-http-server.js` (both `< 195` lines)
- Inject `cliRouter` into `CompanionChatOrchestrator`.
- Add `cli_harness_dispatch` step in `handleUserTurn()` that resolves the companion's `SKILL.md` files from `skills-extracted/`, invokes `cliRouter.runTurn({ harnessId, companion, message, snap })`, and includes the CLI harness badge + output in the assistant reply and tool call chips.
- Add `GET /api/cli/status`, `POST /api/cli/select`, and `POST /api/cli/exec` in `src/server/berry-http-server.js`, and include `cliStatus: cliRouter.getStatus()` in `GET /api/state`.

### Slice 3: Interactive `>_ CLI Harness` Terminal Dock (`src/client/berry-cli-terminal-dock.js`, `< 195` lines)
- Mounts a sleek, theme-aware (`light` & `dark`) **Orca ADE-style CLI Harness pill & expandable Terminal Dock** (`#oi-cli-dock`).
- Displays live detected badges (`Claude Code`, `Antigravity CLI`, `OpenAI Codex`, `xAI Grok`, `Gemini CLI`, `Orca ADE`, `Local Fast`) with green dot indicators for installed binaries on the host machine.
- Allows one-click switching of the active AI CLI Core for Companion chats AND provides an interactive command/prompt input box that calls `POST /api/cli/exec` and renders real-time command line, exit code, duration, and stdout in a monospace terminal view.
- Hook `window.__berryBridge.selectedHarnessId` in `src/client/berry-electron-bridge.js` so `sendUserChatTurn` forwards the selected `harnessId` to `POST /api/chat`.

### Slice 4: Verification, Docs Synchronization & Release
- Extend `test/berry-browser.test.js` with new tests covering `/api/cli/status`, `/api/cli/select`, `/api/cli/exec` (including real `orca` / `local` CLI invocation), and `/api/chat` with `harnessId`.
- Verify live in browser on `http://127.0.0.1:4104` and capture screenshot of the **Orca ADE-style `>_ CLI Harness` Terminal Dock** in action.
- Update `README.md` and `docs/index.html` (`ui gate`: 0 errors, 0 warnings), finalize `.brv/context-tree/` and `plans/specs/cli-harness-router/STATUS.md`, commit and push to `jangtrinh/oi-browser`.

# Brainstorm: Multi-CLI Shell Harness Core & Interactive Terminal Dock (Orca ADE Style)

## 1. Press Release (Working Backwards)

**FOR IMMEDIATE RELEASE — Ổi Browser Introduces Multi-CLI Shell Harness Core (`Claude Code`, `Codex`, `Grok`, `Antigravity CLI`, `Gemini CLI`, `Orca ADE`)**

Today, **Ổi Browser** upgrades its AI execution core with the **Orca ADE-style Multi-CLI Shell Harness Router (`CliHarnessRouter`)** and an embedded **`>_ CLI Harness` Terminal Dock**. Developers and researchers who already subscribe to Claude Pro/Max (`claude`), ChatGPT Plus/Pro (`codex`), SuperGrok (`grok`), or Google Antigravity (`agy` / `gemini`) can now power all 9 Vietnamese Fruit Companions directly through their local CLI subscriptions — with **$0 extra API key cost**, full local filesystem access to `.berry-data/karpathy-wiki/` and `skills-extracted/`, and an interactive terminal drawer right inside the browser.

## 2. User Stories

1. **As a developer with local AI CLIs installed (`claude`, `codex`, `grok`, `agy`, `gemini`, `orca`)**, I want Ổi Browser to automatically detect which CLI harnesses are installed on my Mac and display their live availability status (`READY` / `NOT INSTALLED`) so I can switch AI cores with one click.
2. **As a companion user**, I want each of the 9 Vietnamese Fruit Companions to have a default CLI affinity (e.g., **Ổi Đào** → `claude`, **Bưởi Da Xanh** → `codex`, **Sầu Riêng Ri6** → `grok`, **Măng Cụt** → `gemini`/`agy`) while allowing me to override the active CLI harness (`auto`, `claude`, `agy`, `codex`, `grok`, `gemini`, `local`) from the UI.
3. **As an power user who loves Orca ADE**, I want an interactive **`>_ CLI Harness` Terminal Dock** inside Ổi Browser where I can execute prompts or CLI commands directly against `claude`, `codex`, `grok`, `agy`, `gemini`, or `orca`, inspect real-time stdout/stderr execution logs, and see every command logged into my session history.

## 3. MoSCoW Prioritization

- **Must Have**:
  - `src/server/cli-harness-router.js` (`< 200` lines): Auto-discovery of `claude`, `agy`, `codex`, `grok`, `gemini`, `orca` binaries (`/opt/homebrew/bin`, `~/.grok/bin`, `PATH`), Companion-to-CLI affinity mapping, non-interactive prompt execution (`claude -p`, `agy -p`, `codex exec`, `grok -p`, `gemini -p`, `orca status --json`) with timeout + graceful fallback to `local` deterministic engine, and `/api/cli/status` + `/api/cli/exec` endpoints.
  - Integration into `CompanionChatOrchestrator`: When `harnessId` is specified (or configured via `/api/cli/select`), `handleUserTurn` records the active CLI harness tool call (`cli_harness_dispatch`), enriches the response with CLI output when invoked in live CLI mode, and preserves 100% deterministic speed in `local` mode.
  - `src/client/berry-cli-terminal-dock.js` (`< 200` lines): Floating pill + expandable **Orca ADE-style `>_ CLI Harness` Terminal Dock** in the UI showing all detected CLIs with status badges, one-click harness switcher (`Auto`, `Claude`, `Antigravity`, `Codex`, `Grok`, `Gemini`, `Orca`, `Local`), and an interactive command/prompt runner with live terminal output.
- **Should Have**:
  - Persistence of execution history (`recentRuns`) in `CliHarnessRouter` so opening the terminal dock immediately shows recent companion & terminal dispatches.
- **Won't Have (this slice)**:
  - External npm native addons (`node-pty` C++ bindings) — use zero-dependency Node.js `child_process.spawn` so `npm start` works out-of-the-box on any Node 22+ runtime without `node-gyp` build failures.

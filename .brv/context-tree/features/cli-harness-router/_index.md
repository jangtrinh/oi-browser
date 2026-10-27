# Feature Context: Multi-CLI Shell Harness Core (`cli-harness-router`)

## Architecture
- **`src/server/cli-harness-router.js` (`186` lines)**: Auto-discovers installed host CLI binaries (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) alongside `auto` and `local` modes. Maps all 9 Vietnamese fruit companions (`COMPANION_CLI_AFFINITY`) to their primary CLI engine and executes non-interactive prompts or CLI status commands via `child_process.spawn`.
- **`src/client/berry-cli-terminal-dock.js` (`166` lines)**: Native Ổi Browser OKLCH design-system (`oklch(var(--popover))`, `oklch(var(--border))`, `var(--theme-surface-*)`, `--composer-radius`) Multi-CLI Harness switcher and interactive terminal dock.
- **HTTP Endpoints (`src/server/berry-http-server.js`)**: `GET /api/cli/status`, `POST /api/cli/select`, `POST /api/cli/exec`.

## Key Decisions
1. Reuse local CLI subscriptions (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) with zero API key setup (Orca ADE pattern) while preserving a zero-latency `local` deterministic engine fallback.
2. Style the CLI Terminal Dock strictly with native Ổi Browser OKLCH tokens (`oklch(var(--popover))`, `var(--theme-surface)`, `oklch(var(--success))`) and 3D Vietnamese fruit icons (`/fruits-3d/*.png`) so it adapts seamlessly to both Light and Dark mode.

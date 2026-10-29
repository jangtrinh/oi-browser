# Feature Context: Multi-CLI Shell Harness Core & OpenJarvis Engine (`cli-harness-router`)

## Architecture
- **`src/server/cli-harness-router.js`**: Auto-discovers installed host CLI binaries (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) alongside `auto` and `local` modes. Maps all 9 Vietnamese fruit companions (`COMPANION_CLI_AFFINITY`) to their primary CLI engine and executes non-interactive prompts via `child_process.spawn`.
- **`src/server/cli-provider-service.js`**: Centralizes AI execution (`complete`, `stream`, `health`, `select`, `syncMemory`) over the active CLI harness, replacing all cloud API key / OpenRouter / billing dependencies with 100% self-service local CLI subscriptions.
- **`src/server/cli-adaptive-router.js`**: OpenJarvis-inspired Thompson-sampling (`Beta(alpha, beta)`) + domain-prior + latency/availability composite scorer that selects the optimal CLI engine per prompt domain and updates posterior weights in SQLite (`cli_routing_posteriors`, `cli_telemetry_traces`).
- **`src/server/cli-guardrails.js`**: 6-layer deterministic pre-spawn guardrail pipeline (Unicode normalization, secret/credential redaction, destructive command blocklist, workspace boundary check, prompt-injection shield, and token budget cap).
- **`src/server/cli-skill-loader.js`**: Progressive disclosure skill loader scanning `~/.gemini/config/skills`, `~/.agents/skills`, and `~/.claude/skills` (`L1` frontmatter index -> `L2` top-K `SKILL.md` injection).
- **`src/server/karpathy-wiki-bridge.js`**: Auto-maintains the human-readable Markdown knowledge base at `~/.oi-browser/karpathy-wiki/` (`CLAUDE.md`, `index.md`, `log.md`, `conversations/`, `concepts/`).

## Key Decisions
1. **100% Self-Service Local-First**: Zero billing, zero credit meters, zero Stripe checkout, and zero cloud API keys required. All AI features route through local CLI harnesses (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) with deterministic local fallback.
2. **Native Sidebar Parity (`src/client/berry-cli-terminal-dock.js`)**: `#oi-sidebar-cli-settings-link` is inserted directly after the `Library` button inside `div.flex.flex-col.gap-0.5`, inheriting `libBtn.className` (`12.8px`, `font-weight: 400`, `oklch(0.556 0 0)`) and using a native boxed terminal SVG (`stroke-width="1.75"`, `size-3.5`) in both `/newtab` and `/settings`.

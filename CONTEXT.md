# Ổi Browser — Domain Glossary & Context (`CONTEXT.md`)

## Canonical Domain Terms

| Term | Definition | _Avoid_ |
| :--- | :--- | :--- |
| **Ổi Browser** | Local-first AI agentic workspace browser running on `http://127.0.0.1:4104` with 9 Vietnamese fruit companions, Karpathy-Wiki Markdown memory, and Multi-CLI Shell Harness execution. | Cloud Browser, Paid Credit Wrapper |
| **Companion** | One of the 9 specialized Vietnamese fruit AI agents (`Ổi Đào`, `Măng Cụt`, `Sầu Riêng Ri6`, `Thanh Long Đỏ`, `Bưởi Da Xanh`, `Vú Sữa Lò Rèn`, `Xoài Cát Hòa Lộc`, `Chôm Chôm Nhãn`, `Vải Thiều Thanh Hà`). | Bot, Assistant |
| **CLI Harness Router (`CliHarnessRouter`)** | Orca ADE-inspired execution engine (`src/server/cli-harness-router.js`) that discovers installed local AI CLI binaries (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) and dispatches grounded prompts or interactive shell commands with zero API key billing. | Cloud LLM Proxy |
| **Harness ID** | Canonical identifier for a CLI runtime: `auto` (companion affinity routing), `claude` (Claude Code CLI), `agy` (Antigravity CLI), `codex` (OpenAI Codex CLI), `grok` (xAI Grok Build CLI), `gemini` (Gemini CLI), `orca` (Orca ADE CLI), or `local` (Deterministic Zero-Latency Engine). | Provider ID |
| **CLI Terminal Dock (`>_ CLI Harness`)** | Interactive terminal drawer and harness selector (`src/client/berry-cli-terminal-dock.js`) embedded inside Ổi Browser for selecting the active AI CLI core, inspecting live CLI execution logs, and running direct shell/agent commands. | Debug Console |
| **Karpathy-Wiki Memory** | Self-compiling local Markdown knowledge base (`.berry-data/karpathy-wiki/`) with `INDEX.md`, `PROFILE.md`, `entities/`, `observations/`, and `companions/`. | Vector DB |
| **Interactive DOM Stamp (`[data-oi-id]`)** | Unique attribute (`data-oi-id="oi-1..N"`) injected into live web page interactive elements by `AgentDOMBrowserService`. | XPath Selector |

## Key Architectural Decisions (ADRs)

- **ADR-001: Subscription-First Multi-CLI Harness (Orca ADE Pattern)**: Instead of requiring users to paste paid API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), Ổi Browser detects locally authenticated CLI binaries (`claude`, `agy`, `codex`, `grok`, `gemini`, `orca`) on `PATH` / standard macOS paths and executes them via `child_process.spawn` with bounded timeouts and automatic fallback to the Local Deterministic Engine (`local`).
- **ADR-002: Companion-to-CLI Affinity Routing (`auto` mode)**: When `harnessId === "auto"`, each Vietnamese fruit companion routes to its highest-affinity installed CLI runtime (e.g., `Ổi Đào` -> `claude`/`agy`, `Bưởi Da Xanh` -> `codex`, `Sầu Riêng Ri6` -> `grok`, `Măng Cụt` -> `gemini`/`agy`), falling back gracefully to `local` when offline or in fast test mode.
- **ADR-003: Strict `< 200` Lines Per Source File**: Every file under `src/` must remain under 200 lines to preserve modularity and instant readability.

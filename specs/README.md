# Ổi Browser — Complete Spec-Driven Development Roadmap (`Specs 001–008`)

Every feature surface of **Ổi Browser** (`public/_app/immutable/` SvelteKit 5 UI + `src/server/` Node.js 22+ `node:sqlite` backend + `src/client/` Electron IPC bridge) has been exhaustively audited across all **414 `electronAPI.invoke` channels** and **351 `domain:action` queries/commands**, excluding banned billing/Stripe/credit-purchase flows (100% self-service local-first).

| Spec ID | Code | Title | IPC Channels | Status |
| :--- | :--- | :--- | :---: | :--- |
| **[001](./001-zero-placeholder-runtime/spec.md)** | `ZPRT` | **Zero-Placeholder Runtime & Full-Surface SQLite Persistence** | 62 | **Shipped (`c557818`)** |
| **[002](./002-agentic-chat-and-tool-loop/spec.md)** | `ACTL` | **Agentic Chat, Streaming Turn Control & Tool Permission Loop** | 48 | **Shipped (`test/spec-002.test.js`)** |
| **[003](./003-syncedfs-library-and-visual-artifacts/spec.md)** | `SLVA` | **SyncedFS Workspace, Library CRUD & Visual Artifacts Engine** | 44 | **Shipped (`test/spec-003.test.js`)** |
| **[004](./004-companions-studio-and-skills-forge/spec.md)** | `CSSF` | **Companions Studio, 3D Avatar Customizer & Skills Forge** | 32 | **Shipped (`test/spec-004.test.js`)** |
| **[005](./005-autonomous-routines-and-cron-daemon/spec.md)** | `ARCD` | **Autonomous Routines, One-Off Schedules & Cron Daemon** | 14 | **Shipped (`test/spec-005.test.js`)** |
| **[006](./006-live-mcp-client-and-agent-databases/spec.md)** | `MCDB` | **Live MCP Client Protocol & Multi-Database Provisioning** | 24 | **Shipped (`test/spec-006.test.js`)** |
| **[007](./007-meetings-voice-and-activity-observer/spec.md)** | `MVAO` | **Meetings Studio, Voice Command Engine & Activity Memory Observer** | 38 | **Shipped (`test/spec-007.test.js`)** |
| **[008](./008-browser-shell-vault-and-local-evals/spec.md)** | `BSVE` | **Browser Shell, Password Vault, Multi-Profile & Local Eval Runner** | 52 | **Shipped (`test/spec-008.test.js`)** |

## Non-Goals (Permanently Excluded per Owner Directive)
- **Zero Billing / Stripe / Credit Top-Up**: All `account:createSubscriptionCheckoutSession`, `account:purchaseCredits`, `account:updateAutoTopup`, `billingAccount:*` mutation channels remain no-op self-service stubs.
- **Zero Monospace UI / Pastel Badges**: All custom UI injections (`src/client/berry-cli-terminal-dock.js`) strictly obey the Native Berry Design System (`--font-sans` Inter, `12.8px` sidebar items, `stroke-width: 1.75` Lucide icons, zero pastel badges).

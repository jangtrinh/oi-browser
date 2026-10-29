# Session Handoff — Ổi Browser (`berry-browser`)
**Updated**: 2026-10-29T11:53:00+07:00
**Branch**: `main` (`ce0f5b8`, pushed to `origin/main`)
**Live Dev Server**: `http://127.0.0.1:4104` (`PORT=4104 npm start`)

## What Was Accomplished
1. **100% Self-Service Local-First Purge**:
   - Removed all billing, credit meters, Stripe checkout, and cloud API key dependencies from `Ổi Browser`.
   - Built `BerryCliProviderService` + OpenJarvis-inspired `CliAdaptiveRouter` (Thompson sampling), `CliGuardrails` (6-layer pre-spawn security), `CliSkillLoader` (progressive disclosure), Hybrid FTS5 Memory (`sqlite-workspace-store.js`), and `KarpathyWikiBridge` (`~/.oi-browser/karpathy-wiki/`).
2. **Native Berry Design System Alignment & Sidebar Parity (`28c1e86`, `5dd10fd`)**:
   - Eliminated all monospace UI fonts, pastel pill badges, boxed `.card-header` bars, and verbose copy from `#oi-cli-provider-panel` (`/settings/ai-provider`).
   - Fixed `CLI Core` sidebar item in both `/newtab` and `/settings` (`src/client/berry-cli-terminal-dock.js`) so it sits directly inside `div.flex.flex-col.gap-0.5` after `Library`, matching `12.8px` Inter, `oklch(0.556 0 0)`, and `stroke-width="1.75"` boxed terminal SVG icon pixel-for-pixel.
   - Authored **Spec 031 (`031-zero-drift-onboarding-gate`)** in `jangtrinh/design-os-hq` and opened [PR #6](https://github.com/jangtrinh/design-os-hq/pull/6).
3. **Spec 001 (`001-zero-placeholder-runtime`) Shipped (`c557818`)**:
   - Audited all 30 routes via Playwright and wired 9 placeholder/broken IPC groups to SQLite (`memory:*`, `benchmark:listRuns`, `syncedFs:storageUsage`, `sandbox:getStatus`, `kit:list`/`kit:install`, and CRUD for `routines`, `agent-db`, `integration`, `meeting`). Verified `11/11` tests passing and `0` route errors across all 30 routes.
4. **Complete Spec Roadmap (`Specs 002–008` + `specs/README.md`) Authored (`ce0f5b8`)**:
   - Scanned all 414 `electronAPI.invoke` channels and 351 `domain:action` operations in `public/_app/immutable/**/*.js` and authored full `spec.md`, `plan.md`, and `tasks.md` packages for `Spec 002` through `Spec 008`.

## Next Step
- Ready to implement `Spec 002` through `Spec 008` in order (or in parallel) per `specs/README.md`.

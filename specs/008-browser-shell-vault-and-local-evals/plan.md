# Implementation Plan — Spec 008: Browser Shell, Password Vault, Multi-Profile & Local Eval Runner

**Spec**: `specs/008-browser-shell-vault-and-local-evals/spec.md`

## 1. File Touch List
- `src/server/sqlite-workspace-store.js`: Add `passwords` (AES-256-GCM), `browser_profiles`, `browsing_history`, `bookmarks`, `downloads`, and `benchmark_runs` tables.
- `src/server/berry-http-server.js`: Add `POST /api/passwords`, `POST /api/browser-data`, and `POST /api/benchmarks`.
- `src/client/berry-electron-domains.js` & `src/client/berry-electron-queries.js`: Wire all 52 `passwords:*`, `profile:*`, `history:*`, `bookmark:*`, `downloads:*`, `sandbox:reset`, and `benchmark:*` channels.
- `test/spec-008-vault-profiles-evals.test.js`: Integration tests for `AC-801` … `AC-804`.

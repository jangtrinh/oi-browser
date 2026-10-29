# Tasks — Spec 008: Browser Shell, Password Vault, Multi-Profile & Local Eval Runner

- [ ] **801.1 (P1 — Encrypted Password Vault & Browser Tables):** Add `passwords`, `browser_profiles`, `browsing_history`, `bookmarks`, `downloads`, and `benchmark_runs` tables to `src/server/sqlite-workspace-store.js`.
- [ ] **801.2 (P1 — Vault, Browser Data & Benchmark APIs):** Expose `POST /api/passwords`, `POST /api/browser-data`, and `POST /api/benchmarks` in `src/server/berry-http-server.js`.
- [ ] **802.1 (P2 — Client Shell, Vault & Eval IPC):** Wire `passwords:*`, `profile:*`, `history:*`, `bookmark:*`, `downloads:*`, `sandbox:reset`, and `benchmark:*` in `src/client/berry-electron-domains.js` and `src/client/berry-electron-queries.js`.
- [ ] **803.1 (P3 — Verification):** Add `test/spec-008-vault-profiles-evals.test.js` covering `AC-801` … `AC-804`.

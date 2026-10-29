# SPEC 008 · Ổi Browser · BSVE — Browser Shell, Password Vault, Multi-Profile & Local Eval Runner

**Spec ID**: `008-browser-shell-vault-and-local-evals`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

Across `/settings/profiles`, `/settings/password`, `/settings/extensions`, `/settings/privacy`, `/settings/downloads`, `/settings/sandbox`, and `/settings/benchmarks`, the SvelteKit UI exposes **52 browser-shell, vault, profile, and local eval execution IPC channels**:
- **Password Vault & Autofill (`/settings/password`)**: `passwords:add`, `passwords:edit`, `passwords:delete`, `passwords:get-by-domain`, `passwords:import-from-csv`, `passwords:import-from-csv-mapped`, `authfill:*`, `profile:getPasswordAccounts`.
- **Browser Profiles, History, Bookmarks & Downloads**: `profile:create-empty`, `profile:update-name`, `profile:update-color`, `profile:clear-all-browser-caches`, `profile:clear-all-cookies-and-site-data`, `history:get-history-chronological`, `history:delete-entries`, `history:clear`, `bookmark:create-folder`, `bookmark:get-info`, `downloads:save-local-file`, `downloads:delete-entry`, `downloads:clear-history`.
- **Extensions & Sandbox Control**: `extensions:delete`, `extensions:get-permissions`, `extensions:revoke-permissions`, `sandbox:reset`, `sandbox:retry-boot`.
- **Interactive Local Benchmark & Eval Runner (`/settings/benchmarks`)**: `benchmark:run-package`, `benchmark:run-test-case`, `benchmark:run-dataset`, `benchmark:runLocalBenchmark`, `benchmark:saveLocalBenchmark`, `benchmark:deleteLocalBenchmark`, `benchmark:getRun`, `benchmark:getTranscript`, `benchmark:getStepLogs`, `benchmark:clearLocalRuns`.

---

## 2. Functional Requirements (`FR-801` … `FR-805`)

### FR-801: Encrypted Local Password Vault & CSV Import (`/settings/password`)
1. Add `passwords` table in `SqliteWorkspaceStore` (`id`, `domain`, `username`, `ciphertext`, `iv`, `created_at`, `updated_at`) encrypted using AES-256-GCM (`node:crypto`) keyed by a local workspace secret in `.berry-data/.vault.key`.
2. Wire `passwords:get-all`, `passwords:get-by-domain`, `passwords:add`, `passwords:edit`, `passwords:delete`, and `passwords:import-from-csv` to `POST /api/passwords`.

### FR-802: Multi-Profile, Bookmarks, History & Downloads Persistence
1. Add `browser_profiles`, `browsing_history`, `bookmarks`, and `downloads` tables in `SqliteWorkspaceStore`.
2. Wire `profile:create-empty`, `profile:update-name`, `profile:update-color`, `history:get-history-chronological`, `history:clear`, `bookmark:create-folder`, `downloads:get-history`, `downloads:delete-entry`, and `downloads:clear-history` to `POST /api/browser-data`.
3. Wire `profile:clear-all-browser-caches` and `profile:clear-all-cookies-and-site-data` (`Clear Cache` / `Clear Cookies` buttons in `/settings/privacy` and `/settings/storage`) to reset transient cache tables and return `{ success: true, message: "Browser cache and temporary site data cleared." }`.

### FR-803: Sandbox Reset (`sandbox:reset`)
1. Wire `sandbox:reset` and `sandbox:retry-boot` (`Reset sandbox` button in `/settings/sandbox`) to reset `GuardrailsSanitizer` counters, verify CLI harness binaries, and emit `sandbox:status-changed` (`status: "ready"`).

### FR-804: Interactive Local Benchmark & Eval Runner (`/settings/benchmarks`)
1. Add `benchmark_runs` table in `SqliteWorkspaceStore` storing full execution transcripts and step logs.
2. Wire `benchmark:run-package`, `benchmark:run-test-case`, `benchmark:runLocalBenchmark`, `benchmark:getRun`, `benchmark:getTranscript`, `benchmark:getStepLogs`, and `benchmark:clearLocalRuns` to `POST /api/benchmarks` so clicking `Run` on any package or task in `/settings/benchmarks` executes the real OpenJarvis / CLI evaluation suite and stores inspectable run transcripts.

---

## 3. Acceptance Criteria (`AC-801` … `AC-804`)

- **AC-801:** Adding, editing, importing CSV, and deleting passwords via `passwords:*` stores AES-256-GCM encrypted records in SQLite `passwords` and lists them in `/settings/password`.
- **AC-802:** Creating and renaming a browser profile (`profile:create-empty`, `profile:update-name`) or clearing history/downloads (`history:clear`, `downloads:clear-history`) persists in SQLite.
- **AC-803:** Clicking `Reset sandbox` in `/settings/sandbox` (`sandbox:reset`) executes a clean reset and returns `{ status: "ready", isSandboxed: true }`.
- **AC-804:** Running a benchmark package via `benchmark:run-package` or inspecting a run via `benchmark:getRun` / `benchmark:getTranscript` executes and returns real step-by-step evaluation logs.

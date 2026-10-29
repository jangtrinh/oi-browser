# Feature Context: Zero-Placeholder Runtime (`Spec 001`)

## Overview
- **Spec Package**: `specs/001-zero-placeholder-runtime/{spec.md,plan.md,tasks.md}` (Shipped in commit `c557818`).
- **Scope**: Eliminates all placeholder/mock failures across all 30 routes of `Ổi Browser` by wiring every SvelteKit 5 IPC query/command to persistent SQLite tables (`src/server/sqlite-workspace-store.js`) and HTTP routes (`src/server/berry-http-server.js`).

## Critical SvelteKit 5 IPC Payload Contracts
1. **Memory (`/settings/memory` — `nodes/91.2yx-qW4W.js`)**:
   - `memory:read-curated-file` -> `{ content: string, path: string, updatedAt: number }` (reads `~/.oi-browser/karpathy-wiki/CLAUDE.md`).
   - `memory:backfill:estimate` -> `{ messageCount: 0, conversationCount, estimatedTokens: 0 }` (`messageCount === 0` renders `"Up to date — no new messages."`).
   - `memory:reflect-only:estimate` -> `{ totalDays: 0, unreflectedSessions: 0 }`.
2. **Benchmarks (`/settings/benchmarks` — `nodes/76.CTiGgXd6.js` & `chunks/CXSfSeMt.js`)**:
   - `benchmark:listRuns` -> `{ success: true, page: { runs, count, page, pageSize, totalPages } }` where each run has `{ id, benchmark_id, benchmarks: { title }, status, passed, score, duration_ms, session_cost: 0, eval_cost: 0, created_at, batch_id }`.
3. **Storage (`/settings/storage` — `nodes/99.BwwajlhF.js`)**:
   - `syncedFs:storageUsage` -> `{ totalBytes, locations: [{ id, name, path, sizeBytes, fileCount }], breakdown }`.
4. **Browser Sandbox (`/settings/browser` — `nodes/78.D2E_o65T.js`)**:
   - `sandbox:getStatus` -> `{ running: true, status: "running", mode: "local-playwright", engine: "Chromium (Local Profile)", pid }`.
5. **Use Cases Gallery (`/use-cases`)**:
   - `kit:list` -> 4 seeded Vietnamese/English starter kits in SQLite `starter_kits`, installable via `kit:install` (`POST /api/kits/install`).

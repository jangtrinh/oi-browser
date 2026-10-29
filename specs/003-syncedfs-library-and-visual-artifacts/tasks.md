# Tasks — Spec 003: SyncedFS Workspace, Library CRUD & Visual Artifacts Engine

- [ ] **301.1 (P1 — Versioning & Trash in Wiki Engine):** Add `.versions/` and `.trash/` management to `src/server/karpathy-wiki-memory-engine.js`.
- [ ] **301.2 (P1 — `/api/fs` & `/api/artifacts/export` Endpoints):** Expose file CRUD, version restore, trash restore, and CSV/Markdown artifact export in `src/server/berry-http-server.js`.
- [ ] **302.1 (P2 — Client SyncedFS & Artifact IPC):** Wire `synced-fs:*`, `syncedFs:*`, `fs:*`, `file:*`, `artifact-db:*`, `artifact-app:*`, `table:save-as-csv`, `table:save-as-xlsx`, and `report:export-pdf` in `src/client/berry-electron-queries.js`.
- [ ] **303.1 (P3 — Verification):** Add `test/spec-003-syncedfs-artifacts.test.js` covering `AC-301` … `AC-304`.

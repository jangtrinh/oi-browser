# Implementation Plan — Spec 003: SyncedFS Workspace, Library CRUD & Visual Artifacts Engine

**Spec**: `specs/003-syncedfs-library-and-visual-artifacts/spec.md`

## 1. File Touch List
- `src/server/karpathy-wiki-memory-engine.js`: Add `deleteFile()`, `listRecentlyDeleted()`, `restoreDeleted()`, `listVersions(relPath)`, `restoreVersion(relPath, versionId)`.
- `src/server/berry-http-server.js`: Add `POST /api/fs` (CRUD, versions, trash) and `GET /api/artifacts/export`.
- `src/client/berry-electron-queries.js` & `src/client/berry-electron-domains.js`: Wire all `synced-fs:*`, `syncedFs:*`, `fs:*`, `file:*`, `table:*`, `report:*`, and `artifact-*` IPC calls.
- `test/spec-003-syncedfs-artifacts.test.js`: Integration tests for `AC-301` … `AC-304`.

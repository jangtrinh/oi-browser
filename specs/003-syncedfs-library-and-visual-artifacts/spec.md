# SPEC 003 · Ổi Browser · SLVA — SyncedFS Workspace, Library CRUD & Visual Artifacts Engine

**Spec ID**: `003-syncedfs-library-and-visual-artifacts`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

While `/library` lists Karpathy-Wiki files and artifacts (`Spec 001`), the SvelteKit Library & Artifact surfaces expose **44 filesystem, version history, trash recovery, and artifact export IPC channels** that are not yet wired to disk/SQLite:
- **SyncedFS Read/Write/Delete/Search & Versioning**: `synced-fs:read`, `synced-fs:write`, `synced-fs:delete`, `synced-fs:search`, `syncedFs:searchFiles`, `synced-fs:list-versions`, `synced-fs:read-version`, `synced-fs:restore-version`, `synced-fs:list-recently-deleted`, `synced-fs:restore-deleted`, `synced-fs:restore-all-deleted`.
- **Host/Local File Bridge (`fs:*` & `file:*`)**: `fs:list-roots`, `fs:list-files`, `fs:read-file`, `fs:read-file-base64`, `fs:edit-file`, `fs:copy-files-into-folder`, `file:read-as-data-url`, `file:save-as`, `knowledge:read-file-data-url`, `knowledge:show-in-folder`.
- **Interactive Visual Artifacts & Exports**: `artifact-app:request`, `artifact-db:request`, `artifact-db:create-capability-set`, `artifact:get-bundle-file-url`, `visual-artifacts:resolve-preview`, `table:save-as-csv`, `table:save-as-xlsx`, `report:export-pdf`, `document-viewer:get-source`.

---

## 2. Functional Requirements (`FR-301` … `FR-305`)

### FR-301: Full SyncedFS CRUD, Version Snapshots & Trash Recovery
1. Extend `KarpathyWikiMemoryEngine` (`src/server/karpathy-wiki-memory-engine.js`) with:
   - `.versions/<sha256>` snapshots written automatically whenever `writeFile(relPath, content)` overwrites an existing file.
   - `.trash/<relPath>` soft-delete directory when `deleteFile(relPath)` is invoked, enabling `listRecentlyDeleted()`, `restoreDeleted(relPath)`, and `restoreAllDeleted()`.
2. Wire `synced-fs:read`, `synced-fs:write`, `synced-fs:delete`, `synced-fs:list-versions`, `synced-fs:read-version`, `synced-fs:restore-version`, `synced-fs:list-recently-deleted`, `synced-fs:restore-deleted`, and `synced-fs:restore-all-deleted` to `POST /api/fs` in `berry-http-server.js`.

### FR-302: SQLite FTS5 Search for `/library` (`synced-fs:search` & `syncedFs:searchFiles`)
1. Wire `synced-fs:search` and `syncedFs:searchFiles` directly to `GET /api/memory/search?q=<query>` (`WikiFtsIndex` BM25 search) so searching inside `/library` returns ranked file matches with snippets in `< 15ms`.

### FR-303: Interactive Artifact Sandbox Apps & Scoped Artifact DB (`artifact-app:request`, `artifact-db:request`)
1. Wire `artifact-db:request` and `artifact-db:create-capability-set` to a scoped SQLite table namespace (`artifact_kv_<artifactId>`) in `workspace.sqlite` so interactive HTML/Svelte visual artifacts can persist stateful rows and cells.
2. Wire `artifact-app:request` and `visual-artifacts:resolve-preview` to serve rendered HTML/Markdown/Spreadsheet previews from `GET /api/artifacts/preview?id=<artifactId>`.

### FR-304: Table & Report Exports (`table:save-as-csv`, `table:save-as-xlsx`, `report:export-pdf`)
1. Add `GET /api/artifacts/export?id=<id>&format=csv|tsv|md|html` in `berry-http-server.js` converting `artifact.columns` + `artifact.rows` into downloadable CSV/TSV/Markdown/HTML files and recording the download in SQLite `downloads`.

---

## 3. Acceptance Criteria (`AC-301` … `AC-304`)

- **AC-301:** Editing a file via `synced-fs:write` creates a version entry visible in `synced-fs:list-versions` and restorable via `synced-fs:restore-version`.
- **AC-302:** Deleting a file via `synced-fs:delete` moves it to `.trash/`, lists it in `synced-fs:list-recently-deleted`, and restores it intact via `synced-fs:restore-deleted`.
- **AC-303:** Searching in `/library` via `syncedFs:searchFiles` returns BM25-ranked matches from `WikiFtsIndex`.
- **AC-304:** Exporting a spreadsheet artifact via `table:save-as-csv` generates valid RFC-4180 CSV content from `artifact.columns` and `artifact.rows`.

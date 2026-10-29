# Tasks — Spec 004: Companions Studio, 3D Avatar Customizer & Skills Forge

- [ ] **401.1 (P1 — Skill Disk CRUD):** Extend `src/server/skill-catalog-loader.js` and `src/server/berry-http-server.js` (`GET/POST /api/skills`) to read, create, update, and delete `SKILL.md` folders on disk.
- [ ] **401.2 (P1 — Companion Update/Hide API):** Extend `SqliteWorkspaceStore` and `POST /api/companions` to support `update`, `setHidden`, and `delete`.
- [ ] **402.1 (P2 — Client Skills & Companion IPC):** Wire `skills:create-folder`, `skills:get-folder`, `skills:update-folder`, `skills:delete-folder`, `companions:saveProfile`, `companions:setHidden`, `companions:get-pinned-files`, and `chat:request-update-companion` in `src/client/berry-electron-queries.js`.
- [ ] **403.1 (P3 — Verification):** Add `test/spec-004-companions-skills.test.js` covering `AC-401` … `AC-403`.

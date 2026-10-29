# Implementation Plan — Spec 004: Companions Studio, 3D Avatar Customizer & Skills Forge

**Spec**: `specs/004-companions-studio-and-skills-forge/spec.md`

## 1. File Touch List
- `src/server/sqlite-workspace-store.js`: Add `updateCompanion(id, patch)` and `deleteCompanion(id)`.
- `src/server/skill-catalog-loader.js`: Add `getSkillFolder(slug)`, `saveSkillFolder({ slug, title, description, instructions })`, and `deleteSkillFolder(slug)`.
- `src/server/berry-http-server.js`: Extend `POST /api/companions` (`update`, `delete`) and add `GET/POST /api/skills`.
- `src/client/berry-electron-queries.js`: Wire `skills:create-folder`, `skills:get-folder`, `skills:update-folder`, `skills:delete-folder`, `companions:saveProfile`, `companions:setHidden`, `chat:request-create-companion`, `chat:request-update-companion`.
- `test/spec-004-companions-skills.test.js`: Integration tests for `AC-401` … `AC-403`.

# SPEC 004 · Ổi Browser · CSSF — Companions Studio, 3D Avatar Customizer & Skills Forge

**Spec ID**: `004-companions-studio-and-skills-forge`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

While the 9 official Vietnamese fruit companions (`Ổi`, `Măng Cụt`, `Sầu Riêng`, `Thanh Long`, `Bưởi`, `Vú Sữa`, `Xoài`, `Chôm Chôm`, `Vải`) and 31 official skills are seeded on startup, the SvelteKit Companions & `/skills` views expose **32 companion authoring and skill CRUD channels** that are not yet wired to SQLite and disk (`skills/`):
- **Companion Creation, Editing & Visibility**: `chat:request-create-companion`, `chat:request-update-companion`, `companions:saveProfile`, `companions:setHidden`, `companions:companion-exists`, `companions:get-pinned-files`, `companions:share-companion`, `onboarding:update-companion-customization`, `onboarding:adopt-hired-companion`.
- **Skills Forge (`Create Skill` / Edit / Delete in `/skills`)**: `skills:create-folder`, `skills:get-folder`, `skills:update-folder`, `skills:delete-folder`, `companions:deleteLocalSkill`.

---

## 2. Functional Requirements (`FR-401` … `FR-404`)

### FR-401: Full Companion CRUD & Profile Customization
1. Extend `SqliteWorkspaceStore` (`companions` table) with `updateCompanion(id, patch)` (`name`, `role`, `summary`, `systemPrompt`, `skills`, `appearance`, `isHidden`) and `deleteCompanion(id)`.
2. Wire `chat:request-create-companion`, `chat:request-update-companion`, `companions:saveProfile`, `companions:setHidden`, and `onboarding:update-companion-customization` to `POST /api/companions` (`create`, `update`, `hide`, `delete`).
3. Automatically sync `companions/<id>/COMPANION.md` in Karpathy-Wiki and re-index in `WikiFtsIndex` on every companion create/update.

### FR-402: Skills Forge (`skills:create-folder`, `skills:update-folder`, `skills:delete-folder`, `skills:get-folder`)
1. Add `GET /api/skills` and `POST /api/skills` (`create`, `update`, `delete`) in `berry-http-server.js` backed by `SkillCatalogLoader` (`src/server/skill-catalog-loader.js`):
   - `skills:create-folder`: creates `skills/custom/<slug>/SKILL.md` with YAML frontmatter (`name`, `description`, `user-invocable: true`) + Markdown instructions, and re-indexes `SkillCatalogLoader`.
   - `skills:get-folder`: reads the real `SKILL.md` and companion files from `skills/<category>/<slug>/SKILL.md` (not a truncated preview).
   - `skills:update-folder`: writes updated `SKILL.md` content to disk and refreshes `skills.folders` + `skills.list` IPC topics.
   - `skills:delete-folder` & `companions:deleteLocalSkill`: removes custom skill folder and detaches from companion `skills_json`.

### FR-403: Pinned Companion Files (`companions:get-pinned-files`)
1. Return the companion's dedicated `companions/<id>/COMPANION.md` and linked entity files from Karpathy-Wiki.

---

## 3. Acceptance Criteria (`AC-401` … `AC-403`)

- **AC-401:** Clicking `Create Skill` in `/skills` (`skills:create-folder`) writes a real `SKILL.md` file on disk, updates `SkillCatalogLoader`, and immediately appears in `/skills` and `<available_skills>` XML.
- **AC-402:** Opening any skill in `/skills` (`skills:get-folder`) loads the full, untruncated `SKILL.md` file from disk, and saving edits via `skills:update-folder` persists across server restarts.
- **AC-403:** Creating or updating a companion via `companions:saveProfile` / `chat:request-update-companion` updates SQLite `companions` and `COMPANION.md` and publishes `companions.list`.

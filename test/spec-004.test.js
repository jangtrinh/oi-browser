import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { KarpathyWikiMemoryEngine } from "../src/server/karpathy-wiki-memory-engine.js";
import { WikiFtsIndex } from "../src/server/wiki-fts-index.js";
import { SkillCatalogLoader } from "../src/server/skill-catalog-loader.js";
import { Spec004CompanionsSkillsService } from "../src/server/domains/spec-004-companions-skills.js";

test("Spec 004: Companions Studio, 3D Avatar Customizer & Skills Forge", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-spec-004-"));
  const dbPath = path.join(tmpDir, "workspace.sqlite");
  const wikiDir = path.join(tmpDir, "karpathy-wiki");
  const skillsDir = path.join(tmpDir, "skills");

  // Seed one category skill in temporary skillsDir to test category lookup
  const seededCategoryDir = path.join(skillsDir, "general", "deep-audit");
  fs.mkdirSync(seededCategoryDir, { recursive: true });
  const longBody = Array.from(
    { length: 40 },
    (_, i) => `Step ${i + 1}: Execute deterministic audit verification step #${i + 1} without truncation.`
  ).join("\n");
  fs.writeFileSync(
    path.join(seededCategoryDir, "SKILL.md"),
    [
      "---",
      "name: deep-audit",
      "description: Perform deep untruncated repository and DOM audits.",
      "user-invocable: true",
      "---",
      "",
      "# Deep Audit Skill",
      "",
      longBody
    ].join("\n"),
    "utf8"
  );

  const store = new SqliteWorkspaceStore(dbPath);
  const memory = new KarpathyWikiMemoryEngine(wikiDir);
  const wikiFts = new WikiFtsIndex({ db: store.db, memory });
  const skillCatalog = new SkillCatalogLoader(skillsDir);
  const service = new Spec004CompanionsSkillsService({
    store,
    memory,
    wikiFts,
    skillCatalog,
    skillsDir
  });

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("AC-401: skills:create-folder writes SKILL.md on disk, reloads SkillCatalogLoader, and appears in <available_skills> XML", async () => {
    const res = await service.handleChannel("skills:create-folder", {
      name: "Playwright DOM Harvester!",
      description: "Harvest structured tables and DOM metrics from live pages.",
      instructions: "# Playwright DOM Harvester\n\n1. Inspect `[data-oi-id]` nodes.\n2. Export clean markdown tables."
    });

    assert.equal(res.success, true);
    assert.equal(res.folder.name, "playwright-dom-harvester");
    assert.equal(res.folder.frontmatter["user-invocable"], true);
    assert.equal(
      res.folder.frontmatter.description,
      "Harvest structured tables and DOM metrics from live pages."
    );

    const expectedPath = path.join(skillsDir, "custom", "playwright-dom-harvester", "SKILL.md");
    assert.equal(res.folder.path, expectedPath);
    assert.equal(fs.existsSync(expectedPath), true);

    const inCatalog = skillCatalog.catalog.find((s) => s.slug === "playwright-dom-harvester");
    assert.ok(inCatalog, "Newly created skill should be indexed in SkillCatalogLoader");
    assert.equal(inCatalog.category, "custom");

    const prog = skillCatalog.buildProgressiveContext({
      companionSkills: ["playwright-dom-harvester"],
      prompt: "playwright harvester tables"
    });
    assert.ok(
      prog.xmlCatalog.includes('<skill name="playwright-dom-harvester" category="custom"'),
      "Skill should appear in <available_skills> XML"
    );
    assert.ok(prog.activatedSkills.includes("playwright-dom-harvester"));
  });

  await t.test("AC-402: skills:get-folder loads untruncated SKILL.md and skills:update-folder persists across restarts", async () => {
    // 1. Read seeded category skill and verify full untruncated content (>1500 chars)
    const getCategoryRes = await service.handleChannel("skills:get-folder", {
      slug: "deep-audit"
    });
    assert.equal(getCategoryRes.success, true);
    assert.equal(getCategoryRes.folder.name, "deep-audit");
    assert.ok(getCategoryRes.folder.content.length > 1500);
    assert.ok(getCategoryRes.folder.instructions.includes("Step 40: Execute deterministic audit verification step #40 without truncation."));

    // 2. Update custom skill via skills:update-folder
    const updatedInstructions = [
      "# Playwright DOM Harvester v2",
      "",
      "## Updated Protocol",
      "- Capture full accessibility tree and table rows without truncation.",
      "- Persist directly to SQLite artifacts."
    ].join("\n");

    const updateRes = await service.handleChannel("skills:update-folder", {
      slug: "playwright-dom-harvester",
      description: "Updated v2 harvester description.",
      instructions: updatedInstructions
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.folder.frontmatter.description, "Updated v2 harvester description.");
    assert.ok(updateRes.folder.instructions.includes("## Updated Protocol"));

    // 3. Simulate restart with fresh SkillCatalogLoader and Spec004CompanionsSkillsService
    const restartedCatalog = new SkillCatalogLoader(skillsDir);
    const restartedService = new Spec004CompanionsSkillsService({
      store,
      memory,
      wikiFts,
      skillCatalog: restartedCatalog,
      skillsDir
    });
    const afterRestart = await restartedService.handleChannel("skills:get-folder", {
      name: "playwright-dom-harvester"
    });
    assert.equal(afterRestart.success, true);
    assert.equal(afterRestart.folder.frontmatter.description, "Updated v2 harvester description.");
    assert.ok(afterRestart.folder.instructions.includes("Playwright DOM Harvester v2"));
  });

  await t.test("AC-403 & FR-401/FR-403: Companion CRUD, customization, COMPANION.md sync, FTS re-index, pinned files, and skill detachment", async () => {
    // 1. Create a new companion via chat:request-create-companion
    const createRes = await service.handleChannel("chat:request-create-companion", {
      id: "custom-mang-cau",
      name: "Mãng Cầu",
      role: "Chuyên gia Phân tích Dữ liệu",
      summary: "Trợ lý phân tích dữ liệu chuyên sâu cho Ổi Browser.",
      systemPrompt: "Luôn trích dẫn nguồn dữ liệu từ Karpathy-Wiki.",
      accentHue: 142,
      skills: ["playwright-dom-harvester", "deep-audit"],
      appearance: {
        color: { body: "#4ade80", cheeks: "#f472b6" },
        head: { type: "leaf-crown" }
      }
    });

    assert.equal(createRes.success, true);
    assert.equal(createRes.companion.id, "custom-mang-cau");
    assert.equal(createRes.companion.name, "Mãng Cầu");
    assert.equal(createRes.companion.accent_hue, 142);
    assert.deepEqual(createRes.companion.skills, ["playwright-dom-harvester", "deep-audit"]);
    assert.equal(createRes.companion.appearance.color.body, "#4ade80");

    // Verify COMPANION.md was created in Karpathy-Wiki and indexed in WikiFtsIndex
    const companionMd = memory.readFile("companions/custom-mang-cau/COMPANION.md");
    assert.ok(companionMd.includes("# Mãng Cầu — Companion Memory"));
    assert.ok(companionMd.includes("`playwright-dom-harvester`"));
    const ftsSearch = wikiFts.search("Mang Cau Phan tich Du lieu", 5);
    assert.ok(ftsSearch.results.some((r) => r.path === "companions/custom-mang-cau/COMPANION.md"));

    // 2. Check companions:companion-exists
    const existsRes = await service.handleChannel("companions:companion-exists", {
      companionId: "custom-mang-cau"
    });
    assert.equal(existsRes.exists, true);
    assert.equal(existsRes.companionId, "custom-mang-cau");

    // 3. Update companion via companions:saveProfile & onboarding:update-companion-customization
    const updateRes = await service.handleChannel("companions:saveProfile", {
      companionId: "custom-mang-cau",
      name: "Mãng Cầu Xiêm",
      role: "Kiến trúc sư Dữ liệu & BI",
      summary: "Đã nâng cấp kỹ năng tổng hợp báo cáo BI.",
      systemPrompt: "Ưu tiên xuất bảng tính trực quan.",
      accentHue: 160,
      appearance: {
        color: { body: "#22c55e", cheeks: "#fb7185" },
        accessory: { type: "glasses-round" }
      },
      pinnedFiles: ["entities/companies/oi-browser.md"]
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.companion.name, "Mãng Cầu Xiêm");
    assert.equal(updateRes.companion.role, "Kiến trúc sư Dữ liệu & BI");
    assert.equal(updateRes.companion.accent_hue, 160);
    assert.equal(updateRes.companion.appearance.accessory.type, "glasses-round");

    const updatedMd = memory.readFile("companions/custom-mang-cau/COMPANION.md");
    assert.ok(updatedMd.includes("# Mãng Cầu Xiêm — Companion Memory"));
    assert.ok(updatedMd.includes("Đã nâng cấp kỹ năng tổng hợp báo cáo BI."));

    // 4. Verify companions:get-pinned-files (FR-403)
    const pinnedRes = await service.handleChannel("companions:get-pinned-files", {
      companionId: "custom-mang-cau"
    });
    assert.equal(pinnedRes.success, true);
    assert.ok(
      pinnedRes.files.some(
        (f) => f.path === "companions/custom-mang-cau/COMPANION.md" && f.title === "COMPANION.md"
      )
    );
    assert.ok(
      pinnedRes.files.some((f) => f.path === "entities/companies/oi-browser.md" && f.content.includes("# Ổi Browser"))
    );

    // 5. Verify companions:setHidden, companions:share-companion, onboarding:adopt-hired-companion
    const hideRes = await service.handleChannel("companions:setHidden", {
      companionId: "custom-mang-cau",
      isHidden: true
    });
    assert.equal(hideRes.success, true);
    assert.equal(hideRes.isHidden, true);
    assert.equal(service.getCompanion("custom-mang-cau").isHidden, true);

    const shareRes = await service.handleChannel("companions:share-companion", {
      companionId: "custom-mang-cau"
    });
    assert.equal(shareRes.success, true);
    assert.equal(shareRes.shareUrl, "berry://companions/custom-mang-cau");

    const adoptRes = await service.handleChannel("onboarding:adopt-hired-companion", {
      companionId: "custom-mang-cau"
    });
    assert.equal(adoptRes.success, true);
    assert.equal(adoptRes.shareUrl, "berry://companions/custom-mang-cau");
    assert.equal(service.getCompanion("custom-mang-cau").isHired, true);

    // 6. Delete skill via companions:deleteLocalSkill and verify detachment from companion skills_json
    const deleteSkillRes = await service.handleChannel("companions:deleteLocalSkill", {
      slug: "playwright-dom-harvester"
    });
    assert.equal(deleteSkillRes.success, true);
    assert.equal(deleteSkillRes.deletedSlug, "playwright-dom-harvester");
    assert.equal(
      fs.existsSync(path.join(skillsDir, "custom", "playwright-dom-harvester", "SKILL.md")),
      false
    );
    const companionAfterSkillDelete = service.getCompanion("custom-mang-cau");
    assert.deepEqual(companionAfterSkillDelete.skills, ["deep-audit"]);

    // 7. Unknown channel returns null
    const unknownRes = await service.handleChannel("non-existent:channel", {});
    assert.equal(unknownRes, null);
  });
});

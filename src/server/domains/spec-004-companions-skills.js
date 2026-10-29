import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { OFFICIAL_COMPANIONS } from "../official-companions-catalog.js";

const OFFICIAL_MAP = new Map(OFFICIAL_COMPANIONS.map((c) => [c.id, c]));
const DEFAULT_APPEARANCE = OFFICIAL_COMPANIONS[0]?.appearance || {};

function sanitizeSlug(raw = "") {
  const str = String(raw || "").trim();
  const tail = str.includes("/") ? str.split("/").filter(Boolean).pop() || str : str;
  return (
    tail
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "custom-skill"
  );
}

function stripQuotes(val = "") {
  const s = String(val ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseSkillMarkdown(rawContent = "", fallbackSlug = "") {
  const content = String(rawContent ?? "");
  const frontmatter = {
    name: fallbackSlug,
    description: "",
    "user-invocable": true
  };
  let instructions = content;

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    const yamlBlock = fmMatch[1];
    instructions = fmMatch[2].replace(/^\r?\n/, "");
    const lines = yamlBlock.split(/\r?\n/);
    for (const line of lines) {
      const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (!kv) continue;
      const key = kv[1].trim();
      const rawVal = stripQuotes(kv[2]);
      if (rawVal === "true") frontmatter[key] = true;
      else if (rawVal === "false") frontmatter[key] = false;
      else frontmatter[key] = rawVal;
    }
  }

  return {
    frontmatter,
    instructions,
    content
  };
}

function serializeSkillMarkdown({ slug, frontmatter = {}, instructions = "" }) {
  const name = frontmatter.name || slug || "custom-skill";
  const description = frontmatter.description ?? "";
  const userInvocable =
    frontmatter["user-invocable"] !== undefined ? Boolean(frontmatter["user-invocable"]) : true;
  const cleanBody = String(instructions ?? "").replace(/^\r?\n+/, "");
  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    `user-invocable: ${userInvocable}`,
    "---",
    "",
    cleanBody.endsWith("\n") ? cleanBody : `${cleanBody}\n`
  ].join("\n");
}

export class Spec004CompanionsSkillsService {
  constructor({ store, memory, wikiFts, skillCatalog, skillsDir } = {}) {
    this.store = store || null;
    this.memory = memory || null;
    this.wikiFts = wikiFts || null;
    this.skillCatalog = skillCatalog || null;
    this.skillsDir = skillsDir || skillCatalog?.skillsRoot || path.join(process.cwd(), "skills");

    if (this.skillCatalog && skillsDir && (!this.skillCatalog.skillsRoot || !fs.existsSync(this.skillCatalog.skillsRoot))) {
      this.skillCatalog.skillsRoot = skillsDir;
      this.skillCatalog.loadCatalog?.();
    }

    if (
      this.wikiFts &&
      typeof this.wikiFts.indexAll !== "function" &&
      typeof this.wikiFts.syncAllFromDisk === "function"
    ) {
      this.wikiFts.indexAll = () => this.wikiFts.syncAllFromDisk();
    }

    this.initSchema();
  }

  initSchema() {
    if (!this.store?.db) return;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS companion_customizations (
        companion_id TEXT PRIMARY KEY,
        appearance_json TEXT DEFAULT '{}',
        is_hidden INTEGER DEFAULT 0,
        pinned_files_json TEXT DEFAULT '[]',
        share_token TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  getCustomizationRow(companionId) {
    if (!this.store?.db || !companionId) return null;
    return (
      this.store.db
        .prepare("SELECT * FROM companion_customizations WHERE companion_id = ?")
        .get(companionId) || null
    );
  }

  upsertCustomization(
    companionId,
    { appearance, isHidden, pinnedFiles, shareToken } = {}
  ) {
    if (!this.store?.db || !companionId) return null;
    const cur = this.getCustomizationRow(companionId);
    let nextAppearanceJson = cur?.appearance_json || "{}";
    if (appearance !== undefined) {
      nextAppearanceJson =
        typeof appearance === "string" ? appearance : JSON.stringify(appearance || {});
    }
    const nextIsHidden =
      isHidden !== undefined ? (isHidden ? 1 : 0) : (cur?.is_hidden ?? 0);
    let nextPinnedJson = cur?.pinned_files_json || "[]";
    if (pinnedFiles !== undefined) {
      nextPinnedJson =
        typeof pinnedFiles === "string" ? pinnedFiles : JSON.stringify(pinnedFiles || []);
    }
    const nextShareToken =
      shareToken !== undefined ? shareToken : (cur?.share_token ?? null);
    const now = Date.now();

    this.store.db
      .prepare(
        `INSERT OR REPLACE INTO companion_customizations
         (companion_id, appearance_json, is_hidden, pinned_files_json, share_token, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        companionId,
        nextAppearanceJson,
        nextIsHidden,
        nextPinnedJson,
        nextShareToken,
        now
      );

    return this.getCustomizationRow(companionId);
  }

  formatCompanionRow(row) {
    if (!row) return null;
    const off = OFFICIAL_MAP.get(row.id);
    const cust = this.getCustomizationRow(row.id);

    let skills = [];
    try {
      skills = JSON.parse(row.skills_json || "[]");
    } catch {
      skills = [];
    }

    let customAppearance = null;
    if (cust?.appearance_json) {
      try {
        const parsed = JSON.parse(cust.appearance_json);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          customAppearance = parsed;
        }
      } catch {
        customAppearance = null;
      }
    }

    let pinnedFiles = [];
    if (cust?.pinned_files_json) {
      try {
        pinnedFiles = JSON.parse(cust.pinned_files_json);
      } catch {
        pinnedFiles = [];
      }
    }

    const appearance = customAppearance || off?.appearance || DEFAULT_APPEARANCE;
    const isHidden = Boolean(cust?.is_hidden);

    return {
      ...row,
      id: row.id,
      name: row.name || off?.name || "Companion",
      fullName: row.name || off?.fullName || "Companion",
      role: row.role || off?.role || "AI Specialist",
      avatar: row.avatar || off?.avatar || "AI",
      accent_hue: row.accent_hue,
      accentHue: row.accent_hue,
      summary: row.summary ?? off?.summary ?? "",
      skills_json: row.skills_json || JSON.stringify(skills),
      skills,
      system_prompt: row.system_prompt ?? "",
      systemPrompt: row.system_prompt ?? "",
      is_hired: row.is_hired ?? 1,
      isHired: Boolean(row.is_hired ?? 1),
      is_hidden: cust?.is_hidden ?? 0,
      isHidden,
      appearance,
      appearance_json: cust?.appearance_json || JSON.stringify(appearance || {}),
      pinnedFiles,
      pinned_files_json: cust?.pinned_files_json || "[]",
      shareToken: cust?.share_token || null,
      shareUrl: `berry://companions/${row.id}`,
      visualsSeed: off?.visualsSeed || row.id,
      defaultChatMode: off?.defaultChatMode || "expert",
      contentHash: off?.contentHash || row.id,
      profile: {
        ...(off?.profile || {}),
        summary: row.summary ?? off?.summary ?? "",
        templateSkills: skills,
        about: row.summary ?? off?.summary ?? ""
      }
    };
  }

  getCompanion(companionId) {
    if (!this.store?.db || !companionId) return null;
    const row = this.store.db
      .prepare("SELECT * FROM companions WHERE id = ?")
      .get(companionId);
    return this.formatCompanionRow(row);
  }

  listCompanions({ includeHidden = true } = {}) {
    if (!this.store?.db) return [];
    const rows = this.store.db
      .prepare("SELECT * FROM companions ORDER BY rowid ASC")
      .all();
    const mapped = rows.map((r) => this.formatCompanionRow(r));
    return includeHidden ? mapped : mapped.filter((c) => !c.isHidden);
  }

  syncCompanionMarkdown(companion) {
    if (!this.memory || !companion?.id) return null;
    const relPath = `companions/${companion.id}/COMPANION.md`;
    const skillsLine =
      Array.isArray(companion.skills) && companion.skills.length > 0
        ? companion.skills.map((s) => `\`${s}\``).join(", ")
        : "None";
    const body = [
      `# ${companion.name} — Companion Memory (\`<companion_memory>\`)`,
      "",
      `- **Role**: ${companion.role}`,
      `- **Summary**: ${companion.summary}`,
      `- **System Prompt**: ${companion.system_prompt || companion.systemPrompt || companion.summary}`,
      `- **Active Skills**: ${skillsLine}`,
      "",
      "## Learned Patterns & Notes",
      "- Prefer structured Visual Artifacts (Documents & Spreadsheets) when synthesizing multi-row data."
    ].join("\n");

    const written = this.memory.writeFile(relPath, `${body}\n`);
    if (typeof this.wikiFts?.indexAll === "function") {
      this.wikiFts.indexAll();
    } else if (typeof this.wikiFts?.syncAllFromDisk === "function") {
      this.wikiFts.syncAllFromDisk();
    }
    return written;
  }

  createCompanion(payload = {}) {
    const name = String(payload.name || payload.fullName || "Custom Companion").trim();
    const id =
      payload.id ||
      payload.companionId ||
      `custom-${sanitizeSlug(name)}-${Date.now().toString(36).slice(-4)}`;
    const role = String(
      payload.role || payload.title || payload.character || "AI Specialist"
    ).trim();
    const avatar = String(payload.avatar || "AI");
    const accentHue = Number(payload.accentHue ?? payload.accent_hue ?? 38);
    const summary = String(payload.summary ?? payload.description ?? role);
    const skills = Array.isArray(payload.skills)
      ? payload.skills
      : typeof payload.skills_json === "string"
        ? JSON.parse(payload.skills_json || "[]")
        : [];
    const systemPrompt = String(
      payload.systemPrompt ?? payload.system_prompt ?? payload.instructions ?? summary
    );
    const isHired =
      payload.isHired !== undefined
        ? payload.isHired
          ? 1
          : 0
        : payload.is_hired !== undefined
          ? payload.is_hired
            ? 1
            : 0
          : 1;

    this.store.db
      .prepare(
        `INSERT OR REPLACE INTO companions
         (id, name, role, avatar, accent_hue, summary, skills_json, system_prompt, is_hired)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        name,
        role,
        avatar,
        accentHue,
        summary,
        JSON.stringify(skills),
        systemPrompt,
        isHired
      );

    const appearance = payload.appearance ?? payload.runtime?.appearance ?? {};
    const isHidden = Boolean(payload.isHidden ?? payload.is_hidden ?? false);
    const pinnedFiles = Array.isArray(payload.pinnedFiles) ? payload.pinnedFiles : [];
    this.upsertCustomization(id, { appearance, isHidden, pinnedFiles });

    const companion = this.getCompanion(id);
    this.syncCompanionMarkdown(companion);

    return {
      success: true,
      companion,
      companions: this.listCompanions()
    };
  }

  updateCompanion(idOrPayload = {}, maybePatch = undefined) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.id || idOrPayload.officialCompanionId;
    const patch =
      typeof idOrPayload === "string" ? maybePatch || {} : idOrPayload || {};

    if (!companionId) {
      return { success: false, error: "companionId is required", companion: null };
    }

    const cur = this.store.db
      .prepare("SELECT * FROM companions WHERE id = ?")
      .get(companionId);
    if (!cur) {
      return { success: false, error: `Companion not found: ${companionId}`, companion: null };
    }

    const runtime = patch.runtime || patch.profile?.runtime || {};
    const nextName = patch.name ?? runtime.name ?? cur.name;
    const nextRole = patch.role ?? patch.title ?? cur.role;
    const nextAvatar = patch.avatar ?? cur.avatar;
    const nextAccentHue = Number(patch.accentHue ?? patch.accent_hue ?? cur.accent_hue);
    const nextSummary = patch.summary ?? patch.description ?? runtime.description ?? cur.summary;
    const nextSystemPrompt =
      patch.systemPrompt ?? patch.system_prompt ?? patch.instructions ?? cur.system_prompt;

    let nextSkillsJson = cur.skills_json;
    if (Array.isArray(patch.skills)) {
      nextSkillsJson = JSON.stringify(patch.skills);
    } else if (typeof patch.skills_json === "string") {
      nextSkillsJson = patch.skills_json;
    }

    const nextIsHired =
      patch.isHired !== undefined
        ? patch.isHired
          ? 1
          : 0
        : patch.is_hired !== undefined
          ? patch.is_hired
            ? 1
            : 0
          : cur.is_hired;

    this.store.db
      .prepare(
        `UPDATE companions
         SET name = ?, role = ?, avatar = ?, accent_hue = ?, summary = ?, skills_json = ?, system_prompt = ?, is_hired = ?
         WHERE id = ?`
      )
      .run(
        nextName,
        nextRole,
        nextAvatar,
        nextAccentHue,
        nextSummary,
        nextSkillsJson,
        nextSystemPrompt,
        nextIsHired,
        companionId
      );

    let nextAppearance = patch.appearance ?? runtime.appearance;
    if (nextAppearance === undefined && typeof patch.appearance_json === "string") {
      try {
        nextAppearance = JSON.parse(patch.appearance_json);
      } catch {
        nextAppearance = undefined;
      }
    }

    const nextIsHidden =
      patch.isHidden !== undefined
        ? Boolean(patch.isHidden)
        : patch.is_hidden !== undefined
          ? Boolean(patch.is_hidden)
          : patch.hidden !== undefined
            ? Boolean(patch.hidden)
            : undefined;

    let nextPinnedFiles = patch.pinnedFiles;
    if (nextPinnedFiles === undefined && typeof patch.pinned_files_json === "string") {
      try {
        nextPinnedFiles = JSON.parse(patch.pinned_files_json);
      } catch {
        nextPinnedFiles = undefined;
      }
    }

    this.upsertCustomization(companionId, {
      appearance: nextAppearance,
      isHidden: nextIsHidden,
      pinnedFiles: nextPinnedFiles,
      shareToken: patch.shareToken ?? patch.share_token
    });

    const companion = this.getCompanion(companionId);
    this.syncCompanionMarkdown(companion);

    return {
      success: true,
      companion,
      companions: this.listCompanions()
    };
  }

  setCompanionHidden(idOrPayload = {}, maybeHidden = undefined) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.id;
    const isHidden = Boolean(
      maybeHidden !== undefined
        ? maybeHidden
        : idOrPayload.isHidden ?? idOrPayload.is_hidden ?? idOrPayload.hidden ?? true
    );

    this.upsertCustomization(companionId, { isHidden });

    if (
      typeof idOrPayload === "object" &&
      idOrPayload !== null &&
      (idOrPayload.isHired !== undefined || idOrPayload.is_hired !== undefined)
    ) {
      const nextHired = (idOrPayload.isHired ?? idOrPayload.is_hired) ? 1 : 0;
      this.store.db
        .prepare("UPDATE companions SET is_hired = ? WHERE id = ?")
        .run(nextHired, companionId);
    }

    return {
      success: true,
      companionId,
      isHidden
    };
  }

  companionExists(idOrPayload = {}) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.id || idOrPayload.name || "";
    const row = this.store.db
      .prepare("SELECT id FROM companions WHERE id = ? OR LOWER(name) = LOWER(?)")
      .get(companionId, companionId);
    return {
      exists: Boolean(row),
      companionId: row?.id || companionId
    };
  }

  shareCompanion(idOrPayload = {}) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.officialCompanionId || idOrPayload.id;
    const shareToken =
      (typeof idOrPayload === "object" && (idOrPayload.shareToken || idOrPayload.share_token)) ||
      `share-${companionId}-${crypto.randomUUID().slice(0, 8)}`;

    this.upsertCustomization(companionId, { shareToken });
    return {
      success: true,
      companionId,
      shareToken,
      shareUrl: `berry://companions/${companionId}`
    };
  }

  adoptHiredCompanion(idOrPayload = {}) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.officialCompanionId || idOrPayload.id;
    const shareToken =
      (typeof idOrPayload === "object" && (idOrPayload.shareToken || idOrPayload.share_token)) ||
      `adopted-${companionId}`;

    this.store.db
      .prepare("UPDATE companions SET is_hired = 1 WHERE id = ?")
      .run(companionId);
    this.upsertCustomization(companionId, { isHidden: false, shareToken });

    return {
      success: true,
      companionId,
      shareToken,
      shareUrl: `berry://companions/${companionId}`
    };
  }

  deleteCompanion(idOrPayload = {}) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.id;
    this.store.db.prepare("DELETE FROM companions WHERE id = ?").run(companionId);
    this.store.db
      .prepare("DELETE FROM companion_customizations WHERE companion_id = ?")
      .run(companionId);
    return {
      success: true,
      companionId,
      companions: this.listCompanions()
    };
  }

  locateSkillFile(rawSlug = "") {
    const slug = sanitizeSlug(rawSlug);
    const customDir = path.join(this.skillsDir, "custom", slug);
    const customFile = path.join(customDir, "SKILL.md");
    if (fs.existsSync(customFile)) {
      return { slug, category: "custom", folderDir: customDir, skillMdPath: customFile };
    }

    if (fs.existsSync(this.skillsDir)) {
      const catDirs = fs.readdirSync(this.skillsDir, { withFileTypes: true });
      for (const catDir of catDirs) {
        if (!catDir.isDirectory()) continue;
        const candidateDir = path.join(this.skillsDir, catDir.name, slug);
        const candidateFile = path.join(candidateDir, "SKILL.md");
        if (fs.existsSync(candidateFile)) {
          return {
            slug,
            category: catDir.name,
            folderDir: candidateDir,
            skillMdPath: candidateFile
          };
        }
      }
    }

    return null;
  }

  createSkillFolder(payload = {}) {
    const rawName = payload.slug || payload.name || payload.title || "custom-skill";
    const slug = sanitizeSlug(rawName);
    const folderDir = path.join(this.skillsDir, "custom", slug);
    const skillMdPath = path.join(folderDir, "SKILL.md");
    fs.mkdirSync(folderDir, { recursive: true });

    let frontmatter = {
      name: payload.frontmatter?.name || payload.title || payload.name || slug,
      description:
        payload.description ??
        payload.frontmatter?.description ??
        `Custom skill ${slug}`,
      "user-invocable":
        payload.frontmatter?.["user-invocable"] ?? payload.userInvocable ?? true
    };
    let instructions = String(
      payload.instructions ?? payload.content ?? `# ${frontmatter.name}\n`
    );

    if (
      payload.instructions === undefined &&
      typeof payload.content === "string" &&
      payload.content.trimStart().startsWith("---")
    ) {
      const parsed = parseSkillMarkdown(payload.content, slug);
      frontmatter = {
        ...parsed.frontmatter,
        ... payload.frontmatter,
        name: parsed.frontmatter.name || frontmatter.name,
        description: parsed.frontmatter.description || frontmatter.description,
        "user-invocable": parsed.frontmatter["user-invocable"] ?? true
      };
      instructions = parsed.instructions;
    }

    const content = serializeSkillMarkdown({ slug, frontmatter, instructions });
    fs.writeFileSync(skillMdPath, content, "utf8");

    this.skillCatalog?.loadCatalog?.();
    const stat = fs.statSync(skillMdPath);

    return {
      success: true,
      folder: {
        name: slug,
        slug,
        category: "custom",
        path: skillMdPath,
        frontmatter,
        instructions,
        content,
        updatedAt: stat.mtimeMs
      }
    };
  }

  getSkillFolder(slugOrPayload = {}) {
    const rawSlug =
      typeof slugOrPayload === "string"
        ? slugOrPayload
        : slugOrPayload.slug ||
          slugOrPayload.name ||
          slugOrPayload.folderName ||
          slugOrPayload.id ||
          "";
    const located = this.locateSkillFile(rawSlug);
    if (!located || !fs.existsSync(located.skillMdPath)) {
      return {
        success: false,
        error: `Skill folder not found: ${rawSlug}`,
        folder: null
      };
    }

    const content = fs.readFileSync(located.skillMdPath, "utf8");
    const { frontmatter, instructions } = parseSkillMarkdown(content, located.slug);
    const stat = fs.statSync(located.skillMdPath);
    const entries = fs.readdirSync(located.folderDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();

    return {
      success: true,
      folder: {
        name: located.slug,
        slug: located.slug,
        category: located.category,
        path: located.skillMdPath,
        frontmatter,
        instructions,
        content,
        files,
        updatedAt: stat.mtimeMs
      }
    };
  }

  updateSkillFolder(payload = {}) {
    const rawSlug =
      payload.slug || payload.name || payload.folderName || payload.id || "custom-skill";
    const located = this.locateSkillFile(rawSlug) || {
      slug: sanitizeSlug(rawSlug),
      category: "custom",
      folderDir: path.join(this.skillsDir, "custom", sanitizeSlug(rawSlug)),
      skillMdPath: path.join(this.skillsDir, "custom", sanitizeSlug(rawSlug), "SKILL.md")
    };

    fs.mkdirSync(located.folderDir, { recursive: true });

    let existing = {
      frontmatter: { name: located.slug, description: "", "user-invocable": true },
      instructions: ""
    };
    if (fs.existsSync(located.skillMdPath)) {
      existing = parseSkillMarkdown(
        fs.readFileSync(located.skillMdPath, "utf8"),
        located.slug
      );
    }

    let frontmatter;
    let instructions;
    let content;

    if (
      payload.instructions === undefined &&
      typeof payload.content === "string" &&
      payload.content.trimStart().startsWith("---")
    ) {
      content = payload.content.endsWith("\n") ? payload.content : `${payload.content}\n`;
      const parsed = parseSkillMarkdown(content, located.slug);
      frontmatter = parsed.frontmatter;
      instructions = parsed.instructions;
    } else {
      frontmatter = {
        ...existing.frontmatter,
        ...(payload.frontmatter || {}),
        name:
          payload.frontmatter?.name ||
          payload.title ||
          existing.frontmatter.name ||
          located.slug,
        description:
          payload.description ??
          payload.frontmatter?.description ??
          existing.frontmatter.description ??
          "",
        "user-invocable":
          payload.frontmatter?.["user-invocable"] ??
          payload.userInvocable ??
          existing.frontmatter["user-invocable"] ??
          true
      };
      instructions = String(
        payload.instructions ?? payload.content ?? existing.instructions
      );
      content = serializeSkillMarkdown({
        slug: located.slug,
        frontmatter,
        instructions
      });
    }

    fs.writeFileSync(located.skillMdPath, content, "utf8");
    this.skillCatalog?.loadCatalog?.();
    const stat = fs.statSync(located.skillMdPath);

    return {
      success: true,
      folder: {
        name: located.slug,
        slug: located.slug,
        category: located.category,
        path: located.skillMdPath,
        frontmatter,
        instructions,
        content,
        updatedAt: stat.mtimeMs
      }
    };
  }

  deleteSkillFolder(slugOrPayload = {}) {
    const rawSlug =
      typeof slugOrPayload === "string"
        ? slugOrPayload
        : slugOrPayload.slug ||
          slugOrPayload.name ||
          slugOrPayload.skillId ||
          slugOrPayload.id ||
          "";
    const slug = sanitizeSlug(rawSlug);
    const customDir = path.join(this.skillsDir, "custom", slug);
    if (fs.existsSync(customDir)) {
      fs.rmSync(customDir, { recursive: true, force: true });
    } else {
      const located = this.locateSkillFile(slug);
      if (located && fs.existsSync(located.folderDir)) {
        fs.rmSync(located.folderDir, { recursive: true, force: true });
      }
    }

    this.skillCatalog?.loadCatalog?.();

    if (this.store?.db) {
      const rows = this.store.db
        .prepare("SELECT id, skills_json FROM companions")
        .all();
      const updateStmt = this.store.db.prepare(
        "UPDATE companions SET skills_json = ? WHERE id = ?"
      );
      for (const row of rows) {
        let skills = [];
        try {
          skills = JSON.parse(row.skills_json || "[]");
        } catch {
          skills = [];
        }
        if (skills.includes(slug)) {
          const filtered = skills.filter((s) => s !== slug);
          updateStmt.run(JSON.stringify(filtered), row.id);
          const updatedComp = this.getCompanion(row.id);
          if (updatedComp) this.syncCompanionMarkdown(updatedComp);
        }
      }
    }

    return {
      success: true,
      deletedSlug: slug
    };
  }

  getPinnedFiles(idOrPayload = {}) {
    const companionId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload.companionId || idOrPayload.id || "research-rosa";
    const compRel = `companions/${companionId}/COMPANION.md`;

    let compContent = this.memory ? this.memory.readFile(compRel) : "";
    if (!compContent && this.store?.db) {
      const comp = this.getCompanion(companionId);
      if (comp && this.memory) {
        this.syncCompanionMarkdown(comp);
        compContent = this.memory.readFile(compRel);
      }
    }

    const files = [
      {
        path: compRel,
        title: "COMPANION.md",
        content: compContent
      }
    ];
    const seenPaths = new Set([compRel]);

    const cust = this.getCustomizationRow(companionId);
    if (cust?.pinned_files_json) {
      let pinned = [];
      try {
        pinned = JSON.parse(cust.pinned_files_json);
      } catch {
        pinned = [];
      }
      for (const entry of pinned) {
        const filePath = typeof entry === "string" ? entry : entry?.path;
        if (!filePath || seenPaths.has(filePath)) continue;
        seenPaths.add(filePath);
        const content =
          typeof entry === "object" && entry?.content !== undefined
            ? entry.content
            : this.memory
              ? this.memory.readFile(filePath)
              : "";
        files.push({
          path: filePath,
          title:
            (typeof entry === "object" && entry?.title) || path.basename(filePath),
          content
        });
      }
    }

    const entityLinks = compContent.match(/entities\/[a-zA-Z0-9/_-]+\.md/g) || [];
    for (const entityPath of entityLinks) {
      if (seenPaths.has(entityPath)) continue;
      const entityContent = this.memory ? this.memory.readFile(entityPath) : "";
      if (entityContent) {
        seenPaths.add(entityPath);
        files.push({
          path: entityPath,
          title: path.basename(entityPath),
          content: entityContent
        });
      }
    }

    return {
      success: true,
      companionId,
      files
    };
  }

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      case "chat:request-create-companion":
      case "companions:create":
        return this.createCompanion(payload);

      case "chat:request-update-companion":
      case "companions:saveProfile":
      case "onboarding:update-companion-customization":
      case "companions:update":
        return this.updateCompanion(payload);

      case "companions:setHidden":
        return this.setCompanionHidden(payload);

      case "companions:companion-exists":
        return this.companionExists(payload);

      case "companions:share-companion":
        return this.shareCompanion(payload);

      case "onboarding:adopt-hired-companion":
        return this.adoptHiredCompanion(payload);

      case "companions:delete":
      case "companions:delete-companion":
        return this.deleteCompanion(payload);

      case "companions:get-pinned-files":
        return this.getPinnedFiles(payload);

      case "skills:create-folder":
        return this.createSkillFolder(payload);

      case "skills:get-folder":
        return this.getSkillFolder(payload);

      case "skills:update-folder":
        return this.updateSkillFolder(payload);

      case "skills:delete-folder":
      case "companions:deleteLocalSkill":
        return this.deleteSkillFolder(payload);

      default:
        return null;
    }
  }
}

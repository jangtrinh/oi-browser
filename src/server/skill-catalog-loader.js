import fs from "node:fs";
import path from "node:path";

function escapeXml(str = "") {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class SkillCatalogLoader {
  constructor(skillsRoot = path.join(process.cwd(), "skills")) {
    this.skillsRoot = skillsRoot;
    if (!fs.existsSync(this.skillsRoot)) {
      const fallback = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../skills");
      if (fs.existsSync(fallback)) this.skillsRoot = fallback;
    }
    this.catalog = [];
    this.loadCatalog();
  }

  loadCatalog() {
    this.catalog = [];
    if (!fs.existsSync(this.skillsRoot)) return;
    const catDirs = fs.readdirSync(this.skillsRoot, { withFileTypes: true });
    for (const catDir of catDirs) {
      if (!catDir.isDirectory()) continue;
      const category = catDir.name;
      const catPath = path.join(this.skillsRoot, category);
      const skillDirs = fs.readdirSync(catPath, { withFileTypes: true });
      for (const sDir of skillDirs) {
        if (!sDir.isDirectory()) continue;
        const slug = sDir.name;
        const skillFile = path.join(catPath, slug, "SKILL.md");
        if (!fs.existsSync(skillFile)) continue;
        const raw = fs.readFileSync(skillFile, "utf-8");
        const fullText = raw.replace(/\p{Extended_Pictographic}/gu, "").trim();

        let description = "";
        const descMatch = fullText.match(/^description:\s*(.+)$/m);
        if (descMatch) {
          const rawDesc = descMatch[1].replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
          description = rawDesc.split(/(?<=[.?!])\s+/)[0] || rawDesc;
        } else {
          const body = fullText.replace(/^---[\s\S]*?---/, "").trim().split(/\n\n+/)[0] || "";
          description = body.replace(/^#+\s*/, "").replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
        }
        if (description.length > 120) {
          description = description.slice(0, 117).trim() + "...";
        }

        const headings = (fullText.match(/^#{1,6}\s+(.+)$/gm) || []).map((h) => h.replace(/^#{1,6}\s+/, ""));
        const rawWords = (slug.replace(/[-_]/g, " ") + " " + headings.join(" "))
          .toLowerCase()
          .match(/[\p{L}\p{N}]{3,}/gu) || [];
        const keywords = [...new Set(rawWords)];

        this.catalog.push({
          slug,
          category,
          relPath: `${category}/${slug}/SKILL.md`,
          description,
          keywords,
          fullText
        });
      }
    }
  }

  buildProgressiveContext({ companionSkills = [], prompt = "" } = {}) {
    let selected = companionSkills.length > 0
      ? this.catalog.filter((s) => companionSkills.includes(s.slug))
      : [];
    if (selected.length === 0) {
      selected = this.catalog.slice(0, 6);
    }

    const xmlLines = selected.map(
      (s) => `  <skill name="${escapeXml(s.slug)}" category="${escapeXml(s.category)}" path="${escapeXml(s.relPath)}" summary="${escapeXml(s.description)}" />`
    );
    let xmlCatalog = `<available_skills>\n${xmlLines.join("\n")}\n</available_skills>`;

    const promptTokens = new Set(
      String(prompt || "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []
    );

    const matches = [];
    if (promptTokens.size > 0) {
      for (const skill of this.catalog) {
        let score = 0;
        for (const token of promptTokens) {
          if (skill.slug.includes(token)) score += 3;
          if (skill.keywords.includes(token)) score += 2;
        }
        if (score > 0) {
          matches.push({ skill, score });
        }
      }
      matches.sort((a, b) => b.score - a.score);
    }

    const activated = matches.slice(0, 2).map((m) => m.skill);
    const activatedSkills = activated.map((s) => s.slug);

    if (activated.length > 0) {
      const guides = activated.map((s) => {
        const snippet = s.fullText
          .replace(/\p{Extended_Pictographic}/gu, "")
          .trim()
          .slice(0, 380)
          .trim();
        return `<activated_skill_guide name="${escapeXml(s.slug)}">\n${snippet}\n</activated_skill_guide>`;
      });
      xmlCatalog += "\n" + guides.join("\n");
    }

    const progBytes = Buffer.byteLength(xmlCatalog, "utf-8");
    const baseline31Bytes = Math.max(progBytes, 31 * 560);
    const tokenSavingsPct = Number(
      Math.max(0, Math.min(99, (1 - progBytes / baseline31Bytes) * 100)).toFixed(1)
    );

    return {
      xmlCatalog,
      activatedSkills,
      totalIndexedSkills: this.catalog.length,
      tokenSavingsPct
    };
  }

  getStatus() {
    return {
      totalIndexedSkills: this.catalog.length,
      categories: ["general", "GTM", "sales", "recruiting"],
      mode: "progressive-xml-catalog"
    };
  }
}

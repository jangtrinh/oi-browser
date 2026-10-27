import fs from "node:fs";
import path from "node:path";
import { OFFICIAL_COMPANIONS } from "./official-companions-catalog.js";

export class KarpathyWikiMemoryEngine {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.observationsDir = path.join(rootDir, "observations");
    this.entitiesDir = path.join(rootDir, "entities");
    this.companionsDir = path.join(rootDir, "companions");
    this.ensureStructure();
  }

  ensureStructure() {
    for (const dir of [this.rootDir, this.observationsDir, this.entitiesDir, this.companionsDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    for (const kind of ["companies", "people", "projects", "deals"]) {
      fs.mkdirSync(path.join(this.entitiesDir, kind), { recursive: true });
    }
    const profilePath = path.join(this.rootDir, "PROFILE.md");
    if (!fs.existsSync(profilePath)) {
      fs.writeFileSync(
        profilePath,
        [
          "# Global Profile Memory (`<global_memory>`)",
          "",
          "## Identity & Workspace",
          "- **Owner**: Jang Trinh",
          "- **Runtime**: Ổi Browser 1.0 (Local Self-Hosted Agentic Browser)",
          "- **Memory Architecture**: Karpathy-Wiki File System (`PROFILE.md`, `COMPANION.md`, `observations/`, `entities/`)",
          "",
          "## Standing Preferences",
          "- Evidence-first responses: cite inspected DOM nodes (`data-oi-id`) and exact URLs.",
          "- Zero cloud credit lock-in; store all browsing history, artifacts, and transcripts locally.",
          "- Compile raw observations into durable entity pages (`entities/<type>/<slug>.md`)."
        ].join("\n"),
        "utf8"
      );
    }
    const entityIndex = path.join(this.entitiesDir, "index.md");
    if (!fs.existsSync(entityIndex)) {
      fs.writeFileSync(
        entityIndex,
        [
          "# Entity Knowledge Graph Index",
          "",
          "- [companies/oi-browser.md](entities/companies/oi-browser.md) — Ổi Browser (Local-First Agentic AI Browser)"
        ].join("\n"),
        "utf8"
      );
    }
    const defaultEntity = path.join(this.entitiesDir, "companies", "oi-browser.md");
    if (!fs.existsSync(defaultEntity)) {
      fs.writeFileSync(
        defaultEntity,
        [
          "# Ổi Browser",
          "",
          "- **Version**: `1.0.0`",
          "- **Architecture**: SvelteKit 5 + Node.js 22+ (`node:sqlite`, `node:http`) + macOS `WKWebView`",
          "- **Core Subsystems**: 9 Vietnamese Fruit Companions, `AgentDOMBrowserService` (`data-oi-id`), Karpathy-Wiki Memory, Scheduled Routines, Visual Artifacts, Meeting Transcriptions."
        ].join("\n"),
        "utf8"
      );
    }
    for (const c of OFFICIAL_COMPANIONS) {
      const cDir = path.join(this.companionsDir, c.id);
      fs.mkdirSync(cDir, { recursive: true });
      const cFile = path.join(cDir, "COMPANION.md");
      if (!fs.existsSync(cFile)) {
        fs.writeFileSync(
          cFile,
          [
            `# ${c.name} — Companion Memory (\`<companion_memory>\`)`,
            "",
            `- **Role**: ${c.role}`,
            `- **Summary**: ${c.summary}`,
            `- **Active Skills**: ${c.skills.map((s) => `\`${s}\``).join(", ")}`,
            "",
            "## Learned Patterns & Notes",
            "- Prefer structured Visual Artifacts (Documents & Spreadsheets) when synthesizing multi-row data."
          ].join("\n"),
          "utf8"
        );
      }
    }
  }

  todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  listFiles(dir = this.rootDir, prefix = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...this.listFiles(full, rel));
      } else if (entry.name.endsWith(".md")) {
        const stat = fs.statSync(full);
        out.push({ path: rel, bytes: stat.size, updatedAt: stat.mtimeMs });
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  safeResolve(relPath) {
    const clean = String(relPath || "PROFILE.md").replace(/^\/+/, "");
    const resolved = path.resolve(this.rootDir, clean);
    if (!resolved.startsWith(path.resolve(this.rootDir))) {
      throw new Error("Invalid memory path");
    }
    return resolved;
  }

  readFile(relPath = "PROFILE.md") {
    const full = this.safeResolve(relPath);
    if (!fs.existsSync(full)) return "";
    return fs.readFileSync(full, "utf8");
  }

  writeFile(relPath, content) {
    const full = this.safeResolve(relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(content), "utf8");
    return { path: relPath, bytes: Buffer.byteLength(String(content), "utf8"), updatedAt: Date.now() };
  }

  appendObservation({ companionId, summary, sourceUrl }) {
    const rel = `observations/${this.todayStamp()}.md`;
    const full = this.safeResolve(rel);
    const time = new Date().toISOString().slice(11, 19);
    const header = fs.existsSync(full) ? "" : `# Daily Observations — ${this.todayStamp()}\n\n`;
    const line = `- **[${time}] (${companionId || "system"})**: ${summary}${sourceUrl ? ` _(Source: ${sourceUrl})_` : ""}\n`;
    fs.appendFileSync(full, header + line, "utf8");
    return rel;
  }

  upsertEntity({ type = "companies", slug, title, markdownBody }) {
    const safeSlug = String(slug || title || "entity")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const rel = `entities/${type}/${safeSlug}.md`;
    this.writeFile(rel, `# ${title}\n\n${markdownBody.trim()}\n`);
    const indexRel = "entities/index.md";
    const currentIndex = this.readFile(indexRel);
    const linkLine = `- [${type}/${safeSlug}.md](${rel}) — ${title}`;
    if (!currentIndex.includes(`(${rel})`)) {
      this.writeFile(indexRel, `${currentIndex.trim()}\n${linkLine}\n`);
    }
    return rel;
  }

  runDreamConsolidation(companionId = "executive-ellis") {
    const obsRel = `observations/${this.todayStamp()}.md`;
    const obsText = this.readFile(obsRel);
    const bullets = obsText
      .split("\n")
      .filter((l) => l.startsWith("- **"))
      .slice(-8);
    const compRel = `companions/${companionId}/COMPANION.md`;
    const current = this.readFile(compRel);
    const stamp = new Date().toISOString();
    const dreamBlock = [
      "",
      `### Dream Consolidation (${stamp})`,
      bullets.length > 0 ? bullets.join("\n") : "- Consolidated workspace state and verified pinned memory integrity."
    ].join("\n");
    this.writeFile(compRel, `${current.trim()}\n${dreamBlock}\n`);
    return { companionId, consolidatedObservations: bullets.length, updatedFile: compRel, timestamp: stamp };
  }
}

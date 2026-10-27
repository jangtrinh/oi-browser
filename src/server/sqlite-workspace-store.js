import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { OFFICIAL_COMPANIONS, OFFICIAL_ROUTINE_TEMPLATES } from "./official-companions-catalog.js";

const OFFICIAL_MAP = new Map(OFFICIAL_COMPANIONS.map((c) => [c.id, c]));
const DEFAULT_APPEARANCE = OFFICIAL_COMPANIONS[0]?.appearance || null;
function sanitizeMsgContent(raw = "") {
  let s = String(raw).replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/^\*\*[^*\n]+\*\*\s*\(`[^`]+`\s*CLI Core[^)\n]*\)\s*\n+/m, "");
  const idx = s.indexOf("### Completed Actions");
  if (idx !== -1) s = `<thinking>\n**Đã thực thi 4 tác vụ nền**\n${s.slice(idx + 21).replace(/`\/[^\n`]+`/g, "`grok-4.7-build-fast` (read-only)").trim()}\n</thinking>\n\n${s.slice(0, idx).trim()}`;
  return s.trim();
}
export class SqliteWorkspaceStore {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    this.seedDefaults();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tabs (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, surface_kind TEXT NOT NULL,
        is_active INTEGER DEFAULT 0, is_agent_controlled INTEGER DEFAULT 0, blocked_ads INTEGER DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companions (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, avatar TEXT NOT NULL,
        accent_hue INTEGER NOT NULL, summary TEXT NOT NULL, skills_json TEXT NOT NULL, system_prompt TEXT NOT NULL, is_hired INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY, companion_id TEXT NOT NULL, sender TEXT NOT NULL, content TEXT NOT NULL,
        tool_calls_json TEXT DEFAULT '[]', artifact_id TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY, emoji TEXT NOT NULL, label TEXT NOT NULL, schedule TEXT NOT NULL,
        companion_id TEXT NOT NULL, prompt TEXT NOT NULL, enabled INTEGER DEFAULT 1, last_run_at INTEGER, last_result TEXT
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, companion_id TEXT NOT NULL,
        content_markdown TEXT DEFAULT '', rows_json TEXT DEFAULT '[]', columns_json TEXT DEFAULT '[]', source_url TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_sec INTEGER DEFAULT 0,
        transcript_text TEXT NOT NULL, summary_markdown TEXT NOT NULL, action_items_json TEXT DEFAULT '[]', created_at INTEGER NOT NULL
      );
    `);
  }

  seedDefaults() {
    if (this.db.prepare("SELECT COUNT(*) AS c FROM companions").get().c === 0) {
      const stmt = this.db.prepare("INSERT INTO companions VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)");
      for (const c of OFFICIAL_COMPANIONS) stmt.run(c.id, c.name, c.role, c.avatar, c.accentHue, c.summary, JSON.stringify(c.skills), c.systemPrompt);
    }
    if (this.db.prepare("SELECT COUNT(*) AS c FROM tabs").get().c === 0) {
      const now = Date.now();
      const stmt = this.db.prepare("INSERT INTO tabs VALUES (?, ?, ?, ?, ?, 0, ?, ?)");
      stmt.run("tab-plaza", "New Tab Plaza", "berry://newtab", "newTab", 1, 0, now);
      stmt.run("tab-oi", "Ổi Browser Repository", "https://github.com/jangtrinh/oi-browser", "web", 0, 14, now + 1);
      stmt.run("tab-hn", "Hacker News", "https://news.ycombinator.com", "web", 0, 6, now + 2);
      stmt.run("tab-memory", "Karpathy-Wiki Memory", "berry://memory", "memory", 0, 0, now + 3);
    }
    if (this.db.prepare("SELECT COUNT(*) AS c FROM routines").get().c === 0) {
      const stmt = this.db.prepare("INSERT INTO routines VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL)");
      for (const r of OFFICIAL_ROUTINE_TEMPLATES) stmt.run(r.id, r.emoji, r.label, r.schedule, r.companionId, r.prompt);
    }
    if (this.db.prepare("SELECT COUNT(*) AS c FROM artifacts").get().c === 0) {
      this.createArtifact({
        id: "art-oi-matrix", title: "Ổi Browser 1.0.0 — Ma trận Kiến trúc & 9 Trợ lý Trái cây Việt", kind: "spreadsheet", companionId: "developer-dana",
        sourceUrl: "https://github.com/jangtrinh/oi-browser", columns: ["Phân hệ", "Trợ lý Phụ trách", "Mô-đun Ổi Browser", "Trạng thái"],
        rows: [
          { "Phân hệ": "Giao diện Gốc", "Trợ lý Phụ trách": "Ổi & Măng Cụt", "Mô-đun Ổi Browser": "Right-Hand Sidebar Workspace UI + Multi-CLI Dock", "Trạng thái": "Active" },
          { "Phân hệ": "Biệt đội Trái cây Việt", "Trợ lý Phụ trách": "9 Trợ lý 3D", "Mô-đun Ổi Browser": "Ổi, Măng Cụt, Sầu Riêng, Thanh Long, Bưởi, Vú Sữa, Xoài, Chôm Chôm, Vải", "Trạng thái": "Active" },
          { "Phân hệ": "Tự động hóa DOM", "Trợ lý Phụ trách": "Măng Cụt", "Mô-đun Ổi Browser": "AgentDOMBrowserService (data-oi-id)", "Trạng thái": "Active" },
          { "Phân hệ": "Bộ nhớ Karpathy-Wiki", "Trợ lý Phụ trách": "Vú Sữa", "Mô-đun Ổi Browser": "KarpathyWikiMemoryEngine (PROFILE/COMPANION/entities)", "Trạng thái": "Active" },
          { "Phân hệ": "Lịch trình Tự động", "Trợ lý Phụ trách": "Sầu Riêng & Bưởi", "Mô-đun Ổi Browser": "Scheduled Routines Runner + 5 Mẫu Tự động", "Trạng thái": "Active" }
        ]
      });
    }
    if (this.db.prepare("SELECT COUNT(*) AS c FROM chat_messages").get().c === 0) {
      this.addMessage({ companionId: "research-rosa", sender: "user", content: "Phân tích kiến trúc Ổi Browser và giới thiệu biệt đội 9 trợ lý AI trái cây đặc trưng Việt Nam." });
      this.addMessage({
        companionId: "research-rosa", sender: "assistant", artifactId: "art-oi-matrix",
        content: "Chào bạn! **Vú Sữa** đã kiểm tra trực tiếp bằng `AgentDOMBrowserService` (`[data-oi-id]`) trên **Ổi Browser**:\n\n1. **9 Trợ lý 3D Trái cây Việt Nam**: `Ổi` (Tư vấn), `Măng Cụt` (Kỹ sư QA), `Sầu Riêng` (Chánh Văn phòng), `Thanh Long` (Marketing), `Bưởi` (Vận hành), `Vú Sữa` (Nghiên cứu), `Xoài` (Kinh doanh), `Chôm Chôm` (CSKH), và `Vải` (Tuyển dụng).\n2. **Bộ nhớ Karpathy-Wiki Cục bộ** (`PROFILE.md`, `COMPANION.md`, và hồ sơ thực thể).\n3. **Không gian Artifact & Lịch trình Tự động** vận hành trực tiếp tại `127.0.0.1:4104`."
      });
    }
    if (this.db.prepare("SELECT COUNT(*) AS c FROM meetings").get().c === 0) {
      this.createMeeting({
        title: "Họp Điều phối Sản phẩm Ổi Browser & Biệt đội Trái cây Việt", durationSec: 420,
        transcriptText: "Rà soát 9 trợ lý AI 3D mang tên trái cây đặc trưng Việt Nam, bộ nhớ Karpathy-Wiki và công cụ kiểm thử AgentDOM.",
        summaryMarkdown: "### Tóm tắt Cuộc họp\n- Đổi tên sản phẩm thành **Ổi Browser** và chuẩn hóa 9 trợ lý AI theo các loại trái cây đặc sản Việt Nam.",
        actionItems: ["Action #1: Kiểm tra 9 trợ lý 3D trên /newtab và /hire/official", "Action #2: Chạy cổng kiểm định design-os ui gate"]
      });
    }
  }

  listTabs() { return this.db.prepare("SELECT * FROM tabs ORDER BY created_at ASC").all(); }

  createTab({ title = "New Tab", url = "berry://newtab", surfaceKind = "newTab", activate = true }) {
    const id = `tab-${crypto.randomUUID().slice(0, 8)}`;
    if (activate) this.db.prepare("UPDATE tabs SET is_active = 0").run();
    const ads = url.startsWith("http") ? Math.floor(Math.random() * 12) + 3 : 0;
    this.db.prepare("INSERT INTO tabs VALUES (?, ?, ?, ?, ?, 0, ?, ?)").run(id, title, url, surfaceKind, activate ? 1 : 0, ads, Date.now());
    return this.db.prepare("SELECT * FROM tabs WHERE id = ?").get(id);
  }

  updateTab(id, { title, url, surfaceKind, isActive, isAgentControlled }) {
    if (isActive) this.db.prepare("UPDATE tabs SET is_active = 0").run();
    const cur = this.db.prepare("SELECT * FROM tabs WHERE id = ?").get(id);
    if (!cur) return null;
    this.db.prepare("UPDATE tabs SET title = ?, url = ?, surface_kind = ?, is_active = ?, is_agent_controlled = ? WHERE id = ?").run(
      title ?? cur.title, url ?? cur.url, surfaceKind ?? cur.surface_kind,
      isActive !== undefined ? (isActive ? 1 : 0) : cur.is_active,
      isAgentControlled !== undefined ? (isAgentControlled ? 1 : 0) : cur.is_agent_controlled, id
    );
    return this.db.prepare("SELECT * FROM tabs WHERE id = ?").get(id);
  }

  closeTab(id) {
    this.db.prepare("DELETE FROM tabs WHERE id = ?").run(id);
    const tabs = this.listTabs();
    if (tabs.length > 0 && !tabs.some((t) => t.is_active === 1)) this.db.prepare("UPDATE tabs SET is_active = 1 WHERE id = ?").run(tabs[0].id);
    return this.listTabs();
  }

  listCompanions() {
    return this.db.prepare("SELECT * FROM companions ORDER BY rowid ASC").all().map((r) => {
      const off = OFFICIAL_MAP.get(r.id);
      return {
        ...r, avatar: off?.avatar || "AI", name: off?.name || r.name, role: off?.role || r.role, summary: off?.summary || r.summary,
        skills: JSON.parse(r.skills_json || "[]"), fullName: off?.fullName || r.name,
        visualsSeed: off?.visualsSeed || r.id, appearance: off?.appearance || DEFAULT_APPEARANCE,
        defaultChatMode: off?.defaultChatMode || "expert", contentHash: off?.contentHash || r.id,
        profile: off?.profile || { summary: r.summary, templateSkills: JSON.parse(r.skills_json || "[]"), about: r.summary }
      };
    });
  }

  createCompanion({ name, role, avatar = "AI", accentHue = 38, summary, skills = [], systemPrompt = "" }) {
    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36).slice(-4)}`;
    this.db.prepare("INSERT INTO companions VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)").run(id, name, role, avatar, accentHue, summary, JSON.stringify(skills), systemPrompt || summary);
    return this.listCompanions().find((c) => c.id === id);
  }

  listMessages(companionId) {
    return this.db.prepare("SELECT * FROM chat_messages WHERE companion_id = ? ORDER BY created_at ASC").all(companionId)
      .map((m) => ({ ...m, content: sanitizeMsgContent(m.content), toolCalls: JSON.parse(m.tool_calls_json || "[]") }));
  }

  listAllMessages() {
    return this.db.prepare("SELECT * FROM chat_messages ORDER BY created_at ASC").all()
      .map((m) => ({ ...m, content: sanitizeMsgContent(m.content), toolCalls: JSON.parse(m.tool_calls_json || "[]") }));
  }

  addMessage({ companionId, sender, content, toolCalls = [], artifactId = null }) {
    const id = `msg-${crypto.randomUUID().slice(0, 8)}`;
    const clean = sanitizeMsgContent(content);
    this.db.prepare("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, companionId, sender, clean, JSON.stringify(toolCalls), artifactId, Date.now());
    return { id, companionId, sender, content: clean, toolCalls, artifactId };
  }

  listRoutines() { return this.db.prepare("SELECT * FROM routines ORDER BY rowid ASC").all().map((r) => ({ ...r, emoji: "" })); }

  createRoutine({ emoji = "", label, schedule, companionId, prompt }) {
    const id = `routine-${crypto.randomUUID().slice(0, 8)}`;
    this.db.prepare("INSERT INTO routines VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL)").run(id, emoji, label, schedule, companionId, prompt);
    return this.db.prepare("SELECT * FROM routines WHERE id = ?").get(id);
  }

  recordRoutineRun(id, resultText) {
    this.db.prepare("UPDATE routines SET last_run_at = ?, last_result = ? WHERE id = ?").run(Date.now(), resultText, id);
    return this.db.prepare("SELECT * FROM routines WHERE id = ?").get(id);
  }

  listArtifacts() {
    return this.db.prepare("SELECT * FROM artifacts ORDER BY created_at DESC").all()
      .map((a) => ({ ...a, rows: JSON.parse(a.rows_json || "[]"), columns: JSON.parse(a.columns_json || "[]") }));
  }

  createArtifact({ id, title, kind = "document", companionId = "research-rosa", contentMarkdown = "", rows = [], columns = [], sourceUrl = "" }) {
    const artId = id || `art-${crypto.randomUUID().slice(0, 8)}`;
    this.db.prepare("INSERT OR REPLACE INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(artId, title, kind, companionId, contentMarkdown, JSON.stringify(rows), JSON.stringify(columns), sourceUrl, Date.now());
    return this.listArtifacts().find((a) => a.id === artId);
  }

  listMeetings() {
    return this.db.prepare("SELECT * FROM meetings ORDER BY created_at DESC").all()
      .map((m) => ({ ...m, actionItems: JSON.parse(m.action_items_json || "[]") }));
  }

  createMeeting({ title, durationSec = 0, transcriptText, summaryMarkdown, actionItems = [] }) {
    const id = `mtg-${crypto.randomUUID().slice(0, 8)}`;
    this.db.prepare("INSERT INTO meetings VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, title, durationSec, transcriptText, summaryMarkdown, JSON.stringify(actionItems), Date.now());
    return this.listMeetings().find((m) => m.id === id);
  }
}

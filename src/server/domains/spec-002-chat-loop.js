import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SkillCatalogLoader } from "../skill-catalog-loader.js";

export class Spec002ChatLoopService {
  constructor({ store, memory, wikiFts, domService, cliRouter, orchestrator, dataDir } = {}) {
    if (!store || !store.db) {
      throw new Error("Spec002ChatLoopService requires a valid SqliteWorkspaceStore instance (`store`)");
    }
    this.store = store;
    this.memory = memory || null;
    this.wikiFts = wikiFts || null;
    this.domService = domService || null;
    this.cliRouter = cliRouter || null;
    this.orchestrator = orchestrator || null;
    this.dataDir =
      dataDir ||
      (store.dbPath ? path.dirname(store.dbPath) : path.join(process.cwd(), ".berry-data"));
    this.fallbackSkillCatalog = null;

    this.activeTurns = new Map();
    this.sessionStatuses = new Map();
    this.steeringNotes = new Map();
    this.pageFindState = new Map();

    this.initSchema();
  }

  initSchema() {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_permission_rules (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        decision TEXT NOT NULL,
        scope TEXT DEFAULT 'global',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_staged_attachments (
        staging_id TEXT PRIMARY KEY,
        session_id TEXT,
        filename TEXT NOT NULL,
        mime_type TEXT,
        file_path TEXT NOT NULL,
        size_bytes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'staging',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_pending_tools (
        tool_call_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'pending',
        decision TEXT,
        result_json TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  getSkillCatalog() {
    if (this.cliRouter?.skillCatalog) return this.cliRouter.skillCatalog;
    if (!this.fallbackSkillCatalog) {
      this.fallbackSkillCatalog = new SkillCatalogLoader();
    }
    return this.fallbackSkillCatalog;
  }

  startTurn(sessionId = "default-session", abortController = new AbortController()) {
    this.activeTurns.set(sessionId, abortController);
    this.sessionStatuses.set(sessionId, "streaming");
    return {
      sessionId,
      chatStatus: "streaming",
      signal: abortController.signal
    };
  }

  getSessionStatus(sessionId = "default-session") {
    return this.sessionStatuses.get(sessionId) || "idle";
  }

  stopGenerating(payload = {}) {
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    const controller = this.activeTurns.get(sessionId);
    if (controller && typeof controller.abort === "function") {
      try {
        controller.abort("stopped_by_user");
      } catch {}
    }
    this.activeTurns.delete(sessionId);
    this.sessionStatuses.set(sessionId, "idle");
    const stoppedAt = Date.now();
    return {
      success: true,
      sessionId,
      chatStatus: "idle",
      stoppedAt
    };
  }

  async editMessage(payload = {}) {
    const companionId = payload.companionId || payload.sessionId || "research-rosa";
    const updatedContent = String(payload.content ?? payload.text ?? payload.newContent ?? "").trim();
    let targetRow = null;

    if (payload.messageId || payload.id) {
      const targetId = payload.messageId || payload.id;
      targetRow = this.store.db
        .prepare("SELECT rowid, * FROM chat_messages WHERE id = ?")
        .get(targetId);
    }
    if (!targetRow) {
      targetRow = this.store.db
        .prepare(
          "SELECT rowid, * FROM chat_messages WHERE companion_id = ? AND sender = 'user' ORDER BY created_at DESC, rowid DESC LIMIT 1"
        )
        .get(companionId);
    }

    let messageId = payload.messageId || payload.id;
    const effectiveCompanionId = targetRow ? targetRow.companion_id : companionId;

    if (targetRow) {
      messageId = targetRow.id;
      this.store.db
        .prepare("UPDATE chat_messages SET content = ? WHERE id = ?")
        .run(updatedContent, messageId);
      if (payload.truncateSubsequent !== false) {
        this.store.db
          .prepare("DELETE FROM chat_messages WHERE companion_id = ? AND rowid > ?")
          .run(effectiveCompanionId, targetRow.rowid);
      }
    } else {
      const created = this.store.addMessage({
        companionId: effectiveCompanionId,
        sender: "user",
        content: updatedContent
      });
      messageId = created.id;
    }

    let assistantMessage = null;
    if (this.orchestrator && typeof this.orchestrator.handleUserTurn === "function") {
      const beforeIds = new Set(
        this.store.db
          .prepare("SELECT id FROM chat_messages WHERE companion_id = ?")
          .all(effectiveCompanionId)
          .map((r) => r.id)
      );
      const turn = await this.orchestrator.handleUserTurn({
        companionId: effectiveCompanionId,
        message: updatedContent,
        activeUrl: payload.activeUrl || "berry://newtab",
        harnessId: payload.harnessId || "local"
      });
      // Remove duplicate user message added by orchestrator.handleUserTurn so edited messageId remains canonical
      const afterUsers = this.store.db
        .prepare(
          "SELECT id FROM chat_messages WHERE companion_id = ? AND sender = 'user' ORDER BY created_at DESC, rowid DESC"
        )
        .all(effectiveCompanionId);
      for (const u of afterUsers) {
        if (!beforeIds.has(u.id) && u.id !== messageId) {
          this.store.db.prepare("DELETE FROM chat_messages WHERE id = ?").run(u.id);
          break;
        }
      }
      assistantMessage = turn?.assistantMessage || null;
    } else {
      assistantMessage = this.store.addMessage({
        companionId: effectiveCompanionId,
        sender: "assistant",
        content: `Đã cập nhật phản hồi cho nội dung chỉnh sửa: "${updatedContent}"`
      });
    }

    const messages = this.store.listMessages(effectiveCompanionId);
    return {
      success: true,
      messageId,
      updatedContent,
      assistantMessage,
      messages
    };
  }

  async retryCompletion(payload = {}) {
    const companionId = payload.companionId || payload.sessionId || "research-rosa";
    let targetRow = null;

    if (payload.messageId || payload.id) {
      const targetId = payload.messageId || payload.id;
      targetRow = this.store.db
        .prepare("SELECT rowid, * FROM chat_messages WHERE id = ?")
        .get(targetId);
    }

    let effectiveCompanionId = targetRow ? targetRow.companion_id : companionId;
    let userRow = null;

    if (targetRow && targetRow.sender === "assistant") {
      userRow = this.store.db
        .prepare(
          "SELECT rowid, * FROM chat_messages WHERE companion_id = ? AND sender = 'user' AND rowid < ? ORDER BY rowid DESC LIMIT 1"
        )
        .get(effectiveCompanionId, targetRow.rowid);
      this.store.db
        .prepare("DELETE FROM chat_messages WHERE companion_id = ? AND rowid >= ?")
        .run(effectiveCompanionId, targetRow.rowid);
    } else if (targetRow && targetRow.sender === "user") {
      userRow = targetRow;
      this.store.db
        .prepare("DELETE FROM chat_messages WHERE companion_id = ? AND rowid > ?")
        .run(effectiveCompanionId, targetRow.rowid);
    } else {
      userRow = this.store.db
        .prepare(
          "SELECT rowid, * FROM chat_messages WHERE companion_id = ? AND sender = 'user' ORDER BY rowid DESC LIMIT 1"
        )
        .get(effectiveCompanionId);
      if (userRow) {
        this.store.db
          .prepare("DELETE FROM chat_messages WHERE companion_id = ? AND rowid > ?")
          .run(effectiveCompanionId, userRow.rowid);
      }
    }

    const updatedContent = String(
      payload.content ?? payload.text ?? userRow?.content ?? "Retry last turn"
    ).trim();
    let messageId = userRow?.id || payload.messageId || payload.id;

    if (userRow && payload.content !== undefined) {
      this.store.db
        .prepare("UPDATE chat_messages SET content = ? WHERE id = ?")
        .run(updatedContent, userRow.id);
    } else if (!userRow) {
      const created = this.store.addMessage({
        companionId: effectiveCompanionId,
        sender: "user",
        content: updatedContent
      });
      messageId = created.id;
    }

    let assistantMessage = null;
    if (this.orchestrator && typeof this.orchestrator.handleUserTurn === "function") {
      const beforeIds = new Set(
        this.store.db
          .prepare("SELECT id FROM chat_messages WHERE companion_id = ?")
          .all(effectiveCompanionId)
          .map((r) => r.id)
      );
      const turn = await this.orchestrator.handleUserTurn({
        companionId: effectiveCompanionId,
        message: updatedContent,
        activeUrl: payload.activeUrl || "berry://newtab",
        harnessId: payload.harnessId || "local"
      });
      const afterUsers = this.store.db
        .prepare(
          "SELECT id FROM chat_messages WHERE companion_id = ? AND sender = 'user' ORDER BY created_at DESC, rowid DESC"
        )
        .all(effectiveCompanionId);
      for (const u of afterUsers) {
        if (!beforeIds.has(u.id) && u.id !== messageId) {
          this.store.db.prepare("DELETE FROM chat_messages WHERE id = ?").run(u.id);
          break;
        }
      }
      assistantMessage = turn?.assistantMessage || null;
    } else {
      assistantMessage = this.store.addMessage({
        companionId: effectiveCompanionId,
        sender: "assistant",
        content: `Đã thực thi lại yêu cầu: "${updatedContent}"`
      });
    }

    const messages = this.store.listMessages(effectiveCompanionId);
    return {
      success: true,
      messageId,
      updatedContent,
      assistantMessage,
      messages
    };
  }

  steerActiveTurn(payload = {}) {
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    const note = String(payload.guidance ?? payload.content ?? payload.message ?? "").trim();
    const list = this.steeringNotes.get(sessionId) || [];
    if (note) {
      list.push({ note, createdAt: Date.now() });
      this.steeringNotes.set(sessionId, list);
    }
    this.sessionStatuses.set(sessionId, "streaming");
    return {
      success: true,
      steered: true,
      sessionId,
      steeringNotes: list
    };
  }

  continueExecution(payload = {}) {
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    this.sessionStatuses.set(sessionId, "streaming");
    return {
      success: true,
      steered: true,
      sessionId
    };
  }

  enqueuePendingTool({
    toolCallId = `tool-${crypto.randomUUID().slice(0, 8)}`,
    sessionId = "default-session",
    toolName = "code_execution",
    input = {}
  } = {}) {
    const now = Date.now();
    this.store.db
      .prepare(
        "INSERT OR REPLACE INTO chat_pending_tools (tool_call_id, session_id, tool_name, input_json, status, decision, result_json, updated_at) VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?)"
      )
      .run(toolCallId, sessionId, toolName, JSON.stringify(input || {}), now);
    return this.getPendingTool(toolCallId);
  }

  getPendingTool(toolCallId) {
    const row = this.store.db
      .prepare("SELECT * FROM chat_pending_tools WHERE tool_call_id = ?")
      .get(toolCallId);
    if (!row) return null;
    return {
      ...row,
      toolCallId: row.tool_call_id,
      sessionId: row.session_id,
      toolName: row.tool_name,
      input: JSON.parse(row.input_json || "{}"),
      result: row.result_json ? JSON.parse(row.result_json) : null
    };
  }

  listPermissionRules() {
    const rows = this.store.db
      .prepare("SELECT * FROM tool_permission_rules ORDER BY created_at ASC, rowid ASC")
      .all();
    return rows.map((r) => ({
      id: r.id,
      toolName: r.tool_name,
      tool_name: r.tool_name,
      decision: r.decision,
      scope: r.scope,
      createdAt: r.created_at,
      created_at: r.created_at
    }));
  }

  answerToolPermission(payload = {}) {
    const toolCallId =
      payload.toolCallId || payload.id || `tool-${crypto.randomUUID().slice(0, 8)}`;
    const existing = this.store.db
      .prepare("SELECT * FROM chat_pending_tools WHERE tool_call_id = ?")
      .get(toolCallId);

    const sessionId =
      payload.sessionId || payload.companionId || existing?.session_id || "default-session";
    const toolName =
      payload.toolName || payload.tool || existing?.tool_name || "code_execution";
    const decision =
      payload.decision || (payload.approved === false ? "deny" : "allow-once");
    const scope = payload.scope || "global";
    const status = decision === "deny" ? "denied" : "resolved";
    const resultObj =
      payload.result ?? payload.output ?? payload.answer ?? { approved: decision !== "deny" };
    const now = Date.now();

    if (existing) {
      this.store.db
        .prepare(
          "UPDATE chat_pending_tools SET status = ?, decision = ?, result_json = ?, updated_at = ? WHERE tool_call_id = ?"
        )
        .run(status, decision, JSON.stringify(resultObj), now, toolCallId);
    } else {
      this.store.db
        .prepare(
          "INSERT INTO chat_pending_tools (tool_call_id, session_id, tool_name, input_json, status, decision, result_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          toolCallId,
          sessionId,
          toolName,
          JSON.stringify(payload.input || {}),
          status,
          decision,
          JSON.stringify(resultObj),
          now
        );
    }

    if (decision === "allow-always") {
      const ruleId = payload.ruleId || `rule-${toolName}-${scope}`;
      this.store.db
        .prepare(
          "INSERT OR REPLACE INTO tool_permission_rules (id, tool_name, decision, scope, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(ruleId, toolName, decision, scope, now);
      const rules = this.listPermissionRules();
      this.store.setSetting("toolPermissionRules", rules);
    }

    return {
      success: true,
      toolCallId,
      toolName,
      decision,
      status,
      rules: this.listPermissionRules()
    };
  }

  beginAttachmentStaging(payload = {}) {
    const stagingId =
      payload.stagingId || payload.id || `stage-${crypto.randomUUID().slice(0, 8)}`;
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    const safeFilename = path
      .basename(String(payload.filename || payload.name || "attachment.bin"))
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const mimeType = payload.mimeType || payload.type || "application/octet-stream";
    const attachmentsDir = path.join(this.dataDir, "attachments");
    fs.mkdirSync(attachmentsDir, { recursive: true });
    const filePath = path.join(attachmentsDir, `${stagingId}_${safeFilename}`);
    fs.writeFileSync(filePath, "");

    if (payload.chunk !== undefined || payload.content !== undefined) {
      const buf =
        payload.encoding === "base64"
          ? Buffer.from(String(payload.chunk ?? payload.content), "base64")
          : Buffer.from(String(payload.chunk ?? payload.content), "utf8");
      fs.appendFileSync(filePath, buf);
    }

    const sizeBytes = fs.statSync(filePath).size;
    const now = Date.now();
    this.store.db
      .prepare(
        "INSERT OR REPLACE INTO chat_staged_attachments (staging_id, session_id, filename, mime_type, file_path, size_bytes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'staging', ?)"
      )
      .run(stagingId, sessionId, safeFilename, mimeType, filePath, sizeBytes, now);

    return {
      success: true,
      stagingId,
      sessionId,
      filename: safeFilename,
      mimeType,
      filePath,
      sizeBytes,
      status: "staging"
    };
  }

  appendAttachmentStagingChunk(payload = {}) {
    const stagingId = payload.stagingId || payload.id;
    if (!stagingId) {
      throw new Error("appendAttachmentStagingChunk requires `stagingId`");
    }
    const row = this.store.db
      .prepare("SELECT * FROM chat_staged_attachments WHERE staging_id = ?")
      .get(stagingId);
    if (!row) {
      throw new Error(`Staging attachment not found: ${stagingId}`);
    }

    const rawChunk = payload.chunk ?? payload.data ?? payload.content ?? payload.base64 ?? "";
    let buf;
    if (Buffer.isBuffer(rawChunk)) {
      buf = rawChunk;
    } else if (payload.encoding === "base64" || payload.base64 !== undefined || payload.isBase64) {
      buf = Buffer.from(String(rawChunk), "base64");
    } else {
      buf = Buffer.from(String(rawChunk), "utf8");
    }

    fs.mkdirSync(path.dirname(row.file_path), { recursive: true });
    fs.appendFileSync(row.file_path, buf);
    const sizeBytes = fs.statSync(row.file_path).size;

    this.store.db
      .prepare("UPDATE chat_staged_attachments SET size_bytes = ? WHERE staging_id = ?")
      .run(sizeBytes, stagingId);

    return {
      success: true,
      stagingId,
      sizeBytes,
      status: "staging"
    };
  }

  finishAttachmentStaging(payload = {}) {
    const stagingId = payload.stagingId || payload.id;
    if (!stagingId) {
      throw new Error("finishAttachmentStaging requires `stagingId`");
    }
    const row = this.store.db
      .prepare("SELECT * FROM chat_staged_attachments WHERE staging_id = ?")
      .get(stagingId);
    if (!row) {
      throw new Error(`Staging attachment not found: ${stagingId}`);
    }

    const sizeBytes = fs.existsSync(row.file_path) ? fs.statSync(row.file_path).size : row.size_bytes;
    this.store.db
      .prepare(
        "UPDATE chat_staged_attachments SET size_bytes = ?, status = 'ready' WHERE staging_id = ?"
      )
      .run(sizeBytes, stagingId);

    const attachment = {
      id: stagingId,
      stagingId,
      sessionId: row.session_id,
      filename: row.filename,
      mimeType: row.mime_type,
      filePath: row.file_path,
      sizeBytes,
      status: "ready"
    };

    return {
      success: true,
      attachment,
      attachments: this.listAttachments(row.session_id)
    };
  }

  cancelAttachmentStaging(payload = {}) {
    const stagingId = payload.stagingId || payload.id;
    const row = this.store.db
      .prepare("SELECT * FROM chat_staged_attachments WHERE staging_id = ?")
      .get(stagingId);
    if (row) {
      if (row.file_path && fs.existsSync(row.file_path)) {
        try {
          fs.rmSync(row.file_path, { force: true });
        } catch {}
      }
      this.store.db
        .prepare("UPDATE chat_staged_attachments SET status = 'cancelled' WHERE staging_id = ?")
        .run(stagingId);
    }
    return {
      success: true,
      stagingId,
      status: "cancelled"
    };
  }

  uploadFileDialog(payload = {}) {
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    const filename = payload.filename || (payload.filePath ? path.basename(payload.filePath) : "uploaded.txt");
    const content =
      payload.content !== undefined
        ? payload.content
        : payload.filePath && fs.existsSync(payload.filePath)
          ? fs.readFileSync(payload.filePath)
          : "Uploaded attachment";
    const started = this.beginAttachmentStaging({
      stagingId: payload.stagingId,
      sessionId,
      filename,
      mimeType: payload.mimeType || "text/plain"
    });
    this.appendAttachmentStagingChunk({
      stagingId: started.stagingId,
      chunk: content,
      encoding: payload.encoding
    });
    return this.finishAttachmentStaging({ stagingId: started.stagingId });
  }

  async addAttachmentFromUrl(payload = {}) {
    const url = payload.url || "berry://newtab";
    const sessionId = payload.sessionId || payload.companionId || "default-session";
    const snap = this.domService
      ? await this.domService.inspectUrl(url)
      : {
          url,
          title: url,
          description: "Extracted URL attachment",
          headings: [url],
          textSnippet: `URL context for ${url}`
        };

    const slug = String(snap.title || "url-context")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "url-context";
    const filename = `${slug}.md`;
    const markdown = [
      `# ${snap.title || url}`,
      "",
      `- **URL**: ${snap.url || url}`,
      `- **Description**: ${snap.description || "N/A"}`,
      "",
      "## Headings",
      ...((snap.headings || []).map((h) => `- ${h}`)),
      "",
      "## Snippet",
      snap.textSnippet || ""
    ].join("\n");

    const started = this.beginAttachmentStaging({
      stagingId: payload.stagingId,
      sessionId,
      filename,
      mimeType: "text/markdown"
    });
    this.appendAttachmentStagingChunk({
      stagingId: started.stagingId,
      chunk: markdown,
      encoding: "utf8"
    });
    const finished = this.finishAttachmentStaging({ stagingId: started.stagingId });
    return {
      ...finished,
      attachment: {
        ...finished.attachment,
        sourceUrl: snap.url || url,
        title: snap.title || url
      }
    };
  }

  listAttachments(sessionId = null) {
    const rows = sessionId
      ? this.store.db
          .prepare(
            "SELECT * FROM chat_staged_attachments WHERE session_id = ? AND status = 'ready' ORDER BY created_at ASC, rowid ASC"
          )
          .all(sessionId)
      : this.store.db
          .prepare(
            "SELECT * FROM chat_staged_attachments WHERE status = 'ready' ORDER BY created_at ASC, rowid ASC"
          )
          .all();
    return rows.map((r) => ({
      id: r.staging_id,
      stagingId: r.staging_id,
      sessionId: r.session_id,
      filename: r.filename,
      mimeType: r.mime_type,
      filePath: r.file_path,
      sizeBytes: r.size_bytes,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  duplicateSession(payload = {}) {
    const rawId = payload.companionId || payload.sessionId || "research-rosa";
    const companionId = String(rawId).replace(/^session-/, "");
    const forkedCompanionId =
      payload.newCompanionId || `${companionId}-fork-${Date.now().toString(36)}`;

    const sourceMessages = this.store.db
      .prepare("SELECT * FROM chat_messages WHERE companion_id = ? ORDER BY created_at ASC, rowid ASC")
      .all(companionId);

    const insertStmt = this.store.db.prepare(
      "INSERT INTO chat_messages (id, companion_id, sender, content, tool_calls_json, artifact_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    let offset = 0;
    for (const msg of sourceMessages) {
      const clonedId = `msg-${crypto.randomUUID().slice(0, 8)}`;
      insertStmt.run(
        clonedId,
        forkedCompanionId,
        msg.sender,
        msg.content,
        msg.tool_calls_json || "[]",
        msg.artifact_id || null,
        (msg.created_at || Date.now()) + offset++
      );
    }

    return {
      success: true,
      newSessionId: `session-${forkedCompanionId}`,
      companionId: forkedCompanionId,
      messageCount: sourceMessages.length,
      messages: this.store.listMessages(forkedCompanionId)
    };
  }

  deleteSession(payload = {}) {
    const rawId = payload.companionId || payload.sessionId || "";
    const companionId = String(rawId).replace(/^session-/, "");
    this.store.db
      .prepare("DELETE FROM chat_messages WHERE companion_id = ? OR companion_id = ?")
      .run(companionId, String(rawId));
    return {
      success: true,
      companionId
    };
  }

  forceCompaction(payload = {}) {
    const rawId = payload.companionId || payload.sessionId || "research-rosa";
    const companionId = String(rawId).replace(/^session-/, "");
    const rows = this.store.db
      .prepare("SELECT rowid, * FROM chat_messages WHERE companion_id = ? ORDER BY created_at ASC, rowid ASC")
      .all(companionId);

    const keepRecent = payload.keepRecent !== undefined ? Number(payload.keepRecent) : 1;
    const toCompact =
      rows.length > keepRecent && keepRecent > 0 ? rows.slice(0, rows.length - keepRecent) : rows;
    const compactedCount = toCompact.length;

    const bulletLines = toCompact.map(
      (m, idx) => `- [${idx + 1}] (${m.sender}): ${String(m.content || "").replace(/\s+/g, " ").slice(0, 140)}`
    );
    const summary = [
      `### Karpathy-Wiki Compaction Summary (${compactedCount} messages compacted)`,
      ...bulletLines
    ].join("\n");

    if (toCompact.length > 0) {
      const delStmt = this.store.db.prepare("DELETE FROM chat_messages WHERE id = ?");
      for (const m of toCompact) {
        delStmt.run(m.id);
      }
    }

    const summaryId = `msg-compact-${crypto.randomUUID().slice(0, 8)}`;
    const earliestTs = toCompact[0]?.created_at ? toCompact[0].created_at - 1 : Date.now();
    const toolCalls = [
      {
        tool: "karpathy_context_compaction",
        status: "done",
        triggeredCompaction: true,
        compactedCount
      }
    ];
    this.store.db
      .prepare(
        "INSERT INTO chat_messages (id, companion_id, sender, content, tool_calls_json, artifact_id, created_at) VALUES (?, ?, 'system', ?, ?, NULL, ?)"
      )
      .run(summaryId, companionId, summary, JSON.stringify(toolCalls), earliestTs);

    if (this.memory && typeof this.memory.appendObservation === "function") {
      this.memory.appendObservation({
        companionId,
        summary: `Session compaction summarized ${compactedCount} messages into ${summaryId}`
      });
    }

    return {
      success: true,
      companionId,
      compactedCount,
      triggeredCompaction: true,
      summary,
      messages: this.store.listMessages(companionId)
    };
  }

  previewSystemPrompt(payload = {}) {
    const companionId = payload.companionId || "research-rosa";
    const prompt = payload.prompt || payload.message || "";
    const companions = this.store.listCompanions();
    const companion = companions.find((c) => c.id === companionId) || companions[0];

    const profileMd = this.memory ? this.memory.readFile("PROFILE.md") : "";
    const companionMd = this.memory
      ? this.memory.readFile(`companions/${companion.id}/COMPANION.md`)
      : "";

    const catalogLoader = this.getSkillCatalog();
    const progSkills = catalogLoader.buildProgressiveContext({
      companionSkills: companion?.skills || [],
      prompt
    });

    const sections = [
      `# System Prompt — ${companion.name} (${companion.role})`,
      companion.system_prompt || companion.systemPrompt || companion.summary || "",
      "",
      "## Global Memory (`PROFILE.md`)",
      profileMd || "(empty)",
      "",
      `## Companion Memory (\`companions/${companion.id}/COMPANION.md\`)`,
      companionMd || "(empty)",
      "",
      "## Progressive OpenJarvis Skills Catalog",
      progSkills.xmlCatalog
    ];

    const systemPrompt = sections.join("\n").trim();
    const tokenEstimate = Math.ceil(systemPrompt.length / 4);

    return {
      success: true,
      companionId: companion.id,
      systemPrompt,
      tokenEstimate,
      activatedSkills: progSkills.activatedSkills
    };
  }

  estimateMessagesTokens(payload = {}) {
    let messages = payload.messages;
    if (!Array.isArray(messages)) {
      const companionId = payload.companionId || payload.sessionId || "research-rosa";
      messages = this.store.listMessages(String(companionId).replace(/^session-/, ""));
    }
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg === "string") {
        totalChars += msg.length;
      } else if (msg && typeof msg === "object") {
        totalChars += String(msg.content ?? msg.text ?? JSON.stringify(msg)).length;
      }
    }
    const totalTokens = Math.ceil(totalChars / 4);
    return {
      success: true,
      tokens: totalTokens,
      messageCount: messages.length,
      charCount: totalChars
    };
  }

  findTextPage(payload = {}) {
    const query = String(payload.query ?? payload.text ?? "").trim();
    const companionFilter = payload.companionId || payload.sessionId
      ? String(payload.companionId || payload.sessionId).replace(/^session-/, "")
      : null;

    if (!query) {
      return {
        success: true,
        query: "",
        matches: [],
        totalMatches: 0
      };
    }

    const rows = companionFilter
      ? this.store.db
          .prepare(
            "SELECT * FROM chat_messages WHERE companion_id = ? ORDER BY created_at ASC, rowid ASC"
          )
          .all(companionFilter)
      : this.store.db
          .prepare("SELECT * FROM chat_messages ORDER BY created_at ASC, rowid ASC")
          .all();

    const needle = query.toLowerCase();
    const matches = [];

    for (const row of rows) {
      const text = String(row.content || "");
      const lower = text.toLowerCase();
      let fromIndex = 0;
      while (fromIndex <= lower.length) {
        const idx = lower.indexOf(needle, fromIndex);
        if (idx === -1) break;
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + needle.length + 50);
        const snippet = text.slice(start, end);
        matches.push({
          messageId: row.id,
          companionId: row.companion_id,
          sender: row.sender,
          snippet,
          offset: idx
        });
        fromIndex = idx + Math.max(1, needle.length);
      }
    }

    const stateKey = companionFilter || "global";
    this.pageFindState.set(stateKey, { query, matches, totalMatches: matches.length });

    return {
      success: true,
      query,
      matches,
      totalMatches: matches.length
    };
  }

  loadFindMessage(payload = {}) {
    const messageId = payload.messageId || payload.id;
    const row = messageId
      ? this.store.db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(messageId)
      : null;
    return {
      success: true,
      message: row
        ? {
            ...row,
            messageId: row.id,
            companionId: row.companion_id
          }
        : null
    };
  }

  cancelPageFind(payload = {}) {
    const stateKey = payload.companionId || payload.sessionId || "global";
    this.pageFindState.delete(stateKey);
    return {
      success: true,
      active: false,
      query: "",
      matches: [],
      totalMatches: 0
    };
  }

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      case "chat:stopGenerating":
        return this.stopGenerating(payload);
      case "chat:editMessage":
        return await this.editMessage(payload);
      case "chat:retryCompletion":
        return await this.retryCompletion(payload);
      case "chat:steer-active-turn":
        return this.steerActiveTurn(payload);
      case "chat:continue-execution":
        return this.continueExecution(payload);
      case "chat:answerToolInput":
      case "chat:answerCodeToolPermission":
      case "chat:answerUserRequest":
      case "chat:update-tool-result":
        return this.answerToolPermission(payload);
      case "chat-permissions:list-rules":
        return { rules: this.listPermissionRules() };
      case "chat:beginAttachmentStaging":
        return this.beginAttachmentStaging(payload);
      case "chat:appendAttachmentStagingChunk":
        return this.appendAttachmentStagingChunk(payload);
      case "chat:finishAttachmentStaging":
        return this.finishAttachmentStaging(payload);
      case "chat:cancelAttachmentStaging":
        return this.cancelAttachmentStaging(payload);
      case "context:upload-file-dialog":
        return this.uploadFileDialog(payload);
      case "context:add-attachment-from-url":
        return await this.addAttachmentFromUrl(payload);
      case "chat:duplicate-session":
        return this.duplicateSession(payload);
      case "storage:delete-session":
        return this.deleteSession(payload);
      case "chat:forceCompaction":
        return this.forceCompaction(payload);
      case "chat:previewSystemPrompt":
        return this.previewSystemPrompt(payload);
      case "tokens:estimate-messages":
        return this.estimateMessagesTokens(payload);
      case "chat:findTextPage":
        return this.findTextPage(payload);
      case "chat:loadFindMessage":
        return this.loadFindMessage(payload);
      case "chat:cancelPageFind":
        return this.cancelPageFind(payload);
      default:
        return null;
    }
  }
}

import crypto from "node:crypto";

const DEFAULT_ACTIVITY_SCHEDULE = {
  enabled: true,
  pausedUntilMs: null,
  schedule: {
    enabled: true,
    weekdays: [1, 2, 3, 4, 5],
    startMinute: 540,
    endMinute: 1080
  },
  scheduleOverrideUntilMs: null
};

function todayDateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function toActivitySessionShape(row) {
  const createdAtMs = Number(row.created_at || Date.now());
  const durationMs = Number(row.duration_ms || 60000);
  const category = row.category || "work";
  return {
    id: row.id,
    date_key: row.date_key,
    dateKey: row.date_key,
    domain: row.domain,
    title: row.title,
    description: row.description,
    companion_id: row.companion_id || "research-rosa",
    companionId: row.companion_id || "research-rosa",
    category,
    duration_ms: durationMs,
    durationMs,
    created_at: createdAtMs,
    createdAt: createdAtMs,
    startTime: new Date(createdAtMs - durationMs).toISOString(),
    endTime: new Date(createdAtMs).toISOString(),
    hasScreenshots: false,
    categoryDistribution: {
      work: category === "work" ? 0.8 : 0.2,
      learning: category === "learning" ? 0.8 : 0.2,
      entertainment: category === "entertainment" ? 0.8 : 0,
      life: category === "life" ? 0.8 : 0,
      other: 0
    }
  };
}

export class Spec007MeetingsVoiceService {
  constructor({ store, memory = null, orchestrator = null } = {}) {
    if (!store || !store.db) {
      throw new Error("Spec007MeetingsVoiceService requires a valid SqliteWorkspaceStore instance");
    }
    this.store = store;
    this.memory = memory;
    this.orchestrator = orchestrator;
    this.activeRecording = null;
    this.levelsTesting = false;
    this.quickPillRecording = false;
    this.initSchema();
  }

  initSchema() {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        date_key TEXT NOT NULL,
        domain TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        companion_id TEXT DEFAULT 'research-rosa',
        category TEXT DEFAULT 'work',
        duration_ms INTEGER DEFAULT 60000,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS voice_command_history (
        id TEXT PRIMARY KEY,
        transcript TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        target_session_id TEXT,
        target_url TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    const countRow = this.store.db.prepare("SELECT COUNT(*) AS c FROM activity_events").get();
    if (!countRow || countRow.c === 0) {
      this.seedDefaultActivityEvents();
    }

    const existingSchedule = this.store.getSetting("activityMemorySchedule", null);
    if (!existingSchedule) {
      this.store.setSetting("activityMemorySchedule", DEFAULT_ACTIVITY_SCHEDULE);
    }
  }

  seedDefaultActivityEvents() {
    const now = Date.now();
    const dateKey = todayDateKey(now);
    const defaults = [
      {
        id: "act-seed-1",
        dateKey,
        domain: "github.com",
        title: "Ổi Browser Repository Architecture Review",
        description: "Kiểm tra cấu trúc SQLite Workspace Store và AgentDOMBrowserService trên kho mã nguồn Ổi Browser.",
        companionId: "developer-dana",
        category: "work",
        durationMs: 240000,
        createdAt: now - 360000
      },
      {
        id: "act-seed-2",
        dateKey,
        domain: "oibrowser.vn",
        title: "Karpathy-Wiki Memory & Meetings Studio Sync",
        description: "Đồng bộ biên bản cuộc họp và hồ sơ thực thể vào bộ nhớ Karpathy-Wiki cục bộ.",
        companionId: "research-rosa",
        category: "learning",
        durationMs: 180000,
        createdAt: now - 180000
      },
      {
        id: "act-seed-3",
        dateKey,
        domain: "linkedin.com",
        title: "Sales & Recruiting Prospect Qualification",
        description: "Phân loại danh sách khách hàng tiềm năng và tín hiệu mua hàng cùng trợ lý Xoài.",
        companionId: "sales-sally",
        category: "work",
        durationMs: 120000,
        createdAt: now - 60000
      }
    ];

    const stmt = this.store.db.prepare(`
      INSERT OR IGNORE INTO activity_events (
        id, date_key, domain, title, description, companion_id, category, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of defaults) {
      stmt.run(
        item.id,
        item.dateKey,
        item.domain,
        item.title,
        item.description,
        item.companionId,
        item.category,
        item.durationMs,
        item.createdAt
      );
    }
  }

  // ===========================================================================
  // 1. Meetings & Audio Lifecycle (FR-701)
  // ===========================================================================

  listMeetings() {
    return this.store.listMeetings();
  }

  getMeetingById(id) {
    if (!id) return null;
    const row = this.store.db.prepare("SELECT * FROM meetings WHERE id = ?").get(id);
    if (!row) return null;
    return {
      ...row,
      actionItems: JSON.parse(row.action_items_json || "[]")
    };
  }

  startRecording(payload = {}) {
    const id = payload.recordingId || payload.id || `mtg-${crypto.randomUUID().slice(0, 8)}`;
    this.activeRecording = {
      id,
      title: payload.title || "Phiên ghi âm & Phiên dịch Ổi Browser",
      startedAt: Date.now(),
      status: "recording",
      transcriptChunks: payload.transcriptText ? [String(payload.transcriptText)] : []
    };
    return {
      success: true,
      recordingId: id,
      status: "recording",
      activeRecording: { ...this.activeRecording }
    };
  }

  continueRecording(payload = {}) {
    if (!this.activeRecording) {
      return this.startRecording(payload);
    }
    this.activeRecording.status = "recording";
    if (payload.title) {
      this.activeRecording.title = payload.title;
    }
    if (payload.transcriptText) {
      this.activeRecording.transcriptChunks.push(String(payload.transcriptText));
    }
    return {
      success: true,
      recordingId: this.activeRecording.id,
      status: "recording",
      activeRecording: { ...this.activeRecording }
    };
  }

  stopRecording(payload = {}) {
    return this.finishRecording(payload);
  }

  finishRecording(payload = {}) {
    const now = Date.now();
    const targetId = payload.recordingId || payload.id || this.activeRecording?.id || `mtg-${crypto.randomUUID().slice(0, 8)}`;
    const elapsedSec = this.activeRecording
      ? Math.max(1, Math.round((now - this.activeRecording.startedAt) / 1000))
      : 180;
    const durationSec = Number(payload.durationSec ?? elapsedSec) || 180;
    const title = payload.title || this.activeRecording?.title || "Phiên ghi âm & Phiên dịch Ổi Browser";
    const recordedChunks = this.activeRecording?.transcriptChunks?.length
      ? this.activeRecording.transcriptChunks.join("\n")
      : "";
    const transcriptText =
      payload.transcriptText ||
      recordedChunks ||
      "Ghi nhận nội dung cuộc họp và đồng bộ sang Karpathy-Wiki. Triển khai các đầu việc tự động.";
    const summaryMarkdown =
      payload.summaryMarkdown ||
      `### Tóm tắt Cuộc họp: ${title}\n- ${transcriptText}`;
    const actionItems = Array.isArray(payload.actionItems) && payload.actionItems.length > 0
      ? payload.actionItems
      : [
          `Action #1: Đồng bộ biên bản "${title}" vào Karpathy-Wiki`,
          "Action #2: Triển khai các đầu việc hậu cuộc họp cùng trợ lý AI"
        ];

    const existing = this.getMeetingById(targetId);
    const createdAt = existing?.created_at || now;
    this.store.db.prepare(`
      INSERT OR REPLACE INTO meetings (
        id, title, duration_sec, transcript_text, summary_markdown, action_items_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      targetId,
      title,
      durationSec,
      transcriptText,
      summaryMarkdown,
      JSON.stringify(actionItems),
      createdAt
    );

    this.activeRecording = null;
    const meeting = this.getMeetingById(targetId);

    this.recordActivityEvent({
      domain: "oibrowser.vn",
      title: `Ghi âm cuộc họp: ${title}`,
      description: summaryMarkdown,
      companionId: payload.companionId || "consulting-cora",
      category: "work",
      durationMs: durationSec * 1000
    });

    return {
      success: true,
      status: "idle",
      recordingId: meeting.id,
      meeting,
      meetings: this.listMeetings()
    };
  }

  getTranscriptionSessionState() {
    return {
      success: true,
      status: this.activeRecording ? this.activeRecording.status : "idle",
      activeRecordingId: this.activeRecording?.id || null,
      isTranscribing: Boolean(this.activeRecording),
      levelsTesting: this.levelsTesting
    };
  }

  startLevelsTest(payload = {}) {
    this.levelsTesting = true;
    return {
      success: true,
      testing: true,
      level: 0.72,
      deviceId: payload.deviceId || this.store.getSetting("preferredMicDeviceId", "default-mic")
    };
  }

  stopLevelsTest() {
    this.levelsTesting = false;
    return {
      success: true,
      testing: false,
      level: 0
    };
  }

  transcribeRecording(payload = {}) {
    const targetId = payload.recordingId || payload.id || this.activeRecording?.id;
    let existing = targetId ? this.getMeetingById(targetId) : (this.listMeetings()[0] || null);
    if (!existing) {
      const created = this.finishRecording({
        recordingId: targetId || `mtg-${crypto.randomUUID().slice(0, 8)}`,
        title: payload.title || "Phiên ghi âm & Phiên dịch Ổi Browser",
        transcriptText: payload.transcriptText,
        summaryMarkdown: payload.summaryMarkdown,
        actionItems: payload.actionItems
      });
      existing = created.meeting;
    }

    const updatedTranscript =
      payload.transcriptText ||
      existing.transcript_text ||
      "Bản ghi âm đã được bóc tách tự động sang văn bản có cấu trúc.";
    const updatedSummary =
      payload.summaryMarkdown ||
      existing.summary_markdown ||
      `### Tóm tắt Cuộc họp: ${existing.title}\n- ${updatedTranscript}`;
    const updatedActions =
      Array.isArray(payload.actionItems) && payload.actionItems.length > 0
        ? payload.actionItems
        : existing.actionItems?.length
          ? existing.actionItems
          : [
              `Action #1: Rà soát biên bản "${existing.title}"`,
              "Action #2: Gửi kế hoạch hành động cho trợ lý phụ trách"
            ];

    this.store.db.prepare(`
      UPDATE meetings
      SET transcript_text = ?, summary_markdown = ?, action_items_json = ?
      WHERE id = ?
    `).run(updatedTranscript, updatedSummary, JSON.stringify(updatedActions), existing.id);

    const meeting = this.getMeetingById(existing.id);
    return {
      success: true,
      recordingId: meeting.id,
      meeting,
      transcriptText: meeting.transcript_text,
      summaryMarkdown: meeting.summary_markdown,
      actionItems: meeting.actionItems
    };
  }

  deleteMeeting(idOrPayload) {
    const targetId =
      typeof idOrPayload === "string"
        ? idOrPayload
        : idOrPayload?.recordingId || idOrPayload?.meetingId || idOrPayload?.id || "";
    const result = this.store.db.prepare("DELETE FROM meetings WHERE id = ?").run(targetId);
    const meetings = this.listMeetings();
    return {
      success: true,
      deletedId: targetId,
      deletedCount: Number(result?.changes || 0),
      meetings,
      recordings: meetings.map((m) => ({
        id: m.id,
        hasTranscription: true,
        meetingTitle: m.title
      }))
    };
  }

  deleteRecording(idOrPayload) {
    return this.deleteMeeting(idOrPayload);
  }

  searchMeetings(queryOrPayload = "") {
    const rawQuery =
      typeof queryOrPayload === "string"
        ? queryOrPayload
        : queryOrPayload?.query ?? queryOrPayload?.q ?? queryOrPayload?.searchTerm ?? "";
    const q = String(rawQuery || "").trim();

    let rows;
    if (!q) {
      rows = this.store.db.prepare("SELECT * FROM meetings ORDER BY created_at DESC").all();
    } else {
      const pattern = `%${q}%`;
      const sqlRows = this.store.db.prepare(`
        SELECT * FROM meetings
        WHERE title LIKE ? OR transcript_text LIKE ? OR summary_markdown LIKE ?
        ORDER BY created_at DESC
      `).all(pattern, pattern, pattern);

      const lowerQ = q.toLowerCase();
      const allRows = this.store.db.prepare("SELECT * FROM meetings ORDER BY created_at DESC").all();
      const byId = new Map(sqlRows.map((r) => [r.id, r]));
      for (const row of allRows) {
        if (
          String(row.title || "").toLowerCase().includes(lowerQ) ||
          String(row.transcript_text || "").toLowerCase().includes(lowerQ) ||
          String(row.summary_markdown || "").toLowerCase().includes(lowerQ)
        ) {
          byId.set(row.id, row);
        }
      }
      rows = Array.from(byId.values());
    }

    const meetings = rows.map((m) => ({
      ...m,
      actionItems: JSON.parse(m.action_items_json || "[]")
    }));
    const recordings = meetings.map((m) => ({
      id: m.id,
      recordingId: m.id,
      hasTranscription: true,
      meetingTitle: m.title,
      title: m.title,
      durationSec: m.duration_sec,
      summaryMarkdown: m.summary_markdown,
      actionItems: m.actionItems
    }));

    return {
      success: true,
      query: q,
      recordings,
      meetings
    };
  }

  searchRecordings(queryOrPayload = "") {
    return this.searchMeetings(queryOrPayload);
  }

  attachRecordingToChat(payload = {}) {
    const requestedId = payload.recordingId || payload.meetingId || payload.id;
    let m = requestedId ? this.getMeetingById(requestedId) : null;
    if (!m) {
      m = this.listMeetings()[0] || null;
    }
    if (!m) {
      const created = this.finishRecording({
        title: "Họp Điều phối Sản phẩm Ổi Browser",
        transcriptText: "Thống nhất kiến trúc Karpathy-Wiki và triển khai đầu việc.",
        summaryMarkdown: "### Tóm tắt Cuộc họp\n- Thống nhất kiến trúc Karpathy-Wiki.",
        actionItems: ["Action #1: Triển khai các đầu việc tự động"]
      });
      m = created.meeting;
    }

    const companionId = payload.companionId || "consulting-cora";
    const sessionId = payload.sessionId || `session-${companionId}`;
    const actionItemsJson = m.action_items_json || JSON.stringify(m.actionItems || []);
    const contextContent = [
      `[Biên bản Cuộc họp Đính kèm: ${m.title}]`,
      m.summary_markdown,
      `Action Items: ${actionItemsJson}`
    ].join("\n\n");

    const message = this.store.addMessage({
      companionId,
      sender: "user",
      content: contextContent
    });

    this.recordActivityEvent({
      domain: "oibrowser.vn",
      title: `Đính kèm biên bản họp vào phiên chat (${companionId})`,
      description: `${m.title} -> /chat/${sessionId}`,
      companionId,
      category: "work",
      durationMs: 45000
    });

    return {
      success: true,
      sessionId,
      companionId,
      meetingId: m.id,
      url: `/chat/${sessionId}`,
      message,
      meeting: m
    };
  }

  openPostMeetingChat(payload = {}) {
    return this.attachRecordingToChat(payload);
  }

  // ===========================================================================
  // 2. Voice Commands, Quick-Pill & TTS (FR-702)
  // ===========================================================================

  recordVoiceHistory({ transcript, actionKind, targetSessionId = null, targetUrl = null }) {
    const id = `vcmd-${crypto.randomUUID().slice(0, 8)}`;
    const createdAt = Date.now();
    this.store.db.prepare(`
      INSERT INTO voice_command_history (
        id, transcript, action_kind, target_session_id, target_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, String(transcript || ""), String(actionKind || "voiceCommand"), targetSessionId, targetUrl, createdAt);
    return {
      id,
      transcript: String(transcript || ""),
      action_kind: String(actionKind || "voiceCommand"),
      target_session_id: targetSessionId,
      target_url: targetUrl,
      created_at: createdAt
    };
  }

  listVoiceCommandHistory() {
    return this.store.db.prepare("SELECT * FROM voice_command_history ORDER BY created_at DESC").all();
  }

  previewVoice(payload = {}, actionKind = "tts:preview-voice") {
    const voice = payload.voice || "vi-VN-Standard-A";
    const text = payload.text || "Xin chào, đây là giọng đọc thử nghiệm của Ổi Browser.";
    this.recordVoiceHistory({
      transcript: text,
      actionKind
    });
    return {
      success: true,
      playing: true,
      voice,
      text
    };
  }

  readAloud(payload = {}) {
    return this.previewVoice(payload, "voiceCommand:readAloud");
  }

  startQuickPillRecording(payload = {}) {
    this.quickPillRecording = true;
    const entry = this.recordVoiceHistory({
      transcript: payload.transcript || "start-recording",
      actionKind: "quick-pill:start-recording"
    });
    return {
      success: true,
      recording: true,
      status: "recording",
      historyId: entry.id
    };
  }

  stopQuickPillRecording(payload = {}) {
    this.quickPillRecording = false;
    const transcript = payload.transcript || payload.text || "";
    const entry = this.recordVoiceHistory({
      transcript: transcript || "stop-recording",
      actionKind: "quick-pill:stop-recording"
    });
    return {
      success: true,
      recording: false,
      status: "idle",
      transcript,
      historyId: entry.id
    };
  }

  cancelVoiceCommand(payload = {}) {
    this.quickPillRecording = false;
    const entry = this.recordVoiceHistory({
      transcript: payload.transcript || payload.text || "cancelled",
      actionKind: "voiceCommand:cancel"
    });
    return {
      success: true,
      cancelled: true,
      status: "cancelled",
      historyId: entry.id
    };
  }

  openVoiceUrl(payload = {}) {
    const targetUrl = payload.url || payload.targetUrl || "https://github.com/jangtrinh/oi-browser";
    const transcript = payload.transcript || payload.text || `Open ${targetUrl}`;
    const entry = this.recordVoiceHistory({
      transcript,
      actionKind: "voiceCommand:openUrl",
      targetUrl
    });
    const tab = this.store.createTab({
      title: payload.title || targetUrl,
      url: targetUrl,
      surfaceKind: targetUrl.startsWith("http") ? "web" : "newTab",
      activate: true
    });
    return {
      success: true,
      url: targetUrl,
      tab,
      historyId: entry.id
    };
  }

  async submitVoiceCommand(payload = {}, actionKind = "quick-pill:submit") {
    this.quickPillRecording = false;
    const transcript = String(
      payload.transcript ||
        payload.text ||
        payload.prompt ||
        payload.message ||
        payload.command ||
        "Phân tích tiến độ công việc hiện tại trên Ổi Browser"
    ).trim();
    const companionId = payload.companionId || "consulting-cora";
    const sessionId = payload.sessionId || `session-${companionId}`;
    const targetUrl = payload.url || `/chat/${sessionId}`;

    const historyEntry = this.recordVoiceHistory({
      transcript,
      actionKind,
      targetSessionId: sessionId,
      targetUrl
    });

    let responseMsg = null;
    const beforeCount = this.store.listMessages(companionId).length;

    if (this.orchestrator && typeof this.orchestrator.handleUserTurn === "function") {
      const turnResult = await this.orchestrator.handleUserTurn({
        companionId,
        message: transcript,
        activeUrl: payload.activeUrl,
        harnessId: payload.harnessId,
        liveCli: Boolean(payload.liveCli)
      });
      const afterMessages = this.store.listMessages(companionId);
      if (afterMessages.length === beforeCount) {
        this.store.addMessage({ companionId, sender: "user", content: transcript });
        responseMsg = this.store.addMessage({
          companionId,
          sender: "assistant",
          content: turnResult?.assistantMessage?.content || turnResult?.reply || `Đã thực thi lệnh giọng nói: ${transcript}`
        });
      } else {
        responseMsg = turnResult?.assistantMessage || afterMessages[afterMessages.length - 1];
      }
    } else {
      this.store.addMessage({ companionId, sender: "user", content: transcript });
      responseMsg = this.store.addMessage({
        companionId,
        sender: "assistant",
        content: `Đã tiếp nhận và xử lý lệnh giọng nói (${actionKind}): "${transcript}"`
      });
    }

    this.recordActivityEvent({
      domain: "oibrowser.vn",
      title: `Voice Command (${actionKind})`,
      description: `${companionId}: ${transcript}`,
      companionId,
      category: "work",
      durationMs: 30000
    });

    return {
      success: true,
      sessionId,
      companionId,
      url: targetUrl,
      transcript,
      response: responseMsg,
      historyId: historyEntry.id
    };
  }

  // ===========================================================================
  // 3. Activity Memory Search, Schedule Toggle & Deletion (FR-703)
  // ===========================================================================

  recordActivityEvent({
    id,
    dateKey,
    domain = "oibrowser.vn",
    title = "Hoạt động Ổi Browser",
    description = "",
    companionId = "research-rosa",
    category = "work",
    durationMs = 60000,
    createdAt
  } = {}) {
    const now = createdAt || Date.now();
    const eventId = id || `act-${crypto.randomUUID().slice(0, 8)}`;
    const resolvedDateKey = dateKey || todayDateKey(now);
    this.store.db.prepare(`
      INSERT OR REPLACE INTO activity_events (
        id, date_key, domain, title, description, companion_id, category, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      resolvedDateKey,
      domain,
      title,
      description,
      companionId,
      category,
      Number(durationMs || 60000),
      now
    );
    const row = this.store.db.prepare("SELECT * FROM activity_events WHERE id = ?").get(eventId);
    return toActivitySessionShape(row);
  }

  listActivityEvents({ dateKey } = {}) {
    const rows = dateKey
      ? this.store.db.prepare("SELECT * FROM activity_events WHERE date_key = ? ORDER BY created_at DESC").all(dateKey)
      : this.store.db.prepare("SELECT * FROM activity_events ORDER BY created_at DESC").all();
    return rows.map(toActivitySessionShape);
  }

  getActivityMemoryStatus() {
    const saved = this.store.getSetting("activityMemorySchedule", DEFAULT_ACTIVITY_SCHEDULE) || DEFAULT_ACTIVITY_SCHEDULE;
    const enabledSetting = this.store.getSetting("activityMemoryEnabled", true);
    const enabled = saved.enabled !== undefined ? Boolean(saved.enabled) : Boolean(enabledSetting);
    return {
      enabled,
      pausedUntilMs: saved.pausedUntilMs ?? null,
      schedule: {
        ...DEFAULT_ACTIVITY_SCHEDULE.schedule,
        ...(saved.schedule || {})
      },
      scheduleOverrideUntilMs: saved.scheduleOverrideUntilMs ?? null
    };
  }

  setActivityMemoryStatus(payload = {}) {
    const current = this.getActivityMemoryStatus();
    const updated = {
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled,
      pausedUntilMs: payload.pausedUntilMs !== undefined ? payload.pausedUntilMs : current.pausedUntilMs,
      schedule: {
        ...current.schedule,
        ...(payload.schedule || {}),
        ...(payload.weekdays ? { weekdays: payload.weekdays } : {}),
        ...(payload.startMinute !== undefined ? { startMinute: payload.startMinute } : {}),
        ...(payload.endMinute !== undefined ? { endMinute: payload.endMinute } : {})
      },
      scheduleOverrideUntilMs:
        payload.scheduleOverrideUntilMs !== undefined
          ? payload.scheduleOverrideUntilMs
          : current.scheduleOverrideUntilMs
    };
    this.store.setSetting("activityMemorySchedule", updated);
    this.store.setSetting("activityMemoryEnabled", updated.enabled);
    return {
      success: true,
      ...updated
    };
  }

  searchActivityMemory(queryOrPayload = "") {
    const rawQuery =
      typeof queryOrPayload === "string"
        ? queryOrPayload
        : queryOrPayload?.query ?? queryOrPayload?.q ?? queryOrPayload?.searchTerm ?? "";
    const q = String(rawQuery || "").trim();

    let rows;
    if (!q) {
      rows = this.store.db.prepare("SELECT * FROM activity_events ORDER BY created_at DESC").all();
    } else {
      const pattern = `%${q}%`;
      const sqlRows = this.store.db.prepare(`
        SELECT * FROM activity_events
        WHERE title LIKE ? OR description LIKE ? OR domain LIKE ?
        ORDER BY created_at DESC
      `).all(pattern, pattern, pattern);

      const lowerQ = q.toLowerCase();
      const allRows = this.store.db.prepare("SELECT * FROM activity_events ORDER BY created_at DESC").all();
      const byId = new Map(sqlRows.map((r) => [r.id, r]));
      for (const row of allRows) {
        if (
          String(row.title || "").toLowerCase().includes(lowerQ) ||
          String(row.description || "").toLowerCase().includes(lowerQ) ||
          String(row.domain || "").toLowerCase().includes(lowerQ)
        ) {
          byId.set(row.id, row);
        }
      }
      rows = Array.from(byId.values());
    }

    const results = rows.map(toActivitySessionShape);
    return {
      success: true,
      query: q,
      results,
      sessions: results
    };
  }

  deleteActivityDay(dateOrPayload) {
    const dateKey =
      typeof dateOrPayload === "string"
        ? dateOrPayload
        : dateOrPayload?.date || dateOrPayload?.dateKey || todayDateKey();
    const res = this.store.db.prepare("DELETE FROM activity_events WHERE date_key = ?").run(dateKey);
    return {
      success: true,
      deletedDate: dateKey,
      deletedCount: Number(res?.changes || 0)
    };
  }

  clearAllActivity() {
    const res = this.store.db.prepare("DELETE FROM activity_events").run();
    return {
      success: true,
      deletedCount: Number(res?.changes || 0)
    };
  }

  deleteAllActivity() {
    return this.clearAllActivity();
  }

  // ===========================================================================
  // Unified Channel Dispatcher
  // ===========================================================================

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      // 1. Meetings & Audio Lifecycle (FR-701)
      case "transcription:start":
      case "audio:start-recording":
        return this.startRecording(payload);

      case "meeting:continue-recording":
        return this.continueRecording(payload);

      case "transcription:stop":
      case "audio:stop-recording":
      case "meeting:finish-recording":
        return this.finishRecording(payload);

      case "transcription:get-session-state":
        return this.getTranscriptionSessionState();

      case "transcription:levels-test:start":
        return this.startLevelsTest(payload);

      case "transcription:levels-test:stop":
        return this.stopLevelsTest();

      case "audio:transcribe-recording":
        return this.transcribeRecording(payload);

      case "audio:delete-recording":
      case "meetings:delete":
      case "meeting:delete":
        return this.deleteRecording(payload);

      case "audio:search-recordings":
      case "meetings:search":
        return this.searchRecordings(payload);

      case "audio:attach-recording-to-chat":
      case "meeting:open-post-meeting-chat":
      case "meeting:open-post-meeting-page":
        return this.attachRecordingToChat(payload);

      case "audio:get-recordings":
        return {
          success: true,
          recordings: this.listMeetings().map((m) => ({
            id: m.id,
            hasTranscription: true,
            meetingTitle: m.title
          }))
        };

      case "meeting-toast:dismiss":
      case "meeting-toast:open":
      case "meeting-toast:action":
        return { success: true, handled: channel };

      // 2. Voice Commands, Quick-Pill & TTS (FR-702)
      case "tts:preview-voice":
        return this.previewVoice(payload, "tts:preview-voice");

      case "voiceCommand:readAloud":
        return this.readAloud(payload);

      case "quick-pill:start-recording":
        return this.startQuickPillRecording(payload);

      case "quick-pill:stop-recording":
        return this.stopQuickPillRecording(payload);

      case "quick-pill:submit":
      case "voiceCommand:confirm":
      case "voiceCommand:openChat":
        return await this.submitVoiceCommand(payload, channel);

      case "voiceCommand:cancel":
        return this.cancelVoiceCommand(payload);

      case "voiceCommand:openUrl":
        return this.openVoiceUrl(payload);

      // 3. Activity Memory Search, Schedule Toggle & Deletion (FR-703)
      case "gia-activity-memory:status-get":
        return this.getActivityMemoryStatus();

      case "gia-activity-memory:status-set":
        return this.setActivityMemoryStatus(payload);

      case "gia-activity-memory:search":
        return this.searchActivityMemory(payload);

      case "gia-activity-memory:delete-day":
        return this.deleteActivityDay(payload);

      case "gia-activity-memory:delete-all":
        return this.clearAllActivity();

      case "activity-memory:get-sessions-for-day": {
        const dateKey = payload.date || payload.dateKey || todayDateKey();
        return {
          success: true,
          sessions: this.listActivityEvents({ dateKey })
        };
      }

      case "activity-memory:get-sessions-for-range": {
        const all = this.listActivityEvents();
        const sessionsByDate = {};
        for (const ev of all) {
          if (!sessionsByDate[ev.dateKey]) sessionsByDate[ev.dateKey] = [];
          sessionsByDate[ev.dateKey].push(ev);
        }
        return {
          success: true,
          sessionsByDate
        };
      }

      case "activity-memory:get-screenshots-for-day":
      case "activity-memory:get-screenshots-for-session":
      case "activity-memory:dev-force-regenerate-day":
        return {
          success: true,
          screenshots: [],
          regenerated: true
        };

      default:
        return null;
    }
  }
}

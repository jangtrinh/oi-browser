import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { Spec007MeetingsVoiceService } from "../src/server/domains/spec-007-meetings-voice.js";

function createTestContext(withOrchestrator = false) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oi-spec-007-test-"));
  const dbPath = path.join(tmpDir, "workspace.sqlite");
  const store = new SqliteWorkspaceStore(dbPath);

  let orchestrator = null;
  if (withOrchestrator) {
    orchestrator = {
      calls: [],
      async handleUserTurn({ companionId, message, activeUrl }) {
        this.calls.push({ companionId, message, activeUrl });
        store.addMessage({ companionId, sender: "user", content: message });
        const assistantMessage = store.addMessage({
          companionId,
          sender: "assistant",
          content: `[Orchestrator Reply to ${companionId}]: ${message}`
        });
        return { assistantMessage };
      }
    };
  }

  const service = new Spec007MeetingsVoiceService({ store, orchestrator });
  return {
    tmpDir,
    store,
    orchestrator,
    service,
    cleanup() {
      try {
        store.db.close();
      } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
}

test("Spec 007 initSchema creates activity_events & voice_command_history and seeds today's events", () => {
  const ctx = createTestContext();
  try {
    const schema = ctx.store.introspectDatabase();
    const tableNames = schema.tables.map((t) => t.tableName);
    assert.ok(tableNames.includes("activity_events"), "activity_events table must exist");
    assert.ok(tableNames.includes("voice_command_history"), "voice_command_history table must exist");

    const seeded = ctx.service.listActivityEvents();
    assert.ok(seeded.length >= 3, "should seed at least 3 default activity_events for today");
    const todayKey = new Date().toISOString().slice(0, 10);
    assert.equal(seeded[0].date_key, todayKey);
  } finally {
    ctx.cleanup();
  }
});

test("AC-701: Meetings recording lifecycle, transcription, search, post-meeting chat attachment, and deletion", async () => {
  const ctx = createTestContext();
  try {
    // 1. Levels test lifecycle
    const lvlStart = await ctx.service.handleChannel("transcription:levels-test:start", { deviceId: "studio-mic" });
    assert.equal(lvlStart.success, true);
    assert.equal(lvlStart.testing, true);
    assert.equal(lvlStart.deviceId, "studio-mic");

    const lvlStop = await ctx.service.handleChannel("transcription:levels-test:stop");
    assert.equal(lvlStop.success, true);
    assert.equal(lvlStop.testing, false);

    // 2. Start, continue, and finish recording
    const startRes = await ctx.service.handleChannel("transcription:start", {
      recordingId: "mtg-q4-roadmap",
      title: "Họp Chiến lược Q4 Ổi Browser & Voice Engine"
    });
    assert.equal(startRes.success, true);
    assert.equal(startRes.status, "recording");
    assert.equal(startRes.recordingId, "mtg-q4-roadmap");

    const stateDuring = await ctx.service.handleChannel("transcription:get-session-state");
    assert.equal(stateDuring.status, "recording");
    assert.equal(stateDuring.activeRecordingId, "mtg-q4-roadmap");

    await ctx.service.handleChannel("meeting:continue-recording", {
      transcriptText: "Thảo luận tích hợp Web Speech TTS tiếng Việt và lọc lịch sử hoạt động."
    });

    const finishRes = await ctx.service.handleChannel("meeting:finish-recording", {
      durationSec: 540,
      summaryMarkdown: "### Tóm tắt Q4\n- Hoàn thiện Voice Command và Activity Memory.",
      actionItems: ["Action A: Kiểm thử Quick-Pill", "Action B: Kiểm thử Clear Activity"]
    });
    assert.equal(finishRes.success, true);
    assert.equal(finishRes.recordingId, "mtg-q4-roadmap");
    assert.equal(finishRes.meeting.title, "Họp Chiến lược Q4 Ổi Browser & Voice Engine");

    // 3. Transcribe recording updates transcript & action items
    const transRes = await ctx.service.handleChannel("audio:transcribe-recording", {
      recordingId: "mtg-q4-roadmap",
      transcriptText: "Bản bóc tách đầy đủ: Tích hợp Web Speech TTS vi-VN và Activity Observer.",
      actionItems: ["Action A: Kiểm thử Quick-Pill", "Action B: Kiểm thử Clear Activity", "Action C: Bàn giao Spec 007"]
    });
    assert.equal(transRes.success, true);
    assert.equal(transRes.actionItems.length, 3);

    // 4. Search recordings by title / transcript / summary
    const searchQ4 = await ctx.service.handleChannel("audio:search-recordings", { query: "Web Speech TTS" });
    assert.equal(searchQ4.success, true);
    assert.equal(searchQ4.meetings.length, 1);
    assert.equal(searchQ4.meetings[0].id, "mtg-q4-roadmap");
    assert.equal(searchQ4.recordings[0].id, "mtg-q4-roadmap");

    // 5. Post-meeting chat attachment (audio:attach-recording-to-chat & meeting:open-post-meeting-chat)
    const attachRes = await ctx.service.handleChannel("meeting:open-post-meeting-chat", {
      recordingId: "mtg-q4-roadmap",
      companionId: "consulting-cora"
    });
    assert.equal(attachRes.success, true);
    assert.equal(attachRes.sessionId, "session-consulting-cora");
    assert.equal(attachRes.meetingId, "mtg-q4-roadmap");
    assert.equal(attachRes.url, "/chat/session-consulting-cora");

    const coraMessages = ctx.store.listMessages("consulting-cora");
    assert.ok(coraMessages.length >= 1, "should insert post-meeting context message into chat_messages");
    const lastMsg = coraMessages[coraMessages.length - 1];
    assert.ok(lastMsg.content.includes("Họp Chiến lược Q4 Ổi Browser & Voice Engine"));
    assert.ok(lastMsg.content.includes("Tóm tắt Q4"));
    assert.ok(lastMsg.content.includes("Action C: Bàn giao Spec 007"));

    // 6. Delete recording removes it from SQLite meetings table
    const delRes = await ctx.service.handleChannel("audio:delete-recording", { recordingId: "mtg-q4-roadmap" });
    assert.equal(delRes.success, true);
    assert.equal(delRes.deletedId, "mtg-q4-roadmap");

    const afterSearch = await ctx.service.handleChannel("audio:search-recordings", { query: "Web Speech TTS" });
    assert.equal(afterSearch.meetings.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("AC-702: Activity memory status schedule, search, delete-day, delete-all, and screenshot helpers", async () => {
  const ctx = createTestContext();
  try {
    // 1. Status get & set
    const initialStatus = await ctx.service.handleChannel("gia-activity-memory:status-get");
    assert.equal(initialStatus.enabled, true);
    assert.deepEqual(initialStatus.schedule.weekdays, [1, 2, 3, 4, 5]);

    const updatedStatus = await ctx.service.handleChannel("gia-activity-memory:status-set", {
      enabled: false,
      pausedUntilMs: 1900000000000,
      schedule: { enabled: true, weekdays: [1, 3, 5], startMinute: 600, endMinute: 1020 }
    });
    assert.equal(updatedStatus.success, true);
    assert.equal(updatedStatus.enabled, false);
    assert.equal(updatedStatus.pausedUntilMs, 1900000000000);
    assert.deepEqual(updatedStatus.schedule.weekdays, [1, 3, 5]);

    const persistedStatus = await ctx.service.handleChannel("gia-activity-memory:status-get");
    assert.equal(persistedStatus.enabled, false);
    assert.deepEqual(persistedStatus.schedule.weekdays, [1, 3, 5]);

    // 2. Add a custom event on another date and search
    ctx.service.recordActivityEvent({
      id: "act-custom-day",
      dateKey: "2026-10-15",
      domain: "news.ycombinator.com",
      title: "Hacker News AI Agents Thread",
      description: "Đọc thảo luận về kiến trúc Local-First Browser Agents",
      companionId: "research-rosa"
    });

    const searchHn = await ctx.service.handleChannel("gia-activity-memory:search", { query: "ycombinator" });
    assert.equal(searchHn.success, true);
    assert.equal(searchHn.results.length, 1);
    assert.equal(searchHn.results[0].id, "act-custom-day");
    assert.equal(searchHn.sessions.length, 1);

    // 3. Delete specific day (gia-activity-memory:delete-day)
    const delDay = await ctx.service.handleChannel("gia-activity-memory:delete-day", { date: "2026-10-15" });
    assert.equal(delDay.success, true);
    assert.equal(delDay.deletedDate, "2026-10-15");
    assert.equal(delDay.deletedCount, 1);

    const searchAfterDayDel = await ctx.service.handleChannel("gia-activity-memory:search", { query: "ycombinator" });
    assert.equal(searchAfterDayDel.results.length, 0);

    // Today's seeded events still remain before delete-all
    const remainingBeforeClear = ctx.service.listActivityEvents();
    assert.ok(remainingBeforeClear.length >= 3);

    // 4. Delete all activity events (gia-activity-memory:delete-all)
    const delAll = await ctx.service.handleChannel("gia-activity-memory:delete-all");
    assert.equal(delAll.success, true);
    assert.ok(delAll.deletedCount >= 3);
    assert.equal(ctx.service.listActivityEvents().length, 0);

    // 5. Screenshot & regenerate channels
    const shotsRes = await ctx.service.handleChannel("activity-memory:get-screenshots-for-day", { date: "2026-10-29" });
    assert.deepEqual(shotsRes, { success: true, screenshots: [], regenerated: true });
    const regenRes = await ctx.service.handleChannel("activity-memory:dev-force-regenerate-day", { date: "2026-10-29" });
    assert.deepEqual(regenRes, { success: true, screenshots: [], regenerated: true });
  } finally {
    ctx.cleanup();
  }
});

test("AC-703: Voice commands, quick-pill submit, voiceCommand:openChat, TTS preview, and command history", async () => {
  const ctx = createTestContext(true);
  try {
    // 1. TTS preview & readAloud
    const ttsRes = await ctx.service.handleChannel("tts:preview-voice", {
      voice: "vi-VN-Wavenet-A",
      text: "Chào mừng bạn đến với Ổi Browser"
    });
    assert.equal(ttsRes.success, true);
    assert.equal(ttsRes.playing, true);
    assert.equal(ttsRes.voice, "vi-VN-Wavenet-A");

    const readAloudRes = await ctx.service.handleChannel("voiceCommand:readAloud", {
      text: "Đọc to tóm tắt cuộc họp"
    });
    assert.equal(readAloudRes.success, true);
    assert.equal(readAloudRes.playing, true);

    // 2. Quick-pill start/stop/submit
    const startPill = await ctx.service.handleChannel("quick-pill:start-recording");
    assert.equal(startPill.success, true);
    assert.equal(startPill.recording, true);

    const stopPill = await ctx.service.handleChannel("quick-pill:stop-recording", {
      transcript: "Lập bảng so sánh 9 trợ lý AI trái cây Việt"
    });
    assert.equal(stopPill.success, true);
    assert.equal(stopPill.recording, false);

    const submitPill = await ctx.service.handleChannel("quick-pill:submit", {
      companionId: "research-rosa",
      transcript: "Lập bảng so sánh 9 trợ lý AI trái cây Việt"
    });
    assert.equal(submitPill.success, true);
    assert.equal(submitPill.sessionId, "session-research-rosa");
    assert.equal(submitPill.url, "/chat/session-research-rosa");
    assert.ok(submitPill.response?.content.includes("Lập bảng so sánh 9 trợ lý AI trái cây Việt"));
    assert.equal(ctx.orchestrator.calls.length, 1);

    // 3. voiceCommand:openChat & voiceCommand:openUrl & voiceCommand:cancel
    const openChatRes = await ctx.service.handleChannel("voiceCommand:openChat", {
      companionId: "developer-dana",
      text: "Kiểm tra tiến độ Spec 007 trên kho mã nguồn"
    });
    assert.equal(openChatRes.success, true);
    assert.equal(openChatRes.sessionId, "session-developer-dana");
    assert.ok(openChatRes.response?.content.includes("Kiểm tra tiến độ Spec 007"));

    const openUrlRes = await ctx.service.handleChannel("voiceCommand:openUrl", {
      url: "https://oibrowser.vn/docs",
      title: "Ổi Browser Docs"
    });
    assert.equal(openUrlRes.success, true);
    assert.equal(openUrlRes.url, "https://oibrowser.vn/docs");

    const cancelRes = await ctx.service.handleChannel("voiceCommand:cancel", { transcript: "Hủy lệnh" });
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.cancelled, true);

    // Verify voice_command_history persisted all commands
    const history = ctx.service.listVoiceCommandHistory();
    assert.ok(history.length >= 7, "all voice commands should be recorded in voice_command_history");

    // Unrelated channel returns null
    const unknownRes = await ctx.service.handleChannel("unrelated:channel", {});
    assert.equal(unknownRes, null);
  } finally {
    ctx.cleanup();
  }
});

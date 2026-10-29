import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { KarpathyWikiMemoryEngine } from "../src/server/karpathy-wiki-memory-engine.js";
import { AgentDOMBrowserService } from "../src/server/agent-dom-browser-service.js";
import { CliHarnessRouter } from "../src/server/cli-harness-router.js";
import { CompanionChatOrchestrator } from "../src/server/companion-chat-orchestrator.js";
import { Spec002ChatLoopService } from "../src/server/domains/spec-002-chat-loop.js";

test("Spec 002 · Agentic Chat, Streaming Turn Control & Tool Permission Loop (AC-201 .. AC-205)", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-spec-002-"));
  const dbPath = path.join(tmpDir, "workspace.sqlite");
  const wikiDir = path.join(tmpDir, "karpathy-wiki");

  const store = new SqliteWorkspaceStore(dbPath);
  const memory = new KarpathyWikiMemoryEngine(wikiDir);
  const domService = new AgentDOMBrowserService();
  const cliRouter = new CliHarnessRouter({
    projectRoot: process.cwd(),
    wikiDir,
    skillsDir: path.join(process.cwd(), "skills")
  });
  const orchestrator = new CompanionChatOrchestrator({
    store,
    memory,
    domService,
    cliRouter
  });

  const service = new Spec002ChatLoopService({
    store,
    memory,
    domService,
    cliRouter,
    orchestrator,
    dataDir: tmpDir
  });

  t.after(() => {
    try {
      store.db.close();
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("AC-201: chat:stopGenerating cancels active CLI turn in < 100ms, transitions chatStatus to 'idle', and supports steering/continue", async () => {
    const abortController = new AbortController();
    const turn = service.startTurn("session-rosa", abortController);
    assert.equal(turn.chatStatus, "streaming");
    assert.equal(abortController.signal.aborted, false);

    const startedAt = performance.now();
    const res = await service.handleChannel("chat:stopGenerating", { sessionId: "session-rosa" });
    const elapsedMs = performance.now() - startedAt;

    assert.equal(res.success, true);
    assert.equal(res.sessionId, "session-rosa");
    assert.equal(res.chatStatus, "idle");
    assert.ok(res.stoppedAt > 0);
    assert.ok(elapsedMs < 100, `Expected stopGenerating < 100ms, got ${elapsedMs.toFixed(2)}ms`);
    assert.equal(abortController.signal.aborted, true);

    const steerRes = await service.handleChannel("chat:steer-active-turn", {
      sessionId: "session-rosa",
      guidance: "Focus on Vietnamese fruit companions table"
    });
    assert.equal(steerRes.success, true);
    assert.equal(steerRes.steered, true);
    assert.equal(steerRes.sessionId, "session-rosa");

    const contRes = await service.handleChannel("chat:continue-execution", {
      sessionId: "session-rosa"
    });
    assert.equal(contRes.success, true);
    assert.equal(contRes.steered, true);
  });

  await t.test("AC-202 & FR-202: chat:editMessage and chat:retryCompletion update SQLite chat_messages and produce fresh assistant response; tool permission gates persist allow-always rules", async () => {
    const initialMsgs = store.listMessages("research-rosa");
    assert.ok(initialMsgs.length >= 2);
    const firstUserMsg = initialMsgs.find((m) => m.sender === "user");
    assert.ok(firstUserMsg);

    const editedText = "Trích xuất bảng kiến trúc Ổi Browser từ berry://newtab (đã chỉnh sửa)";
    const editRes = await service.handleChannel("chat:editMessage", {
      companionId: "research-rosa",
      messageId: firstUserMsg.id,
      content: editedText,
      activeUrl: "berry://newtab",
      harnessId: "local"
    });

    assert.equal(editRes.success, true);
    assert.equal(editRes.messageId, firstUserMsg.id);
    assert.equal(editRes.updatedContent, editedText);
    const updatedRow = editRes.messages.find((m) => m.id === firstUserMsg.id);
    assert.ok(updatedRow);
    assert.equal(updatedRow.content, editedText);
    const latestMsg = editRes.messages[editRes.messages.length - 1];
    assert.equal(latestMsg.sender, "assistant");

    const retryRes = await service.handleChannel("chat:retryCompletion", {
      companionId: "research-rosa",
      messageId: latestMsg.id,
      activeUrl: "berry://newtab",
      harnessId: "local"
    });
    assert.equal(retryRes.success, true);
    assert.equal(retryRes.updatedContent, editedText);
    assert.ok(retryRes.messages.some((m) => m.sender === "assistant"));

    // Tool permission gate (FR-202)
    service.enqueuePendingTool({
      toolCallId: "tc-bash-01",
      sessionId: "session-rosa",
      toolName: "execute_shell",
      input: { cmd: "ls -la" }
    });

    const permRes = await service.handleChannel("chat:answerCodeToolPermission", {
      toolCallId: "tc-bash-01",
      sessionId: "session-rosa",
      toolName: "execute_shell",
      decision: "allow-always",
      scope: "workspace"
    });
    assert.equal(permRes.success, true);
    assert.equal(permRes.toolCallId, "tc-bash-01");
    assert.equal(permRes.decision, "allow-always");
    assert.ok(permRes.rules.some((r) => r.toolName === "execute_shell" && r.decision === "allow-always"));

    const listRulesRes = await service.handleChannel("chat-permissions:list-rules", {});
    assert.equal(listRulesRes.rules.length, 1);
    assert.equal(listRulesRes.rules[0].tool_name, "execute_shell");

    const denyRes = await service.handleChannel("chat:answerToolInput", {
      toolCallId: "tc-net-02",
      sessionId: "session-rosa",
      toolName: "external_post",
      decision: "deny"
    });
    assert.equal(denyRes.success, true);
    assert.equal(denyRes.decision, "deny");
    assert.equal(service.getPendingTool("tc-net-02").status, "denied");
  });

  await t.test("AC-203: Multi-part attachment staging writes file to attachments/ and context:add-attachment-from-url extracts DOM markdown", async () => {
    const beginRes = await service.handleChannel("chat:beginAttachmentStaging", {
      stagingId: "stage-test-001",
      sessionId: "session-rosa",
      filename: "leads-q4.csv",
      mimeType: "text/csv"
    });
    assert.equal(beginRes.success, true);
    assert.equal(beginRes.stagingId, "stage-test-001");
    assert.equal(beginRes.status, "staging");

    const chunk1 = Buffer.from("company,signal\nOiBrowser,High\n", "utf8").toString("base64");
    const chunk2 = Buffer.from("EaseUI,Priority\n", "utf8").toString("base64");

    await service.handleChannel("chat:appendAttachmentStagingChunk", {
      stagingId: "stage-test-001",
      chunk: chunk1,
      encoding: "base64"
    });
    const append2 = await service.handleChannel("chat:appendAttachmentStagingChunk", {
      stagingId: "stage-test-001",
      chunk: chunk2,
      encoding: "base64"
    });
    assert.equal(append2.success, true);
    assert.ok(append2.sizeBytes > 20);

    const finishRes = await service.handleChannel("chat:finishAttachmentStaging", {
      stagingId: "stage-test-001"
    });
    assert.equal(finishRes.success, true);
    assert.equal(finishRes.attachment.id, "stage-test-001");
    assert.equal(finishRes.attachment.status, "ready");
    assert.ok(fs.existsSync(finishRes.attachment.filePath));
    const diskText = fs.readFileSync(finishRes.attachment.filePath, "utf8");
    assert.equal(diskText, "company,signal\nOiBrowser,High\nEaseUI,Priority\n");
    assert.ok(finishRes.attachments.some((a) => a.id === "stage-test-001"));

    // URL Attachment
    const urlAttachRes = await service.handleChannel("context:add-attachment-from-url", {
      sessionId: "session-rosa",
      url: "berry://newtab"
    });
    assert.equal(urlAttachRes.success, true);
    assert.equal(urlAttachRes.attachment.status, "ready");
    assert.ok(fs.existsSync(urlAttachRes.attachment.filePath));
    assert.ok(fs.readFileSync(urlAttachRes.attachment.filePath, "utf8").includes("berry://newtab"));

    // Cancel staging
    await service.handleChannel("chat:beginAttachmentStaging", {
      stagingId: "stage-cancel-002",
      sessionId: "session-rosa",
      filename: "temp.txt"
    });
    const cancelRes = await service.handleChannel("chat:cancelAttachmentStaging", {
      stagingId: "stage-cancel-002"
    });
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.status, "cancelled");
  });

  await t.test("AC-204: chat:previewSystemPrompt, tokens:estimate-messages, chat:duplicate-session, chat:forceCompaction, and storage:delete-session", async () => {
    const previewRes = await service.handleChannel("chat:previewSystemPrompt", {
      companionId: "research-rosa",
      prompt: "research leads and build table"
    });
    assert.equal(previewRes.success, true);
    assert.ok(previewRes.systemPrompt.includes("PROFILE.md"));
    assert.ok(previewRes.systemPrompt.includes("COMPANION.md"));
    assert.ok(previewRes.systemPrompt.includes("<available_skills>"));
    assert.equal(previewRes.tokenEstimate, Math.ceil(previewRes.systemPrompt.length / 4));

    const tokRes = await service.handleChannel("tokens:estimate-messages", {
      messages: [
        { content: "Hello world 1234" }, // 16 chars -> 4 tokens
        { content: "Testing token estimation" } // 24 chars -> 6 tokens
      ]
    });
    assert.equal(tokRes.success, true);
    assert.equal(tokRes.tokens, 10);
    assert.equal(tokRes.messageCount, 2);

    // Duplicate session
    const dupRes = await service.handleChannel("chat:duplicate-session", {
      companionId: "research-rosa"
    });
    assert.equal(dupRes.success, true);
    assert.ok(dupRes.companionId.startsWith("research-rosa-fork-"));
    assert.equal(dupRes.newSessionId, `session-${dupRes.companionId}`);
    assert.ok(dupRes.messageCount >= 2);
    assert.equal(store.listMessages(dupRes.companionId).length, dupRes.messageCount);

    // Force compaction on forked session
    store.addMessage({
      companionId: dupRes.companionId,
      sender: "user",
      content: "Extra message before compaction"
    });
    const compactRes = await service.handleChannel("chat:forceCompaction", {
      companionId: dupRes.companionId,
      keepRecent: 1
    });
    assert.equal(compactRes.success, true);
    assert.equal(compactRes.triggeredCompaction, true);
    assert.ok(compactRes.compactedCount >= 2);
    assert.ok(compactRes.summary.includes("Karpathy-Wiki Compaction Summary"));

    // Delete forked session
    const delRes = await service.handleChannel("storage:delete-session", {
      companionId: dupRes.companionId
    });
    assert.equal(delRes.success, true);
    assert.equal(store.listMessages(dupRes.companionId).length, 0);
  });

  await t.test("AC-205: chat:findTextPage searches chat_messages case-insensitively and returns messageId, snippet, and offset", async () => {
    store.addMessage({
      companionId: "consulting-cora",
      sender: "assistant",
      content: "Báo cáo chiến lược Karpathy-Wiki cho Ổi Browser phiên bản 1.0."
    });

    const findRes = await service.handleChannel("chat:findTextPage", {
      query: "karpathy-wiki"
    });
    assert.equal(findRes.success, true);
    assert.equal(findRes.query, "karpathy-wiki");
    assert.ok(findRes.totalMatches >= 1);
    const match = findRes.matches.find((m) => m.companionId === "consulting-cora");
    assert.ok(match);
    assert.ok(match.messageId.startsWith("msg-"));
    assert.ok(match.offset >= 0);
    assert.ok(match.snippet.toLowerCase().includes("karpathy-wiki"));

    const loadMsgRes = await service.handleChannel("chat:loadFindMessage", {
      messageId: match.messageId
    });
    assert.equal(loadMsgRes.success, true);
    assert.equal(loadMsgRes.message.id, match.messageId);

    const cancelFindRes = await service.handleChannel("chat:cancelPageFind", {
      companionId: "consulting-cora"
    });
    assert.equal(cancelFindRes.success, true);
    assert.equal(cancelFindRes.totalMatches, 0);

    const unhandled = await service.handleChannel("unknown:channel", {});
    assert.equal(unhandled, null);
  });
});

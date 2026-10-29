import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { KarpathyWikiMemoryEngine } from "../src/server/karpathy-wiki-memory-engine.js";
import { AgentDOMBrowserService } from "../src/server/agent-dom-browser-service.js";
import { CliHarnessRouter } from "../src/server/cli-harness-router.js";
import { WikiFtsIndex } from "../src/server/wiki-fts-index.js";
import { CompanionChatOrchestrator } from "../src/server/companion-chat-orchestrator.js";
import { RoutineCronDaemon, matchesCronExpression, normalizeCronExpression } from "../src/server/routine-cron-daemon.js";
import { Spec005RoutinesCronService } from "../src/server/domains/spec-005-routines-cron.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

function createTestHarness() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-spec-005-"));
  const wikiDir = path.join(tmpDir, "karpathy-wiki");
  const store = new SqliteWorkspaceStore(path.join(tmpDir, "workspace.sqlite"));
  const memory = new KarpathyWikiMemoryEngine(wikiDir);
  const wikiFts = new WikiFtsIndex({ db: store.db, memory });
  const domService = new AgentDOMBrowserService();
  const cliRouter = new CliHarnessRouter({
    projectRoot: PROJECT_ROOT,
    wikiDir,
    skillsDir: path.join(PROJECT_ROOT, "skills")
  });
  cliRouter.setActiveHarness("local");
  const orchestrator = new CompanionChatOrchestrator({
    store,
    memory,
    domService,
    cliRouter,
    wikiFts
  });
  const service = new Spec005RoutinesCronService({ store, orchestrator });

  return {
    tmpDir,
    store,
    orchestrator,
    service,
    daemon: service.daemon,
    cleanup() {
      service.daemon.stop();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
}

test("Spec 005 — Autonomous Routines, One-Off Schedules & Cron Daemon (AC-501 .. AC-503)", async (t) => {
  const ctx = createTestHarness();
  t.after(() => ctx.cleanup());

  await t.test("AC-501a: matchesCronExpression supports 5-field cron (*, */n, lists, ranges) and human labels", () => {
    const thu0830 = new Date(2026, 9, 29, 8, 30, 0); // Thursday Oct 29, 2026 08:30 local
    const thu0900 = new Date(2026, 9, 29, 9, 0, 0);  // Thursday Oct 29, 2026 09:00 local
    const sun0830 = new Date(2026, 10, 1, 8, 30, 0); // Sunday Nov 1, 2026 08:30 local
    const sun1800 = new Date(2026, 10, 1, 18, 0, 0); // Sunday Nov 1, 2026 18:00 local

    assert.equal(normalizeCronExpression("Every morning · 08:30"), "30 8 * * *");
    assert.equal(normalizeCronExpression("Every weekday · 09:00"), "0 9 * * 1-5");
    assert.equal(normalizeCronExpression("Every weekday morning · 08:30"), "30 8 * * 1-5");
    assert.equal(normalizeCronExpression("Once a week · Sunday 18:00"), "0 18 * * 0");

    assert.equal(matchesCronExpression("30 8 * * 1-5", thu0830), true);
    assert.equal(matchesCronExpression("30 8 * * 1-5", sun0830), false);
    assert.equal(matchesCronExpression("Every morning · 08:30", sun0830), true);
    assert.equal(matchesCronExpression("Every weekday · 09:00", thu0900), true);
    assert.equal(matchesCronExpression("*/15 8-10 * * 1,3,4", thu0830), true);
    assert.equal(matchesCronExpression("0 18 * * 0", sun1800), true);
    assert.equal(matchesCronExpression("0 18 * * 7", sun1800), true);
  });

  await t.test("AC-501b: RoutineCronDaemon.tickNow() executes due routines, writes routine_runs, and updates routines:listRuns", async () => {
    const thu0830Ms = new Date(2026, 9, 29, 8, 30, 0).getTime();
    const tickRes = await ctx.daemon.tickNow(thu0830Ms);

    assert.ok(tickRes.executedCount >= 1);
    assert.ok(tickRes.runs.some((r) => r.routine_id === "manage-inbox" && r.status === "completed"));

    const updatedRoutine = ctx.store.listRoutines().find((r) => r.id === "manage-inbox");
    assert.ok(updatedRoutine.last_run_at >= thu0830Ms);
    assert.ok(updatedRoutine.last_result && updatedRoutine.last_result.length > 0);

    const listRunsRes = await ctx.service.handleChannel("routines:listRuns", { routineId: "manage-inbox" });
    assert.equal(listRunsRes.success, true);
    assert.ok(listRunsRes.runs.length >= 1);
    assert.equal(listRunsRes.runs[0].routineId, "manage-inbox");
    assert.equal(listRunsRes.runs[0].status, "completed");
    assert.equal(listRunsRes.runs[0].outcome, "completed");
    assert.equal(listRunsRes.runs[0].sessionId, "session-executive-ellis");

    ctx.daemon.start(120000);
    assert.ok(ctx.daemon.timer !== null);
    ctx.daemon.stop();
    assert.equal(ctx.daemon.timer, null);
  });

  await t.test("AC-502a: Routine CRUD channels (routines:create, routines:update, routines:runNow, routines:delete)", async () => {
    const created = await ctx.service.handleChannel("routines:create", {
      label: "Kiểm định bảo mật hàng sáng",
      schedule: "15 10 * * 1-5",
      companionId: "developer-dana",
      prompt: "Kiểm tra DOM và bảo mật trên berry://newtab"
    });
    assert.equal(created.success, true);
    assert.ok(created.routine.id.startsWith("routine-"));
    const routineId = created.routine.id;

    const updated = await ctx.service.handleChannel("routines:update", {
      id: routineId,
      label: "Kiểm định bảo mật & DOM nâng cao",
      schedule: "45 10 * * 1-5"
    });
    assert.equal(updated.success, true);
    assert.equal(updated.routine.label, "Kiểm định bảo mật & DOM nâng cao");
    assert.equal(updated.routine.schedule, "45 10 * * 1-5");

    const ran = await ctx.service.handleChannel("routines:runNow", { routineId });
    assert.equal(ran.success, true);
    assert.equal(ran.run.routine_id, routineId);
    assert.equal(ran.run.status, "completed");

    const deleted = await ctx.service.handleChannel("routines:delete", { routineId });
    assert.equal(deleted.success, true);
    assert.ok(!deleted.routines.some((r) => r.id === routineId));
  });

  await t.test("AC-502b: One-Off task lifecycle (createOneOff, updateOneOff, runOneOffNow, tickNow due execution, deleteOneOff)", async () => {
    const dueTime = Date.now() - 5000;
    const createRes = await ctx.service.handleChannel("routines:createOneOff", {
      label: "Gửi báo cáo tổng hợp khách hàng chiều nay",
      companionId: "sales-sally",
      prompt: "Tổng hợp danh sách khách hàng từ berry://newtab",
      scheduledAt: dueTime,
      timezone: "Asia/Ho_Chi_Minh"
    });
    assert.equal(createRes.success, true);
    assert.ok(createRes.oneOff.id.startsWith("oneoff-"));
    assert.equal(createRes.oneOff.status, "scheduled");
    const oneOffId = createRes.oneOff.id;

    const updateRes = await ctx.service.handleChannel("routines:updateOneOff", {
      id: oneOffId,
      label: "Gửi báo cáo Outbound VIP chiều nay"
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.oneOff.label, "Gửi báo cáo Outbound VIP chiều nay");

    const runRes = await ctx.service.handleChannel("routines:runOneOffNow", { id: oneOffId });
    assert.equal(runRes.success, true);
    assert.equal(runRes.oneOff.status, "completed");
    assert.ok(runRes.oneOff.last_run_at > 0);
    assert.equal(runRes.run.kind, "one-off");

    const secondOneOff = await ctx.service.handleChannel("routines:createOneOff", {
      label: "Tác vụ một lần đến hạn cho Daemon",
      companionId: "research-rosa",
      prompt: "Trích xuất thông tin trang hiện tại",
      scheduledAt: Date.now() - 1000
    });
    const tickDueRes = await ctx.daemon.tickNow(Date.now());
    assert.ok(tickDueRes.runs.some((r) => r.routine_id === secondOneOff.oneOff.id && r.kind === "one-off"));

    const delRes = await ctx.service.handleChannel("routines:deleteOneOff", { id: oneOffId });
    assert.equal(delRes.success, true);
    assert.ok(!delRes.oneOffs.some((o) => o.id === oneOffId));
  });

  await t.test("AC-503: routines:listAvailableTriggers, setSubscription, resolveSuggestion, refresh, and takeOver", async () => {
    const triggersRes = await ctx.service.handleChannel("routines:listAvailableTriggers");
    assert.equal(triggersRes.success, true);
    const triggerIds = triggersRes.triggers.map((tr) => tr.id);
    assert.ok(triggerIds.includes("cron"));
    assert.ok(triggerIds.includes("github:pull_request"));
    assert.ok(triggerIds.includes("gmail:new_email"));
    assert.ok(triggerIds.includes("linkedin:lead_signal"));
    assert.ok(triggerIds.includes("notion:page_updated"));
    assert.ok(!triggerIds.includes("slack:channel_message"));

    ctx.store.toggleIntegration("slack", true);
    const updatedTriggersRes = await ctx.service.handleChannel("routines:listAvailableTriggers");
    assert.ok(updatedTriggersRes.triggers.some((tr) => tr.id === "slack:channel_message"));

    const subRes = await ctx.service.handleChannel("routines:setSubscription", {
      routineId: "morning-priorities",
      subscribed: false,
      triggerId: "gmail:new_email"
    });
    assert.equal(subRes.success, true);
    assert.equal(subRes.subscription.subscribed, false);
    assert.equal(subRes.subscription.triggerId, "gmail:new_email");

    const sugRes = await ctx.service.handleChannel("routines:resolveSuggestion", {
      suggestionId: "custom-suggestion-1",
      action: "accept",
      label: "Đồng bộ ghi chú Wiki cuối ngày",
      schedule: "0 17 * * 1-5",
      companionId: "consulting-cora"
    });
    assert.equal(sugRes.success, true);
    assert.equal(sugRes.resolution, "accepted");
    assert.ok(sugRes.routine.id);

    const refreshRes = await ctx.service.handleChannel("routines:refresh");
    assert.equal(refreshRes.success, true);
    assert.ok(Array.isArray(refreshRes.routines));
    assert.ok(Array.isArray(refreshRes.oneOffs));
    assert.ok(Array.isArray(refreshRes.runs));

    const takeOverRes = await ctx.service.handleChannel("routines:takeOver", {
      routineId: "morning-priorities"
    });
    assert.equal(takeOverRes.success, true);
    assert.equal(takeOverRes.companionId, "executive-ellis");
    assert.equal(takeOverRes.url, "/chat/session-executive-ellis");

    const unknownRes = await ctx.service.handleChannel("nonexistent:channel", {});
    assert.equal(unknownRes, null);
  });
});

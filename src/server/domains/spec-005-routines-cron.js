import crypto from "node:crypto";
import { RoutineCronDaemon, matchesCronExpression, normalizeCronExpression } from "../routine-cron-daemon.js";
import { OFFICIAL_ROUTINE_TEMPLATES } from "../official-companions-catalog.js";

const INTEGRATION_TRIGGER_CATALOG = {
  github: {
    id: "github:pull_request",
    triggerId: "github:pull_request",
    type: "webhook",
    provider: "github",
    integrationId: "github",
    name: "GitHub Pull Request & Issue Event",
    description: "Trigger routine when a pull request or issue is opened, reviewed, or merged"
  },
  gmail: {
    id: "gmail:new_email",
    triggerId: "gmail:new_email",
    type: "webhook",
    provider: "gmail",
    integrationId: "gmail",
    name: "Google Workspace New Priority Email",
    description: "Trigger routine when a priority email arrives in Gmail inbox"
  },
  linkedin: {
    id: "linkedin:lead_signal",
    triggerId: "linkedin:lead_signal",
    type: "webhook",
    provider: "linkedin",
    integrationId: "linkedin",
    name: "LinkedIn Sales & Recruiting Signal",
    description: "Trigger routine on new Sales Navigator or Recruiter Lite prospect activity"
  },
  notion: {
    id: "notion:page_updated",
    triggerId: "notion:page_updated",
    type: "webhook",
    provider: "notion",
    integrationId: "notion",
    name: "Notion Karpathy-Wiki Page Updated",
    description: "Trigger routine when a synced Notion wiki page or database row changes"
  },
  slack: {
    id: "slack:channel_message",
    triggerId: "slack:channel_message",
    type: "webhook",
    provider: "slack",
    integrationId: "slack",
    name: "Slack Team Channel Mention",
    description: "Trigger routine when a team channel message or mention is posted"
  }
};

function parseTimestampMs(input, fallbackMs) {
  if (input === undefined || input === null || input === "") return fallbackMs;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const asNum = Number(input);
  if (Number.isFinite(asNum) && String(input).trim() !== "") return asNum;
  const parsed = Date.parse(String(input));
  return Number.isNaN(parsed) ? fallbackMs : parsed;
}

function formatOneOffRow(row) {
  if (!row) return null;
  return {
    ...row,
    name: row.label,
    companionId: row.companion_id,
    scheduledAt: row.scheduled_at,
    scheduledAtIso: new Date(row.scheduled_at).toISOString(),
    lastRunAt: row.last_run_at,
    lastResult: row.last_result,
    createdAt: row.created_at
  };
}

function formatRunRow(row) {
  if (!row) return null;
  return {
    ...row,
    routineId: row.routine_id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    acceptedAt: new Date(row.started_at).toISOString(),
    finishedAt: new Date(row.finished_at).toISOString()
  };
}

export class Spec005RoutinesCronService {
  constructor({ store, orchestrator } = {}) {
    this.store = store;
    this.orchestrator = orchestrator;
    this.initSchema();
    this.daemon = new RoutineCronDaemon({
      store: this.store,
      orchestrator: this.orchestrator,
      service: this
    });
  }

  initSchema() {
    if (!this.store?.db) return;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS routine_runs (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL,
        kind TEXT DEFAULT 'cron',
        status TEXT NOT NULL,
        outcome TEXT NOT NULL,
        summary TEXT DEFAULT '',
        session_id TEXT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_one_offs (
        id TEXT PRIMARY KEY,
        emoji TEXT DEFAULT '⏰',
        label TEXT NOT NULL,
        companion_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        scheduled_at INTEGER NOT NULL,
        timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
        status TEXT DEFAULT 'scheduled',
        last_run_at INTEGER,
        last_result TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_subscriptions (
        routine_id TEXT PRIMARY KEY,
        subscribed INTEGER DEFAULT 1,
        trigger_id TEXT DEFAULT 'cron',
        updated_at INTEGER NOT NULL
      );
    `);
  }

  listOneOffs() {
    this.initSchema();
    const rows = this.store.db.prepare("SELECT * FROM routine_one_offs ORDER BY scheduled_at ASC, created_at ASC").all();
    return rows.map(formatOneOffRow);
  }

  getOneOff(id) {
    this.initSchema();
    const row = this.store.db.prepare("SELECT * FROM routine_one_offs WHERE id = ?").get(id);
    return formatOneOffRow(row);
  }

  createRoutine(payload = {}) {
    this.initSchema();
    const label = payload.label || payload.name || payload.title || "Autonomous Routine";
    const schedule = payload.schedule || payload.expression || payload.trigger?.expression || "30 8 * * 1-5";
    const companionId = payload.companionId || payload.companion_id || payload.companion?.id || "research-rosa";
    const prompt = payload.prompt || "";
    const emoji = payload.emoji ?? "";

    const created = this.store.createRoutine({
      emoji,
      label,
      schedule,
      companionId,
      prompt
    });

    if (payload.enabled === false) {
      this.store.toggleRoutine(created.id, false);
    }

    const triggerId = payload.triggerId || payload.trigger_id || payload.trigger?.id || "cron";
    const subscribed = payload.enabled === false ? 0 : 1;
    this.store.db.prepare(`
      INSERT OR REPLACE INTO routine_subscriptions (routine_id, subscribed, trigger_id, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(created.id, subscribed, triggerId, Date.now());

    const routine = this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(created.id);
    return {
      success: true,
      ok: true,
      routine: { ...routine, normalizedCron: normalizeCronExpression(routine.schedule) },
      routines: this.store.listRoutines()
    };
  }

  updateRoutine(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.routineId;
    const cur = this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(id);
    if (!cur) {
      return { success: false, ok: false, error: "Routine not found" };
    }

    const emoji = payload.emoji !== undefined ? payload.emoji : cur.emoji;
    const label = payload.label ?? payload.name ?? cur.label;
    const schedule = payload.schedule ?? payload.expression ?? payload.trigger?.expression ?? cur.schedule;
    const companionId = payload.companionId ?? payload.companion_id ?? payload.companion?.id ?? cur.companion_id;
    const prompt = payload.prompt !== undefined ? payload.prompt : cur.prompt;
    const enabled = payload.enabled !== undefined ? (payload.enabled ? 1 : 0) : cur.enabled;

    this.store.db.prepare(`
      UPDATE routines
      SET emoji = ?, label = ?, schedule = ?, companion_id = ?, prompt = ?, enabled = ?
      WHERE id = ?
    `).run(emoji, label, schedule, companionId, prompt, enabled, id);

    if (payload.enabled !== undefined || payload.triggerId || payload.trigger_id) {
      const existingSub = this.store.db.prepare("SELECT * FROM routine_subscriptions WHERE routine_id = ?").get(id);
      const nextTrigger = payload.triggerId || payload.trigger_id || existingSub?.trigger_id || "cron";
      this.store.db.prepare(`
        INSERT OR REPLACE INTO routine_subscriptions (routine_id, subscribed, trigger_id, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(id, enabled, nextTrigger, Date.now());
    }

    const routine = this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(id);
    return {
      success: true,
      ok: true,
      routine,
      routines: this.store.listRoutines()
    };
  }

  deleteRoutine(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.routineId;
    this.store.db.prepare("DELETE FROM routine_subscriptions WHERE routine_id = ?").run(id);
    const routines = this.store.deleteRoutine(id);
    return {
      success: true,
      ok: true,
      deletedId: id,
      routines
    };
  }

  async runNow(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.routineId;
    const routine =
      this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(id) ||
      this.store.db.prepare("SELECT * FROM routines ORDER BY rowid ASC LIMIT 1").get();

    if (!routine) {
      return { success: false, ok: false, error: "Routine not found" };
    }

    const run = await this.daemon.executeRoutine(routine, payload.timestampMs || Date.now(), "cron");
    const updatedRoutine = this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(routine.id);

    return {
      success: true,
      ok: true,
      run,
      routine: updatedRoutine,
      routines: this.store.listRoutines(),
      runs: this.listRuns({ routineId: routine.id }).runs
    };
  }

  listRuns(payload = {}) {
    this.initSchema();
    const routineId = payload.routineId || payload.id || null;
    const limit = Math.max(1, Math.min(200, Number(payload.limit) || 50));

    const rows = routineId
      ? this.store.db.prepare("SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?").all(routineId, limit)
      : this.store.db.prepare("SELECT * FROM routine_runs ORDER BY started_at DESC, rowid DESC LIMIT ?").all(limit);

    return {
      success: true,
      ok: true,
      runs: rows.map(formatRunRow),
      nextCursor: null
    };
  }

  createOneOff(payload = {}) {
    this.initSchema();
    const now = Date.now();
    const id = payload.id || `oneoff-${crypto.randomUUID().slice(0, 8)}`;
    const emoji = payload.emoji || "⏰";
    const label = payload.label || payload.name || payload.title || "One-Off Scheduled Task";
    const companionId = payload.companionId || payload.companion_id || payload.companion?.id || "research-rosa";
    const prompt = payload.prompt || "";
    const scheduledAt = parseTimestampMs(
      payload.scheduledAt ?? payload.scheduled_at ?? payload.runAt,
      now + 3600000
    );
    const timezone = payload.timezone || "Asia/Ho_Chi_Minh";

    this.store.db.prepare(`
      INSERT OR REPLACE INTO routine_one_offs (
        id, emoji, label, companion_id, prompt, scheduled_at, timezone, status, last_run_at, last_result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, NULL, ?)
    `).run(id, emoji, label, companionId, prompt, scheduledAt, timezone, now);

    const oneOff = this.getOneOff(id);
    return {
      success: true,
      ok: true,
      oneOff,
      oneOffs: this.listOneOffs()
    };
  }

  updateOneOff(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.oneOffId || payload.routineId;
    const cur = this.store.db.prepare("SELECT * FROM routine_one_offs WHERE id = ?").get(id);
    if (!cur) {
      return { success: false, ok: false, error: "One-off task not found" };
    }

    const emoji = payload.emoji ?? cur.emoji;
    const label = payload.label ?? payload.name ?? cur.label;
    const companionId = payload.companionId ?? payload.companion_id ?? cur.companion_id;
    const prompt = payload.prompt ?? cur.prompt;
    const scheduledAt = parseTimestampMs(
      payload.scheduledAt ?? payload.scheduled_at ?? payload.runAt,
      cur.scheduled_at
    );
    const timezone = payload.timezone ?? cur.timezone;
    const status = payload.status ?? cur.status;

    this.store.db.prepare(`
      UPDATE routine_one_offs
      SET emoji = ?, label = ?, companion_id = ?, prompt = ?, scheduled_at = ?, timezone = ?, status = ?
      WHERE id = ?
    `).run(emoji, label, companionId, prompt, scheduledAt, timezone, status, id);

    const oneOff = this.getOneOff(id);
    return {
      success: true,
      ok: true,
      oneOff,
      oneOffs: this.listOneOffs()
    };
  }

  deleteOneOff(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.oneOffId || payload.routineId;
    this.store.db.prepare("DELETE FROM routine_one_offs WHERE id = ?").run(id);
    return {
      success: true,
      ok: true,
      deletedId: id,
      oneOffs: this.listOneOffs()
    };
  }

  async runOneOffNow(payload = {}) {
    this.initSchema();
    const id = payload.id || payload.oneOffId || payload.routineId;
    const oneOff = this.store.db.prepare("SELECT * FROM routine_one_offs WHERE id = ?").get(id);
    if (!oneOff) {
      return { success: false, ok: false, error: "One-off task not found" };
    }

    const run = await this.daemon.executeRoutine(oneOff, payload.timestampMs || Date.now(), "one-off");
    const updatedOneOff = this.getOneOff(id);

    return {
      success: true,
      ok: true,
      run,
      oneOff: updatedOneOff,
      oneOffs: this.listOneOffs(),
      runs: this.listRuns({ routineId: id }).runs
    };
  }

  setSubscription(payload = {}) {
    this.initSchema();
    const routineId = payload.routineId || payload.id;
    const rawSub = payload.subscribed ?? payload.enabled ?? payload.isEnabled ?? true;
    const subscribed = rawSub ? 1 : 0;
    const triggerId = payload.triggerId || payload.trigger_id || "cron";
    const updatedAt = Date.now();

    this.store.db.prepare(`
      INSERT OR REPLACE INTO routine_subscriptions (routine_id, subscribed, trigger_id, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(routineId, subscribed, triggerId, updatedAt);

    this.store.db.prepare("UPDATE routines SET enabled = ? WHERE id = ?").run(subscribed, routineId);

    return {
      success: true,
      ok: true,
      subscription: {
        routine_id: routineId,
        routineId,
        subscribed: Boolean(subscribed),
        isEnabled: Boolean(subscribed),
        trigger_id: triggerId,
        triggerId,
        updated_at: updatedAt,
        updatedAt
      },
      routines: this.store.listRoutines()
    };
  }

  listAvailableTriggers() {
    this.initSchema();
    const connectedIntegrations = (this.store.listIntegrations() || []).filter((i) => i.isConnected);
    const triggers = [
      {
        id: "cron",
        triggerId: "cron",
        type: "cron",
        provider: "system",
        integrationId: "cron",
        name: "Scheduled Cron Timer",
        description: "Execute routine on a deterministic 5-field cron schedule",
        toolSlugs: ["cron_schedule"],
        isConnected: true
      }
    ];

    for (const integration of connectedIntegrations) {
      const preset = INTEGRATION_TRIGGER_CATALOG[integration.id];
      if (preset) {
        triggers.push({
          ...preset,
          toolSlugs: integration.toolSlugs || [],
          isConnected: true
        });
      } else {
        triggers.push({
          id: `${integration.id}:event`,
          triggerId: `${integration.id}:event`,
          type: "webhook",
          provider: integration.id,
          integrationId: integration.id,
          name: `${integration.name} Signal`,
          description: `Trigger routine on events from ${integration.name}`,
          toolSlugs: integration.toolSlugs || [],
          isConnected: true
        });
      }
    }

    return {
      success: true,
      ok: true,
      triggers
    };
  }

  resolveSuggestion(payload = {}) {
    this.initSchema();
    const suggestionId = payload.suggestionId || payload.id || "suggested-routine";
    const action = payload.action || (payload.dismiss || payload.accepted === false ? "dismiss" : "accept");

    if (action === "dismiss" || action === "reject") {
      return {
        success: true,
        ok: true,
        suggestionId,
        resolution: "dismissed",
        routines: this.store.listRoutines()
      };
    }

    const template = OFFICIAL_ROUTINE_TEMPLATES.find((t) => t.id === suggestionId);
    const createdRes = this.createRoutine({
      emoji: payload.emoji || template?.emoji || "",
      label: payload.label || payload.name || template?.label || `Suggested Routine (${suggestionId})`,
      schedule: payload.schedule || template?.scheduleCron || template?.schedule || "0 9 * * 1-5",
      companionId: payload.companionId || payload.companion_id || template?.companionId || "executive-ellis",
      prompt: payload.prompt || template?.prompt || "Tổng hợp ưu tiên công việc trong Ổi Browser."
    });

    return {
      success: true,
      ok: true,
      suggestionId,
      resolution: "accepted",
      routine: createdRes.routine,
      routines: createdRes.routines
    };
  }

  async refresh(payload = {}) {
    this.initSchema();
    if (payload.tick) {
      await this.daemon.tickNow(payload.timestampMs);
    }
    return {
      success: true,
      ok: true,
      status: "ready",
      routines: this.store.listRoutines(),
      oneOffs: this.listOneOffs(),
      runs: this.listRuns().runs,
      triggers: this.listAvailableTriggers().triggers
    };
  }

  takeOver(payload = {}) {
    this.initSchema();
    const targetId = payload.routineId || payload.id || payload.oneOffId;
    const routine = targetId
      ? this.store.db.prepare("SELECT * FROM routines WHERE id = ?").get(targetId) ||
        this.store.db.prepare("SELECT * FROM routine_one_offs WHERE id = ?").get(targetId)
      : null;

    const companionId =
      payload.companionId ||
      payload.companion_id ||
      routine?.companion_id ||
      "research-rosa";
    const sessionId = `session-${companionId}`;
    const chatUrl = `/chat/${sessionId}`;
    const berryUrl = `berry://chat/${sessionId}`;

    return {
      success: true,
      ok: true,
      routineId: routine?.id || targetId || null,
      companionId,
      sessionId,
      url: chatUrl,
      chatUrl,
      berryUrl
    };
  }

  async tickNow(timestampMs) {
    return this.daemon.tickNow(timestampMs);
  }

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      case "routines:create":
        return this.createRoutine(payload);
      case "routines:update":
        return this.updateRoutine(payload);
      case "routines:delete":
        return this.deleteRoutine(payload);
      case "routines:runNow":
        return this.runNow(payload);
      case "routines:listRuns":
        return this.listRuns(payload);
      case "routines:createOneOff":
        return this.createOneOff(payload);
      case "routines:updateOneOff":
        return this.updateOneOff(payload);
      case "routines:deleteOneOff":
        return this.deleteOneOff(payload);
      case "routines:runOneOffNow":
        return this.runOneOffNow(payload);
      case "routines:setSubscription":
        return this.setSubscription(payload);
      case "routines:listAvailableTriggers":
        return this.listAvailableTriggers(payload);
      case "routines:resolveSuggestion":
        return this.resolveSuggestion(payload);
      case "routines:refresh":
        return this.refresh(payload);
      case "routines:takeOver":
        return this.takeOver(payload);
      default:
        return null;
    }
  }
}

export { RoutineCronDaemon, matchesCronExpression, normalizeCronExpression };

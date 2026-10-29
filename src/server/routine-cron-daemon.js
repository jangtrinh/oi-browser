import crypto from "node:crypto";

const DAY_NAME_MAP = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

export function normalizeCronExpression(cronExpr) {
  const raw = String(cronExpr || "").trim();
  if (!raw) return "* * * * *";

  const tokens = raw.split(/\s+/);
  if (tokens.length === 5 && tokens.every((t) => /^[\d*,/-]+$/.test(t))) {
    return tokens.join(" ");
  }

  const lower = raw.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Math.min(23, Math.max(0, Number(timeMatch[1]))) : 9;
  const minute = timeMatch ? Math.min(59, Math.max(0, Number(timeMatch[2]))) : 0;

  let dow = "*";
  if (lower.includes("weekday") || lower.includes("mon-fri")) {
    dow = "1-5";
  } else if (lower.includes("weekend")) {
    dow = "0,6";
  } else {
    const matchedDays = [];
    for (const [name, idx] of Object.entries(DAY_NAME_MAP)) {
      const re = new RegExp(`\\b${name}\\b`, "i");
      if (re.test(lower) && !matchedDays.includes(idx)) {
        matchedDays.push(idx);
      }
    }
    if (matchedDays.length > 0) {
      dow = matchedDays.sort((a, b) => a - b).join(",");
    }
  }

  return `${minute} ${hour} * * ${dow}`;
}

function parseValueToken(token, isDayOfWeek = false) {
  const clean = String(token || "").trim().toLowerCase();
  if (isDayOfWeek && clean in DAY_NAME_MAP) return DAY_NAME_MAP[clean];
  const n = Number(clean);
  if (!Number.isInteger(n)) return NaN;
  if (isDayOfWeek && n === 7) return 0;
  return n;
}

function matchSingleCronPart(part, value, min, max, isDayOfWeek = false) {
  if (part === "*") return true;

  if (part.includes("/")) {
    const [rangePart, stepStr] = part.split("/");
    const step = Number(stepStr);
    if (!Number.isInteger(step) || step <= 0) return false;

    if (rangePart === "*") {
      return (value - min) % step === 0;
    }
    if (rangePart.includes("-")) {
      const [startStr, endStr] = rangePart.split("-");
      const start = parseValueToken(startStr, isDayOfWeek);
      const end = parseValueToken(endStr, isDayOfWeek);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    const start = parseValueToken(rangePart, isDayOfWeek);
    if (Number.isNaN(start)) return false;
    return value >= start && value <= max && (value - start) % step === 0;
  }

  if (part.includes("-")) {
    const [startStr, endStr] = part.split("-");
    const start = Number(startStr);
    const end = Number(endStr);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    if (isDayOfWeek && value === 0 && end === 7) {
      return start <= 7;
    }
    return value >= start && value <= end;
  }

  const num = parseValueToken(part, isDayOfWeek);
  if (Number.isNaN(num)) return false;
  return num === value;
}

function matchCronField(fieldExpr, value, min, max, isDayOfWeek = false) {
  const parts = String(fieldExpr || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.some((part) => matchSingleCronPart(part, value, min, max, isDayOfWeek));
}

export function matchesCronExpression(cronExpr, dateOrMs = Date.now()) {
  if (!cronExpr || typeof cronExpr !== "string") return false;
  const date = dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs);
  if (Number.isNaN(date.getTime())) return false;

  const normalized = normalizeCronExpression(cronExpr);
  const fields = normalized.split(/\s+/);
  if (fields.length !== 5) return false;

  const [minField, hourField, domField, monthField, dowField] = fields;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    matchCronField(minField, minute, 0, 59, false) &&
    matchCronField(hourField, hour, 0, 23, false) &&
    matchCronField(domField, dayOfMonth, 1, 31, false) &&
    matchCronField(monthField, month, 1, 12, false) &&
    matchCronField(dowField, dayOfWeek, 0, 6, true)
  );
}

export class RoutineCronDaemon {
  constructor({ store, orchestrator, service = null, intervalMs = 60000 } = {}) {
    this.store = store;
    this.orchestrator = orchestrator;
    this.service = service;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.ensureSchema();
  }

  ensureSchema() {
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

  async executeRoutine(routine, timestampMs = Date.now(), kindOverride = null) {
    this.ensureSchema();
    const startedAt = Number(timestampMs) || Date.now();
    const routineId = routine.id || routine.routine_id;
    const companionId = routine.companion_id || routine.companionId || "research-rosa";
    const label = routine.label || routine.name || routineId;
    const prompt = routine.prompt || "";
    const kind = kindOverride || routine.kind || (routine.scheduled_at !== undefined ? "one-off" : "cron");
    const sessionId = `session-${companionId}`;

    let summary = "";
    let status = "completed";
    let outcome = "completed";

    try {
      if (this.orchestrator && typeof this.orchestrator.handleUserTurn === "function") {
        const turn = await this.orchestrator.handleUserTurn({
          companionId,
          message: `[Routine: ${label}] ${prompt}`
        });
        summary = turn?.assistantMessage?.content || `Completed routine "${label}"`;
      } else {
        summary = `[Routine: ${label}] Executed prompt for ${companionId}: ${prompt}`;
      }
    } catch (err) {
      status = "failed";
      outcome = "failed";
      summary = err?.message || "Routine execution failed";
    }

    const finishedAt = Math.max(startedAt + 1, Date.now());
    const runId = `run-${routineId}-${crypto.randomUUID().slice(0, 8)}`;

    if (this.store?.db) {
      this.store.db.prepare(`
        INSERT INTO routine_runs (id, routine_id, kind, status, outcome, summary, session_id, started_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(runId, routineId, kind, status, outcome, summary, sessionId, startedAt, finishedAt);

      if (kind === "one-off") {
        this.store.db.prepare(`
          UPDATE routine_one_offs
          SET status = ?, last_run_at = ?, last_result = ?
          WHERE id = ?
        `).run(status, finishedAt, summary, routineId);
      }

      this.store.db.prepare(`
        UPDATE routines
        SET last_run_at = ?, last_result = ?
        WHERE id = ?
      `).run(finishedAt, summary, routineId);
    }

    return {
      id: runId,
      routine_id: routineId,
      routineId,
      kind,
      status,
      outcome,
      summary,
      session_id: sessionId,
      sessionId,
      started_at: startedAt,
      finished_at: finishedAt,
      acceptedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString()
    };
  }

  async tickNow(timestampMs) {
    this.ensureSchema();
    const explicitTimestamp = timestampMs !== undefined;
    const nowMs = explicitTimestamp ? (timestampMs instanceof Date ? timestampMs.getTime() : Number(timestampMs)) : Date.now();
    const runs = [];

    if (!this.store?.db) return { timestampMs: nowMs, runs };

    const routines = this.store.db.prepare("SELECT * FROM routines WHERE enabled = 1 ORDER BY rowid ASC").all();
    const subRows = this.store.db.prepare("SELECT routine_id, subscribed FROM routine_subscriptions").all();
    const subMap = new Map(subRows.map((s) => [s.routine_id, Boolean(s.subscribed)]));

    for (const routine of routines) {
      if (subMap.has(routine.id) && !subMap.get(routine.id)) continue;
      const expr = routine.schedule_cron || routine.scheduleCron || routine.schedule;
      if (matchesCronExpression(expr, nowMs)) {
        const run = await this.executeRoutine(routine, nowMs, "cron");
        runs.push(run);
      }
    }

    const dueOneOffs = this.store.db.prepare(`
      SELECT * FROM routine_one_offs
      WHERE status = 'scheduled' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `).all(nowMs);

    for (const oneOff of dueOneOffs) {
      const run = await this.executeRoutine(oneOff, nowMs, "one-off");
      runs.push(run);
    }

    if (!explicitTimestamp && runs.length === 0) {
      const unrunRoutine = routines.find((r) => !r.last_run_at && (!subMap.has(r.id) || subMap.get(r.id)));
      if (unrunRoutine) {
        const run = await this.executeRoutine(unrunRoutine, nowMs, "cron");
        runs.push(run);
      }
    }

    return {
      timestampMs: nowMs,
      executedCount: runs.length,
      runs
    };
  }

  start(intervalMs = this.intervalMs) {
    this.stop();
    this.intervalMs = intervalMs;
    this.timer = setInterval(() => {
      this.tickNow().catch(() => {});
    }, this.intervalMs);
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }
    return this;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this;
  }
}

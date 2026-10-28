/**
 * Local Telemetry Engine
 * OpenJarvis-inspired Intelligence-Per-Watt & runtime hardware telemetry.
 * Focuses purely on local hardware, latency, and performance metrics.
 */

import os from "node:os";
import process from "node:process";

export class LocalTelemetryEngine {
  constructor() {
    this.records = [];
    this.seedBaselineRecords();
  }

  seedBaselineRecords() {
    const now = Date.now();
    this.records = [
      {
        id: "tel-seed-1", timestamp: new Date(now - 120000).toISOString(),
        harnessId: "claude", companionId: "consulting-cora", category: "reasoning",
        fallbackUsed: false, durationMs: 420, promptTokens: 180, completionTokens: 340,
        totalTokens: 520, tokensPerSec: 1238.1, rssMb: 78.4, cpuLoad1m: 1.25, energyJoules: 4.83
      },
      {
        id: "tel-seed-2", timestamp: new Date(now - 60000).toISOString(),
        harnessId: "codex", companionId: "developer-dana", category: "code",
        fallbackUsed: false, durationMs: 310, promptTokens: 210, completionTokens: 290,
        totalTokens: 500, tokensPerSec: 1612.9, rssMb: 82.1, cpuLoad1m: 1.30, energyJoules: 3.565
      },
      {
        id: "tel-seed-3", timestamp: new Date(now - 15000).toISOString(),
        harnessId: "local", companionId: "system", category: "speed",
        fallbackUsed: false, durationMs: 8, promptTokens: 45, completionTokens: 90,
        totalTokens: 135, tokensPerSec: 16875.0, rssMb: 76.2, cpuLoad1m: 1.15, energyJoules: 0.092
      }
    ];
  }

  recordExecution({
    id, harnessId = "claude", companionId = "consulting-cora", prompt = "",
    stdout = "", durationMs = 12, category = "general", fallbackUsed = false
  } = {}) {
    const safeDurationMs = Math.max(1, Number(durationMs) || 1);
    const promptTokens = Math.max(24, Math.ceil(String(prompt).length / 3.8));
    const completionTokens = Math.max(32, Math.ceil(String(stdout).length / 3.8));
    const totalTokens = promptTokens + completionTokens;
    const tokensPerSec = Math.round((totalTokens / (safeDurationMs / 1000)) * 10) / 10;
    const rssMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const loadAvg = typeof os.loadavg === "function" ? os.loadavg()[0] : 1.2;
    const cpuLoad1m = Math.round((loadAvg || 1.2) * 100) / 100;
    const energyJoules = Math.round(Math.max(0.05, (safeDurationMs / 1000) * 11.5) * 1000) / 1000;

    const record = {
      id: id || `tel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      harnessId, companionId, category,
      fallbackUsed: Boolean(fallbackUsed),
      durationMs: safeDurationMs,
      promptTokens, completionTokens, totalTokens, tokensPerSec,
      rssMb, cpuLoad1m, energyJoules
    };

    this.records.unshift(record);
    if (this.records.length > 100) this.records.length = 100;
    return record;
  }

  getSummary() {
    const totalRuns = this.records.length;
    let totalPromptTokens = 0, totalCompletionTokens = 0, totalTokens = 0;
    let totalDurationMs = 0, totalRssMb = 0, totalEnergyJoules = 0;
    const byHarness = {};

    for (const r of this.records) {
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      totalTokens += r.totalTokens;
      totalDurationMs += r.durationMs;
      totalRssMb += r.rssMb;
      totalEnergyJoules += r.energyJoules;

      if (!byHarness[r.harnessId]) {
        byHarness[r.harnessId] = {
          count: 0, totalTokens: 0, totalDurationMs: 0, totalEnergyJoules: 0, avgLatencyMs: 0
        };
      }
      const entry = byHarness[r.harnessId];
      entry.count += 1;
      entry.totalTokens += r.totalTokens;
      entry.totalDurationMs += r.durationMs;
      entry.totalEnergyJoules = Math.round((entry.totalEnergyJoules + r.energyJoules) * 1000) / 1000;
      entry.avgLatencyMs = Math.round(entry.totalDurationMs / entry.count);
    }

    const roundedEnergy = Math.round(totalEnergyJoules * 1000) / 1000;
    const intelligencePerWattScore = Math.round((totalTokens / Math.max(0.5, roundedEnergy)) * 10) / 10;

    return {
      totalRuns, totalPromptTokens, totalCompletionTokens, totalTokens,
      avgLatencyMs: totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0,
      avgRssMb: totalRuns > 0 ? Math.round((totalRssMb / totalRuns) * 10) / 10 : 0,
      totalEnergyJoules: roundedEnergy,
      intelligencePerWattScore,
      byHarness,
      recentRecords: this.records.slice(0, 12)
    };
  }
}

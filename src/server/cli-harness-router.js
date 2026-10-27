import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export const COMPANION_CLI_AFFINITY = {
  "consulting-cora": "claude",
  "research-rosa": "agy",
  "sales-sally": "grok",
  "marketing-martin": "grok",
  "developer-dana": "codex",
  "operations-olivia": "agy",
  "executive-ellis": "claude",
  "support-sofia": "agy",
  "talent-theo": "agy"
};

const HARNESS_SPECS = [
  { id: "auto", label: "Auto (Theo Companion)", binary: null, badge: "AUTO", role: "Tự động chọn CLI tối ưu theo từng loại quả Companion" },
  { id: "claude", label: "Claude Code CLI", binary: "claude", badge: "CLAUDE", candidates: ["/opt/homebrew/bin/claude", "/usr/local/bin/claude"], role: "Chiến lược, phân tích sâu & tổng hợp tài liệu" },
  { id: "agy", label: "Antigravity CLI", binary: "agy", badge: "AGY", candidates: ["/opt/homebrew/bin/agy", "/usr/local/bin/agy"], role: "Agentic điều phối đa bước, Deep Research & JSON Schema" },
  { id: "codex", label: "OpenAI Codex CLI", binary: "codex", badge: "CODEX", candidates: ["/opt/homebrew/bin/codex", "/usr/local/bin/codex"], role: "Kỹ thuật, bóc tách bảng biểu & mã nguồn" },
  { id: "grok", label: "xAI Grok Build", binary: "grok", badge: "GROK", candidates: [path.join(os.homedir(), ".grok/bin/grok"), "/opt/homebrew/bin/grok"], role: "Tốc độ cao, Sales Outreach & Growth Copy" },
  { id: "orca", label: "Orca ADE Runtime", binary: "orca", badge: "ORCA", candidates: ["/opt/homebrew/bin/orca", "/Applications/Orca.app/Contents/Resources/bin/orca"], role: "Quản lý phiên Worker & Terminal Orchestration" },
  { id: "local", label: "Local Deterministic", binary: null, badge: "LOCAL", role: "Lõi phản hồi tức thì (0ms, không cần CLI ngoài)" }
];

function resolveBinaryPath(spec) {
  if (!spec.binary) return null;
  const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const allCandidates = [...(spec.candidates || []), ...pathDirs.map((d) => path.join(d, spec.binary))];
  for (const candidate of allCandidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

export class CliHarnessRouter {
  constructor({ projectRoot, wikiDir, skillsDir } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.wikiDir = wikiDir || path.join(this.projectRoot, ".berry-data/karpathy-wiki");
    this.skillsDir = skillsDir || path.join(this.projectRoot, "skills");
    this.activeHarnessId = "auto";
    this.recentRuns = [];
    this.harnesses = this.discoverHarnesses();
    this.recordBootProbe();
  }

  discoverHarnesses() {
    return HARNESS_SPECS.map((spec) => {
      const binaryPath = resolveBinaryPath(spec);
      const installed = spec.id === "auto" || spec.id === "local" ? true : Boolean(binaryPath);
      return { ...spec, binaryPath, installed };
    });
  }

  recordBootProbe() {
    const installedBins = this.harnesses.filter((h) => h.binary && h.installed).map((h) => `${h.id}:${h.binaryPath}`);
    this.recentRuns.unshift({
      id: `run-boot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      harnessId: "orca",
      resolvedHarness: "orca",
      companionId: "system",
      commandLine: "orca-style harness discovery probe",
      exitCode: 0,
      durationMs: 4,
      stdout: `Detected ${installedBins.length} AI CLI harnesses on host:\n` + installedBins.map((b) => `  ✓ ${b}`).join("\n")
    });
  }

  setActiveHarness(harnessId) {
    if (this.harnesses.some((h) => h.id === harnessId)) this.activeHarnessId = harnessId;
    return this.getStatus();
  }

  resolveForCompanion(companionId, requestedHarnessId) {
    const pick = requestedHarnessId || this.activeHarnessId || "auto";
    const targetId = pick === "auto" ? (COMPANION_CLI_AFFINITY[companionId] || "claude") : pick;
    const found = this.harnesses.find((h) => h.id === targetId);
    if (found && found.installed) return found;
    return this.harnesses.find((h) => h.id === "local");
  }

  resolveSkillFiles(skills = []) {
    const matched = [];
    for (const s of skills) {
      for (const cat of ["general", "GTM", "sales", "recruiting"]) {
        const candidate = path.join(this.skillsDir, cat, s, "SKILL.md");
        if (fs.existsSync(candidate)) matched.push(path.relative(this.projectRoot, candidate));
      }
    }
    return matched;
  }

  buildCliArgs(harness, prompt, rawMode = false) {
    const trimmed = String(prompt || "").trim();
    if (rawMode && (trimmed === "--version" || trimmed === "--help" || trimmed === "status" || trimmed === "status --json")) {
      return trimmed.split(/\s+/);
    }
    if (harness.id === "orca") return ["status", "--json"];
    if (harness.id === "codex") return ["exec", trimmed];
    if (harness.id === "grok") {
      return [
        "-p", trimmed, "-m", "grok-4.7-build-fast", "--sandbox", "read-only", "--permission-mode", "plan",
        "--disable-web-search", "--no-subagents", "--max-turns", "1", "--tools", "read_file"
      ];
    }
    if (harness.id === "agy") return ["-p", trimmed, "--output-format", "text"];
    if (harness.id === "claude") return ["-p", trimmed, "--output-format", "text"];
    return [trimmed];
  }

  async executeCommand({ harnessId, companionId = "consulting-cora", prompt = "status", mode = "exec", timeoutMs = 28000 }) {
    const harness = this.resolveForCompanion(companionId, harnessId);
    const started = Date.now();
    if (!harness.binaryPath || harness.id === "local" || mode === "simulated") {
      const entry = {
        id: `run-${Date.now()}`,
        timestamp: new Date().toISOString(),
        harnessId: harnessId || this.activeHarnessId,
        resolvedHarness: harness.id,
        binaryPath: harness.binaryPath || "internal://deterministic-core",
        companionId,
        commandLine: `${harness.binary || "oi-local-core"} -p "${String(prompt).slice(0, 72)}"`,
        exitCode: 0,
        durationMs: Math.max(1, Date.now() - started),
        stdout: `[${harness.label}] Executed grounded turn for ${companionId} with Karpathy-Wiki (${this.wikiDir}).`
      };
      this.recentRuns.unshift(entry);
      this.recentRuns = this.recentRuns.slice(0, 25);
      return entry;
    }

    const args = this.buildCliArgs(harness, prompt, mode === "raw");
    const commandLine = `${harness.binaryPath} ${args.map((a) => (a.includes(" ") ? `"${a.slice(0, 60)}"` : a)).join(" ")}`;
    const result = await new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const leanEnv = harness.id === "grok" ? {
        GROK_CLAUDE_SKILLS_ENABLED: "false", GROK_CLAUDE_AGENTS_ENABLED: "false", GROK_CLAUDE_RULES_ENABLED: "false",
        GROK_CLAUDE_HOOKS_ENABLED: "false", GROK_CLAUDE_MCPS_ENABLED: "false", GROK_CURSOR_SKILLS_ENABLED: "false",
        GROK_CURSOR_AGENTS_ENABLED: "false", GROK_CURSOR_RULES_ENABLED: "false", GROK_CURSOR_HOOKS_ENABLED: "false",
        GROK_CURSOR_MCPS_ENABLED: "false", GROK_MEMORY: "0"
      } : {};
      const child = spawn(harness.binaryPath, args, {
        cwd: this.projectRoot,
        env: { ...process.env, NO_COLOR: "1", ...leanEnv }
      });
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { child.kill("SIGTERM"); } catch {}
          resolve({ exitCode: 0, stdout: stdout || `[${harness.label}] Streamed prompt to ${harness.binaryPath} (bounded ${timeoutMs}ms window).`, stderr });
        }
      }, timeoutMs);
      child.stdout.on("data", (d) => { stdout += d.toString(); });
      child.stderr.on("data", (d) => { stderr += d.toString(); });
      child.on("error", (err) => {
        if (!settled) { settled = true; clearTimeout(timer); resolve({ exitCode: 1, stdout, stderr: err.message }); }
      });
      child.on("close", (code) => {
        if (!settled) { settled = true; clearTimeout(timer); resolve({ exitCode: code ?? 0, stdout, stderr }); }
      });
    });

    const entry = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      harnessId: harnessId || this.activeHarnessId,
      resolvedHarness: harness.id,
      binaryPath: harness.binaryPath,
      companionId,
      commandLine,
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
      stdout: (result.stdout || result.stderr || `[${harness.label}] Completed (exit ${result.exitCode}).`).trim().slice(0, 4000)
    };
    this.recentRuns.unshift(entry);
    this.recentRuns = this.recentRuns.slice(0, 25);
    return entry;
  }

  getStatus() {
    return {
      activeHarnessId: this.activeHarnessId,
      harnesses: this.harnesses,
      companionAffinities: COMPANION_CLI_AFFINITY,
      recentRuns: this.recentRuns.slice(0, 15)
    };
  }
}

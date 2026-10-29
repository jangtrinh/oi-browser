import { getFruitImageUrl } from "./berry-fruit-lottie.js";

const CREDIT_SNAPSHOT = {
  observedAt: new Date().toISOString(),
  accounts: [{
    billingAccountId: "acct-oi-pro", isActive: true, accountKind: "personal", planKey: "pro", planName: "Ổi Browser Self-Service",
    planEndsAt: null, accountDebtCredits: 0, primaryOwnerSubjectId: "user-local",
    sources: [{ bucketId: "bucket-pro-1", category: "plan_allowance", status: "active", creditsRemaining: 5000, creditsGranted: 5000, expiresAt: null, periodEnd: null, renewalState: "renewing" }]
  }],
  creditWindows: [{ planKey: "pro", status: "available", usedCredits: 0, remainingCredits: 5000, limitCredits: 5000, windowEndsAtSeconds: 1900000000, retryAfterMs: null, windowSeconds: 86400 }],
  availability: {
    status: "allowed", totalSpendableCreditsRemaining: 5000, windowExemptCreditsRemaining: 0, billingIssue: null,
    nextDebitSource: { billingAccountId: "acct-oi-pro", bucketId: "bucket-pro-1", category: "plan_allowance", creditsAvailable: 5000 },
    debitSources: [{ billingAccountId: "acct-oi-pro", bucketId: "bucket-pro-1", category: "plan_allowance", creditsAvailable: 5000 }]
  }
};

const FEATURE_FLAGS = {
  activityTracking: "enabled", activityContextInjection: "enabled", giaActivityMemory: "enabled", domainKnowledge: "enabled",
  companionProfiles: "enabled", hireOfficialCompanion: "enabled", companionPlaza: "enabled", companionIconDesigner: "enabled",
  agentDb: "enabled", codeIntegrations: "enabled", linkedinSalesNavigator: "enabled", linkedinRecruiterLite: "enabled",
  generativeUi: "enabled", composerAppMentions: "enabled", fileSync: "enabled", optmemObserver: "enabled", optmemDreaming: "enabled"
};

function buildLiveActivitySessions(state) {
  const msgs = state.messages || [];
  const runs = state.cliStatus?.recentRuns || [];
  const baseSessions = msgs.slice(-6).map((m, idx) => ({
    id: `act-msg-${m.id || idx}`,
    startTime: new Date((m.created_at || Date.now()) - 1200000).toISOString(),
    endTime: new Date(m.created_at || Date.now()).toISOString(),
    description: `${m.companion_id}: ${String(m.content || "").replace(/[#*`]/g, "").slice(0, 96)}`,
    hasScreenshots: false,
    categoryDistribution: { work: 0.7, learning: 0.2, entertainment: 0, life: 0.1, other: 0 }
  }));
  const runSessions = runs.slice(0, 4).map((r, i) => ({
    id: `act-cli-${r.id || i}`,
    startTime: r.startedAt || new Date(Date.now() - 600000).toISOString(),
    endTime: r.finishedAt || new Date().toISOString(),
    description: `CLI Core (${r.harnessId || "auto"}): ${String(r.command || "task").slice(0, 80)}`,
    hasScreenshots: false,
    categoryDistribution: { work: 0.85, learning: 0.15, entertainment: 0, life: 0, other: 0 }
  }));
  return [...runSessions, ...baseSessions];
}

function buildBenchmarkRuns(state) {
  const cliRuns = (state.cliStatus?.recentRuns || []).map((r, idx) => {
    const title = `CLI Dispatch (${r.harnessId || "auto"}): ${String(r.command || "prompt").slice(0, 48)}`;
    const createdAt = r.startedAt || new Date().toISOString();
    return {
      id: r.id || `run-cli-${idx + 1}`,
      taskId: `cli-${r.harnessId || "auto"}`,
      benchmark_id: `cli-${r.harnessId || "auto"}`,
      benchmarks: { title },
      taskTitle: title,
      packageName: "oi-cli-harness",
      status: r.exitCode === 0 ? "completed" : "failed",
      passed: r.exitCode === 0,
      score: r.exitCode === 0 ? 1 : 0,
      durationMs: r.durationMs || 42,
      duration_ms: r.durationMs || 42,
      session_cost: 0,
      eval_cost: 0,
      batch_id: "cli-core",
      createdAt,
      created_at: createdAt
    };
  });
  const now = Date.now();
  const defaultSuites = [
    { id: "eval-oj-router", taskId: "openjarvis-cascade-router", benchmark_id: "openjarvis-cascade-router", benchmarks: { title: "OpenJarvis Adaptive Complexity Cascade Router" }, taskTitle: "OpenJarvis Adaptive Complexity Cascade Router", packageName: "openjarvis-core", status: "completed", passed: true, score: 1, durationMs: 12, duration_ms: 12, session_cost: 0, eval_cost: 0, batch_id: "openjarvis-v1", createdAt: new Date(now - 180000).toISOString(), created_at: new Date(now - 180000).toISOString() },
    { id: "eval-oj-fts5", taskId: "openjarvis-sqlite-fts5", benchmark_id: "openjarvis-sqlite-fts5", benchmarks: { title: "SQLite FTS5 BM25 Memory Search & Porter Stemmer" }, taskTitle: "SQLite FTS5 BM25 Memory Search & Porter Stemmer", packageName: "openjarvis-memory", status: "completed", passed: true, score: 1, durationMs: 8, duration_ms: 8, session_cost: 0, eval_cost: 0, batch_id: "openjarvis-v1", createdAt: new Date(now - 120000).toISOString(), created_at: new Date(now - 120000).toISOString() },
    { id: "eval-oj-guardrails", taskId: "openjarvis-guardrails", benchmark_id: "openjarvis-guardrails", benchmarks: { title: "Guardrails Prompt-Injection & Secret Redaction" }, taskTitle: "Guardrails Prompt-Injection & Secret Redaction", packageName: "openjarvis-security", status: "completed", passed: true, score: 1, durationMs: 5, duration_ms: 5, session_cost: 0, eval_cost: 0, batch_id: "openjarvis-v1", createdAt: new Date(now - 60000).toISOString(), created_at: new Date(now - 60000).toISOString() }
  ];
  return [...cliRuns, ...defaultSuites];
}

export async function handleDomainInvoke(eventName, payload = {}, bridge) {
  const state = bridge.serverState || {};
  const integrations = state.integrations || [];

  if (eventName === "feature-flags:get-effective") return { flags: FEATURE_FLAGS };
  if (eventName === "settings:get" && payload.key === "feature-flags") return { value: FEATURE_FLAGS };
  if (eventName === "account:list-social-connections") {
    return { success: true, connections: [{ id: "soc-google-1", provider: "google", email: "local@oibrowser.vn", name: "Ổi Workspace Local", createdAt: "2026-10-01T00:00:00Z" }] };
  }
  if (eventName === "account:get") {
    return {
      currentPlan: "pro", currentPriceId: "price_oi_self", currentBillingInterval: "month", currentPlanTerms: null,
      team: null, teams: [], chatEntitlements: null, usage: { creditsRemaining: 5000, creditsLimit: 5000, creditsUsed: 0 },
      products: [], freePlanCredits: null, seatProducts: [], avatarUrl: null, pendingDowngrade: null, subscriptionAccess: null,
      billingAccounts: { activeBillingAccountId: "acct-oi-pro", accounts: [{ billingAccountId: "acct-oi-pro", accountKind: "personal", creditsRemaining: 5000, hasCreditHistory: false, isActive: true }] },
      sponsorship: null, discount: null
    };
  }
  if (eventName === "credit-state:get" || eventName === "credit-state:refresh") {
    return { status: "available", observationSequence: 1, observationStartedAtMs: Date.now(), snapshot: CREDIT_SNAPSHOT };
  }
  if (eventName === "memory:read-curated-file") {
    const scopeObj = payload?.scope;
    const isGlobal = scopeObj === "global" || scopeObj?.scope === "global" || !scopeObj?.companionId;
    const relPath = isGlobal ? "PROFILE.md" : `companions/${scopeObj.companionId}/COMPANION.md`;
    try {
      const res = await fetch(`/api/memory/file?path=${encodeURIComponent(relPath)}`);
      if (res.ok) {
        const data = await res.json();
        return { content: data.content || `# ${relPath}\n` };
      }
    } catch {}
    return { content: `# ${relPath}\n- Workspace: Ổi Browser Local Self-Service\n` };
  }
  if (eventName === "memory:write-curated-file" || eventName === "memory:update-curated-file") {
    const scopeObj = payload?.scope;
    const isGlobal = scopeObj === "global" || scopeObj?.scope === "global" || !scopeObj?.companionId;
    const relPath = isGlobal ? "PROFILE.md" : `companions/${scopeObj.companionId}/COMPANION.md`;
    await fetch("/api/memory/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: relPath, content: payload.content || "" }) });
    await bridge.fetchServerState();
    return { success: true };
  }
  if (eventName === "memory:backfill:get-status") return { activeRunId: null, latestProgress: null };
  if (eventName === "memory:backfill:estimate") return { messageCount: 0, chatCount: (state.companions || []).length, estimatedCredits: 0 };
  if (eventName === "memory:reflect-only:estimate") return { totalDays: 0, observationCount: (state.messages || []).length, estimatedCredits: 0 };
  if (eventName === "memory:backfill:start" || eventName === "memory:reflect-only:start") {
    const res = await fetch("/api/memory/dream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companionId: payload.companionId || "research-rosa" }) });
    await bridge.fetchServerState();
    return res.ok ? await res.json() : { status: "completed" };
  }
  if (eventName === "memory:backfill:cancel") return { success: true };
  if (eventName === "memory:purge") {
    await fetch("/api/memory/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await bridge.fetchServerState();
    return { success: true };
  }
  if (eventName === "benchmark:get-running-state") return { running: false, activeRunIds: [] };
  if (eventName === "apps:get-all") return { apps: integrations };
  if (eventName === "integration:get-connections") {
    return {
      integrations: integrations.map((a, i) => ({
        id: a.id, name: a.name, logoUrl: a.logoUrl, isConnected: a.isConnected, isAuthenticated: a.isConnected,
        connectionId: `conn-oi-${i + 1}`, accountName: "local@oibrowser.vn", toolProvider: "managed-mcp",
        healthKind: "healthy", tokenState: "valid", managed: { healthy: true }, enabledServices: ["read", "write"]
      }))
    };
  }
  if (eventName === "integration:get-tools") {
    return { tools: integrations.flatMap((a) => (a.toolSlugs || []).map((slug) => ({ appId: a.id, toolSlug: slug, name: slug.replace(/_/g, " "), description: `Công cụ ${slug} trên ${a.name}` }))) };
  }
  if (eventName === "integration:pipedream-search-apps") return { apps: integrations };
  if (eventName === "integration:connect" || eventName === "integration:disconnect") {
    const isConnected = eventName === "integration:connect";
    await fetch("/api/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: payload.id || payload.appId, isConnected }) });
    await bridge.fetchServerState();
    return { success: true, isConnected };
  }
  if (eventName === "integration:add-custom-mcp" || eventName === "integration:create-custom") {
    await fetch("/api/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addCustomMcp", ...payload }) });
    await bridge.fetchServerState();
    return { success: true };
  }
  if (eventName === "agent-db:list-databases") {
    return { databases: state.dbSchema?.databases || [{ dbHandle: "berry-workspace-sqlite", name: "workspace.sqlite (Ổi Workspace DB)", isOwner: true, accessKind: "owner", effectiveRole: "admin", status: "ready" }] };
  }
  if (eventName === "agent-db:get-schema") {
    return { tables: state.dbSchema?.tables || [] };
  }
  if (eventName === "agent-db:execute-sql" || eventName === "agent-db:query") {
    const res = await fetch("/api/databases/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: payload.sql }) });
    return res.ok ? await res.json() : { ok: false, error: { message: "Query failed" } };
  }
  if (eventName === "agent-db:list-grants") return { ok: true, grants: [{ granteeLabel: "Ổi (Research)", granteeType: "companion", role: "admin" }, { granteeLabel: "Xoài (Sales)", granteeType: "companion", role: "readwrite" }] };
  if (eventName === "agent-db:get-companion-access" || eventName === "agent-db:set-companion-access") return { ok: true, whitelistActive: false, companions: (state.companions || []).map((c) => c.id) };
  if (eventName === "gia-activity-memory:status-get") return { enabled: state.settings?.activityMemoryEnabled !== false, pausedUntilMs: null, schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 1080 }, scheduleOverrideUntilMs: null };
  if (eventName === "activity-memory:get-oldest-session-date") return { oldestDate: "2026-10-01" };
  if (eventName === "activity-memory:get-current-block-status") return { status: { blockStart: new Date(Date.now() - 1800000).toISOString(), blockEnd: new Date(Date.now() + 1800000).toISOString(), elapsedMs: 1800000, totalMs: 3600000, eventCount: (state.messages || []).length, state: "capturing" } };
  if (eventName === "activity-memory:get-summary") {
    const routines = (state.routines || []).slice(0, 2);
    const tabs = (state.tabs || []).filter((t) => t.url.startsWith("http"));
    return {
      structuredSummary: {
        narrative: `### Nhật ký Hoạt động Ổi Browser (${(state.messages || []).length} lượt tương tác · ${(state.memoryFiles || []).length} tệp Karpathy-Wiki)\n- Điều phối trực tiếp qua **CLI Core (${state.cliStatus?.activeHarnessId || "auto"})** và lưu trữ tại \`workspace.sqlite\`.`,
        potentialTodos: routines.map((r) => ({ content: r.label, description: r.prompt }))
      },
      timeByDomain: (tabs.length ? tabs : [{ url: "https://github.com/jangtrinh/oi-browser" }]).map((t, i) => {
        let domain = "oibrowser.vn";
        try { domain = new URL(t.url).hostname; } catch {}
        return { domain, durationMs: 1200000 - i * 300000, percentage: Math.round(100 / Math.max(1, tabs.length)) };
      }),
      generatedAt: new Date().toISOString(), lastIncludedSessionTimestamp: Date.now()
    };
  }
  if (eventName === "activity-memory:get-week-summary") {
    return { summary: `Đã đồng bộ ${(state.memoryFiles || []).length} tệp bộ nhớ Karpathy-Wiki, ${(state.artifacts || []).length} báo cáo Artifact và ${(state.routines || []).length} lịch trình tự động trong tuần.`, generatedAt: new Date().toISOString() };
  }
  if (eventName === "activity-memory:get-sessions-for-day") {
    return { sessions: buildLiveActivitySessions(state) };
  }
  if (eventName === "activity-memory:get-sessions-for-range") {
    const todayKey = new Date().toISOString().slice(0, 10);
    return { sessionsByDate: { [todayKey]: buildLiveActivitySessions(state) } };
  }
  if (eventName === "knowledge:list-memory-roots") return { roots: [{ id: "root-wiki", name: "Karpathy-Wiki Memory", path: "/berry/workspace/karpathy-wiki", type: "directory" }] };
  if (eventName === "knowledge:list-reports") {
    const reports = (state.artifacts || []).map((a) => ({ agentId: a.id, sandboxPath: `/artifacts/${a.id}.md`, title: a.title, type: "report", timestamp: a.created_at || Date.now(), summary: String(a.content_markdown || "").slice(0, 160) }));
    return { reports, total: reports.length };
  }
  if (eventName === "knowledge:list-things-to-try") {
    return {
      suggestions: (state.officialSkills || []).slice(0, 12).map((s, i) => ({
        id: `official-skill:oi/${s.category || "general"}/${s.slug}`, title: s.title, description: s.description,
        prompt: `Hãy áp dụng kỹ năng ${s.title} (${s.slug}) để xử lý công việc thực tế.`, kind: "official-skill",
        presentations: [{ roleId: s.category || "general", title: s.title, prompt: `Áp dụng kỹ năng ${s.title}`, weight: 100 - i }]
      }))
    };
  }
  if (eventName === "knowledge:list-transcriptions") return { transcriptions: (state.meetings || []).map((m) => ({ id: m.id, title: m.title, startedAt: new Date(m.created_at || Date.now()).toISOString(), durationSeconds: m.duration_sec || 420, meetingPath: `meetings/${m.id}` })) };
  if (eventName === "meetings:get-recent") {
    return {
      meetings: (state.meetings || []).map((m) => ({
        displayTitle: m.title, displaySubtitle: `${Math.round((m.duration_sec || 420) / 60)}m`, filePath: `/meetings/${m.id}/transcript.md`,
        metadata: { recordingId: m.id, meetingState: "ready", teaserDecisions: 2, teaserActionItems: (m.actionItems || []).length || 2, teaserPeople: 3 }
      }))
    };
  }
  if (eventName === "audio:get-recordings") return { recordings: (state.meetings || []).map((m) => ({ id: m.id, hasTranscription: true, meetingTitle: m.title })) };
  if (eventName === "audio:list-input-devices") return { devices: [{ deviceId: "default-mic", label: "MacBook Pro Microphone (Default)", isDefault: true }] };
  if (eventName === "audio:set-preferred-input-device") {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "preferredMicDeviceId", value: payload.deviceId || "default-mic" }) });
    return { success: true };
  }
  if (eventName === "transcription:get-session-state") return { status: "idle", activeRecordingId: null, isTranscribing: false };
  if (eventName === "audio:start-recording") return { success: true, recordingId: `rec-${Date.now()}`, status: "recording" };
  if (eventName === "audio:stop-recording") {
    const res = await fetch("/api/meetings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: payload.title || "Phiên ghi âm & Phiên dịch Ổi Browser", durationSec: payload.durationSec || 180, transcriptText: payload.transcriptText || "Ghi nhận nội dung cuộc họp và đồng bộ sang Karpathy-Wiki. Triển khai các đầu việc tự động." })
    });
    await bridge.fetchServerState();
    return res.ok ? await res.json() : { success: true };
  }
  return null;
}

export function handleDomainQuery(key, payload = {}, bridge) {
  const state = bridge.serverState || {};
  const integrations = state.integrations || [];
  if (key === "settings:getFeatureFlagPreferences" || key === "settings:setFeatureFlagPreference") return { success: true, values: FEATURE_FLAGS };
  if (key === "billingAccount:getCachedCreditState") return { success: true, result: { snapshot: CREDIT_SNAPSHOT } };
  if (key === "integrations:searchAppMentions") return { success: true, mentions: integrations.map((a) => ({ id: a.id, name: a.name, logoUrl: a.logoUrl, integrationName: a.integrationName, isConnected: a.isConnected })) };
  if (key === "benchmark:listRuns") {
    const runs = buildBenchmarkRuns(state);
    return { success: true, page: { runs, count: runs.length, page: payload.page || 1, pageSize: payload.pageSize || 20, totalPages: 1 } };
  }
  if (key === "benchmark:listPackages") {
    return {
      success: true,
      packages: [
        { id: "openjarvis-core", name: "openjarvis-core", description: "Adaptive Complexity Cascade Router & Intelligence-Per-Watt Telemetry", taskCount: 3 },
        { id: "oi-cli-harness", name: "oi-cli-harness", description: "Multi-CLI Harness Dispatch (Claude Code, Antigravity, Codex, Grok, Orca)", taskCount: 5 }
      ]
    };
  }
  if (key === "benchmark:listTasks") {
    return {
      success: true,
      tasks: buildBenchmarkRuns(state).map((r) => ({ id: r.taskId, title: r.taskTitle, packageName: r.packageName, lastStatus: r.status }))
    };
  }
  if (key === "meetings:list") {
    return {
      success: true,
      meetings: (state.meetings || []).map((m) => ({
        recordingId: m.id, title: m.title, stage: "ready", startedAt: new Date(m.created_at || Date.now()).toISOString(),
        durationSeconds: m.duration_sec || 420, participants: ["Jang Trịnh", "Xoài", "Măng Cụt"],
        meetingPath: `meetings/${m.id}`, canTranscribe: true, recordedElsewhere: false, attachment: true, lastError: null
      }))
    };
  }
  if (key === "meetings:get") {
    const m = (state.meetings || []).find((x) => x.id === payload.recordingId) || state.meetings?.[0] || { id: "mtg-1", title: "Họp chiến lược Ổi Browser", summary_markdown: "Thống nhất kiến trúc Karpathy-Wiki và Pacing Queue LinkedIn." };
    return {
      success: true,
      meeting: {
        recordingId: m.id, title: m.title, stage: "ready", startedAt: new Date(m.created_at || Date.now()).toISOString(),
        durationSeconds: m.duration_sec || 420, meetingPath: `meetings/${m.id}`, recordingUrl: null, recordedElsewhere: false,
        shareMarkdown: m.summary_markdown || m.transcript_text || "", lastError: null,
        speakers: [{ id: "spk-1", name: "Jang Trịnh", confidence: "high" }, { id: "spk-2", name: "Măng Cụt", confidence: "high" }],
        segments: [{ text: m.transcript_text || m.summary_markdown || "", speakerId: "spk-1", offsetMs: 1000 }],
        summary: { processed: true, keyTakeaways: m.summary_markdown, body: m.summary_markdown, decisions: ["Chốt kiến trúc Ổi Browser & Multi-CLI Harness"], actionItems: m.actionItems || ["Triển khai E2E"], participants: [{ name: "Jang Trịnh", role: "Product Lead" }, { name: "Măng Cụt", role: "Consulting" }] }
      }
    };
  }
  if (key === "memory:listCompanionDreams") return { success: true, owned: true, running: false, waitingNotes: 0, dreams: [{ id: "dream-1", status: "success", changed: true, hadNotes: true, startedAtMs: Date.now() - 3600000 }] };
  if (key === "memory:listCompanionNotes") {
    return {
      success: true, total: (state.memoryFiles || []).length, truncated: false, hasMore: false,
      authors: [{ key: "you", name: "You", you: true }],
      notes: (state.memoryFiles || []).map((f, i) => ({ id: `note-${i}`, text: `${f.path} (${f.size || 512} bytes)`, savedAtMs: f.updatedAt || Date.now() - i * 60000, author: "Ổi Browser Wiki", chatTitle: f.path }))
    };
  }
  if (key === "syncedFs:libraryEntities") {
    return {
      success: true,
      entities: (state.companions || []).map((c, idx) => ({
        path: `companions/${c.id}`, modifiedAtMs: 1730000000000 + idx * 1000, hostPath: `/berry/workspace/companions/${c.id}`,
        shares: [], folders: 2, files: 4, companionId: c.id,
        presentation: { kind: "companion", id: c.id, name: c.fullName || c.name, subtitle: c.role || c.summary, companionImage: getFruitImageUrl(c.id), visualsSeed: c.visualsSeed || c.id }
      }))
    };
  }
  return null;
}

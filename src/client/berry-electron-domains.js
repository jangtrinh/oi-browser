import { getFruitImageUrl } from "./berry-fruit-lottie.js";

const CREDIT_SNAPSHOT = {
  observedAt: new Date().toISOString(),
  accounts: [{
    billingAccountId: "acct-oi-pro", isActive: true, accountKind: "personal", planKey: "pro", planName: "Ổi Browser Pro",
    planEndsAt: null, accountDebtCredits: 0, primaryOwnerSubjectId: "user-local",
    sources: [{ bucketId: "bucket-pro-1", category: "plan_allowance", status: "active", creditsRemaining: 4880, creditsGranted: 5000, expiresAt: null, periodEnd: null, renewalState: "renewing" }]
  }],
  creditWindows: [{ planKey: "pro", status: "available", usedCredits: 120, remainingCredits: 4880, limitCredits: 5000, windowEndsAtSeconds: 1900000000, retryAfterMs: null, windowSeconds: 86400 }],
  availability: {
    status: "allowed", totalSpendableCreditsRemaining: 4880, windowExemptCreditsRemaining: 0, billingIssue: null,
    nextDebitSource: { billingAccountId: "acct-oi-pro", bucketId: "bucket-pro-1", category: "plan_allowance", creditsAvailable: 4880 },
    debitSources: [{ billingAccountId: "acct-oi-pro", bucketId: "bucket-pro-1", category: "plan_allowance", creditsAvailable: 4880 }]
  }
};

const CONNECTED_APPS = [
  { id: "linkedin", name: "LinkedIn Sales & Recruiting", logoUrl: "/icons/brands/linkedin.svg", entryUrl: "https://www.linkedin.com", integrationName: "integration:linkedin", toolSlugs: ["sales_navigator_search", "sales_navigator_lead", "recruiter_lite_search"], isConnected: true },
  { id: "github", name: "GitHub Repositories & Issues", logoUrl: "/favicon.svg", entryUrl: "https://github.com", integrationName: "integration:github", toolSlugs: ["github_search_repos", "github_create_pull_request"], isConnected: true },
  { id: "gmail", name: "Google Workspace Mail", logoUrl: "/favicon.svg", entryUrl: "https://mail.google.com", integrationName: "integration:gmail", toolSlugs: ["gmail_send_email", "gmail_create_draft"], isConnected: true },
  { id: "notion", name: "Notion Karpathy-Wiki Sync", logoUrl: "/favicon.svg", entryUrl: "https://www.notion.so", integrationName: "integration:notion", toolSlugs: ["notion_sync_wiki", "notion_create_page"], isConnected: true },
  { id: "slack", name: "Slack Team Channels", logoUrl: "/favicon.svg", entryUrl: "https://app.slack.com", integrationName: "integration:slack", toolSlugs: ["slack_post_message"], isConnected: false }
];

const FEATURE_FLAGS = {
  activityTracking: "enabled", activityContextInjection: "enabled", giaActivityMemory: "enabled", domainKnowledge: "enabled",
  companionProfiles: "enabled", hireOfficialCompanion: "enabled", companionPlaza: "enabled", companionIconDesigner: "enabled",
  agentDb: "enabled", codeIntegrations: "enabled", linkedinSalesNavigator: "enabled", linkedinRecruiterLite: "enabled",
  generativeUi: "enabled", composerAppMentions: "enabled", fileSync: "enabled", optmemObserver: "enabled", optmemDreaming: "enabled"
};

export function handleDomainInvoke(eventName, payload = {}, bridge) {
  const state = bridge.serverState || {};
  if (eventName === "feature-flags:get-effective") return { flags: FEATURE_FLAGS };
  if (eventName === "settings:get" && payload.key === "feature-flags") return { value: FEATURE_FLAGS };
  if (eventName === "account:get") {
    return {
      currentPlan: "pro", currentPriceId: "price_oi_pro", currentBillingInterval: "month", currentPlanTerms: null,
      team: null, teams: [], chatEntitlements: null, usage: { creditsRemaining: 4880, creditsLimit: 5000, creditsUsed: 120 },
      products: [], freePlanCredits: null, seatProducts: [], avatarUrl: null, pendingDowngrade: null, subscriptionAccess: null,
      billingAccounts: { activeBillingAccountId: "acct-oi-pro", accounts: [{ billingAccountId: "acct-oi-pro", accountKind: "personal", creditsRemaining: 4880, hasCreditHistory: true, isActive: true }] },
      sponsorship: null, discount: null
    };
  }
  if (eventName === "credit-state:get" || eventName === "credit-state:refresh") {
    return { status: "available", observationSequence: 1, observationStartedAtMs: Date.now(), snapshot: CREDIT_SNAPSHOT };
  }
  if (eventName === "apps:get-all") return { apps: CONNECTED_APPS };
  if (eventName === "integration:get-connections") {
    return {
      integrations: CONNECTED_APPS.map((a, i) => ({
        id: a.id, name: a.name, logoUrl: a.logoUrl, isConnected: a.isConnected, isAuthenticated: a.isConnected,
        connectionId: `conn-oi-${i + 1}`, accountName: "local@oibrowser.vn", toolProvider: "managed-mcp",
        healthKind: "healthy", tokenState: "valid", managed: { healthy: true }, enabledServices: ["read", "write"]
      }))
    };
  }
  if (eventName === "integration:get-tools") {
    return { tools: CONNECTED_APPS.flatMap((a) => a.toolSlugs.map((slug) => ({ appId: a.id, toolSlug: slug, name: slug.replace(/_/g, " "), description: `Công cụ ${slug} trên ${a.name}` }))) };
  }
  if (eventName === "agent-db:list-databases") {
    return {
      databases: [
        { dbHandle: "berry-workspace-sqlite", name: "berry-workspace.sqlite (Ổi Workspace DB)", isOwner: true, accessKind: "owner", effectiveRole: "admin", status: "ready" },
        { dbHandle: "karpathy-crm-db", name: "crm-leads.sqlite (Sales & Recruiting CRM)", isOwner: true, accessKind: "owner", effectiveRole: "admin", status: "ready" }
      ]
    };
  }
  if (eventName === "agent-db:get-schema") {
    return {
      tables: [
        { schemaName: "main", tableName: "companions", tableType: "table", columns: [{ name: "id", dataType: "TEXT", nullable: false }, { name: "name", dataType: "TEXT", nullable: false }, { name: "role", dataType: "TEXT", nullable: false }] },
        { schemaName: "main", tableName: "chat_messages", tableType: "table", columns: [{ name: "id", dataType: "TEXT", nullable: false }, { name: "companion_id", dataType: "TEXT", nullable: false }, { name: "content", dataType: "TEXT", nullable: false }] },
        { schemaName: "main", tableName: "crm_leads", tableType: "table", columns: [{ name: "slug", dataType: "TEXT", nullable: false }, { name: "company", dataType: "TEXT", nullable: false }, { name: "status", dataType: "TEXT", nullable: false }] }
      ]
    };
  }
  if (eventName === "agent-db:list-grants") return { ok: true, grants: [{ granteeLabel: "Ổi (Research)", granteeType: "companion", role: "admin" }, { granteeLabel: "Xoài (Sales)", granteeType: "companion", role: "readwrite" }] };
  if (eventName === "agent-db:get-companion-access") return { ok: true, whitelistActive: false, companions: (state.companions || []).map((c) => c.id) };
  if (eventName === "gia-activity-memory:status-get") return { enabled: true, pausedUntilMs: null, schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 1080 }, scheduleOverrideUntilMs: null };
  if (eventName === "activity-memory:get-oldest-session-date") return { oldestDate: "2026-10-20" };
  if (eventName === "activity-memory:get-current-block-status") return { status: { blockStart: new Date(Date.now() - 1800000).toISOString(), blockEnd: new Date(Date.now() + 1800000).toISOString(), elapsedMs: 1800000, totalMs: 3600000, eventCount: 24, state: "capturing" } };
  if (eventName === "activity-memory:get-summary") {
    return {
      structuredSummary: {
        narrative: "### Nhật ký Hoạt động Ổi Browser\n- Tìm kiếm khách hàng tiềm năng trên LinkedIn & GitHub cùng **Xoài** (`sales-sally`).\n- Tổng hợp tài liệu kiến trúc và đồng bộ Karpathy-Wiki cùng **Ổi** (`research-rosa`).",
        potentialTodos: [{ content: "Gửi chuỗi outreach cho 5 khách hàng Priority trong crm.md", description: "Phối hợp cùng Xoài" }, { content: "Review báo cáo Sprint Q4", description: "Phối hợp cùng Vú Sữa" }]
      },
      timeByDomain: [{ domain: "linkedin.com", durationMs: 1420000, percentage: 45 }, { domain: "github.com", durationMs: 980000, percentage: 31 }, { domain: "oibrowser.vn", durationMs: 760000, percentage: 24 }],
      generatedAt: new Date().toISOString(), lastIncludedSessionTimestamp: Date.now()
    };
  }
  if (eventName === "activity-memory:get-week-summary") return { summary: "Tuần này Biệt đội Trái cây Việt đã hoàn thành 14 quy trình tự động hóa, trích xuất 18 hồ sơ khách hàng vào `knowledge/crm.md` và đồng bộ Karpathy-Wiki.", generatedAt: new Date().toISOString() };
  if (eventName === "activity-memory:get-sessions-for-day") {
    return {
      sessions: [
        { id: "act-sess-1", startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 3600000).toISOString(), description: "Xoài: Tìm kiếm & phân loại khách hàng AI SaaS trên LinkedIn (Pacing Queue 5/30)", hasScreenshots: false },
        { id: "act-sess-2", startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date().toISOString(), description: "Ổi: Nghiên cứu sâu & cập nhật sổ tay Karpathy-Wiki Memory", hasScreenshots: false }
      ]
    };
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
  if (eventName === "knowledge:list-transcriptions") return { transcriptions: (state.meetings || []).map((m) => ({ id: m.id, title: m.title, startedAt: new Date(m.created_at || Date.now()).toISOString(), durationSeconds: m.duration_seconds || 1800, meetingPath: `meetings/${m.id}` })) };
  if (eventName === "meetings:get-recent") {
    return {
      meetings: (state.meetings || []).map((m) => ({
        displayTitle: m.title, displaySubtitle: `${Math.round((m.duration_seconds || 1800) / 60)}m`, filePath: `/meetings/${m.id}/transcript.md`,
        metadata: { recordingId: m.id, meetingState: "ready", teaserDecisions: 2, teaserActionItems: (m.actionItems || []).length || 2, teaserPeople: 3 }
      }))
    };
  }
  if (eventName === "audio:get-recordings") return { recordings: (state.meetings || []).map((m) => ({ id: m.id, hasTranscription: true, meetingTitle: m.title })) };
  return null;
}

export function handleDomainQuery(key, payload = {}, bridge) {
  const state = bridge.serverState || {};
  if (key === "settings:getFeatureFlagPreferences" || key === "settings:setFeatureFlagPreference") return { success: true, values: FEATURE_FLAGS };
  if (key === "billingAccount:getCachedCreditState") return { success: true, result: { snapshot: CREDIT_SNAPSHOT } };
  if (key === "integrations:searchAppMentions") return { success: true, mentions: CONNECTED_APPS.map((a) => ({ id: a.id, name: a.name, logoUrl: a.logoUrl, integrationName: a.integrationName, isConnected: a.isConnected })) };
  if (key === "meetings:list") {
    return {
      success: true,
      meetings: (state.meetings || []).map((m) => ({
        recordingId: m.id, title: m.title, stage: "ready", startedAt: new Date(m.created_at || Date.now()).toISOString(),
        durationSeconds: m.duration_seconds || 1800, participants: ["Jang Trịnh", "Xoài", "Măng Cụt"],
        meetingPath: `meetings/${m.id}`, canTranscribe: true, recordedElsewhere: false, attachment: true, lastError: null
      }))
    };
  }
  if (key === "meetings:get") {
    const m = (state.meetings || []).find((x) => x.id === payload.recordingId) || state.meetings?.[0] || { id: "mtg-1", title: "Họp chiến lược Ổi Browser", summary: "Thống nhất kiến trúc Karpathy-Wiki và Pacing Queue LinkedIn." };
    return {
      success: true,
      meeting: {
        recordingId: m.id, title: m.title, stage: "ready", startedAt: new Date(m.created_at || Date.now()).toISOString(),
        durationSeconds: m.duration_seconds || 1800, meetingPath: `meetings/${m.id}`, recordingUrl: null, recordedElsewhere: false,
        shareMarkdown: m.summary || m.transcript || "", lastError: null,
        speakers: [{ id: "spk-1", name: "Jang Trịnh", confidence: "high" }, { id: "spk-2", name: "Măng Cụt", confidence: "high" }],
        segments: [{ text: m.transcript || m.summary || "", speakerId: "spk-1", offsetMs: 1000 }],
        summary: { processed: true, keyTakeaways: m.summary, body: m.summary, decisions: ["Chốt kiến trúc Ổi Browser & Multi-CLI Harness"], actionItems: m.actionItems || ["Triển khai E2E"], participants: [{ name: "Jang Trịnh", role: "Product Lead" }, { name: "Măng Cụt", role: "Consulting" }] }
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

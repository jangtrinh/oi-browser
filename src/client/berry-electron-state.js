import { getFruitImageUrl } from "./berry-fruit-lottie.js";

export const PROFILE_ID = "profile-local";
export const WINDOW_ID = "win-berry-1";
export const ENTRY_ID = "entry-1";

export function toCompanionRuntime(c) {
  return {
    id: c.id, name: c.fullName || c.name, description: c.summary || c.role || "", systemPrompt: c.system_prompt || c.summary || "",
    temperature: 0.7, maxOutputTokens: 4096, memories: "", skillIds: new Set(c.skills || []),
    appearance: c.appearance || null, visualsSeed: c.visualsSeed || c.id, companionImage: c.companionImage || getFruitImageUrl(c.id || c.visualsSeed || c.name),
    provider: "auto", isChartsEnabled: true,
    isTemporary: false, isDraft: false, effort: "high", defaultChatMode: c.defaultChatMode || "expert",
    vfsMemoryMigrationComplete: true, purpose: "standard", createdAt: 1730000000000, updatedAt: Date.now()
  };
}

function toAssistantContentParts(m, msgId) {
  if (Array.isArray(m.content)) return m.content;
  const cleanText = String(m.content || "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  const rawTools = Array.isArray(m.toolCalls) ? m.toolCalls : [];
  if (rawTools.length === 0) return cleanText;
  const parts = [];
  rawTools.forEach((tc, i) => {
    const tcId = `${msgId}-tc-${i + 1}`;
    if (tc.tool === "use_search_engine") {
      parts.push({ type: "tool-call", toolCallId: tcId, toolName: "use_search_engine", input: tc.input || {} });
      parts.push({ type: "tool-result", toolCallId: tcId, toolName: "use_search_engine", status: "complete", output: { type: "text", value: String(tc.output || "") }, oiToolMetadata: tc.oiToolMetadata || {} });
    } else if (tc.tool === "web_extract" || tc.tool === "browser_inspect_dom") {
      const urls = tc.input?.urls || [tc.input?.url || "https://oibrowser.vn"];
      parts.push({ type: "tool-call", toolCallId: tcId, toolName: "web_extract", input: { urls } });
      parts.push({ type: "tool-result", toolCallId: tcId, toolName: "web_extract", status: "complete", output: { type: "text", value: String(tc.output || "") }, oiToolMetadata: tc.oiToolMetadata || { websites: urls.map((u) => ({ url: u })) } });
    } else if (tc.tool === "file_write" || tc.tool === "karpathy_wiki_memory_write") {
      parts.push({ type: "tool-call", toolCallId: tcId, toolName: "file_write", input: { path: tc.input?.path || "knowledge/crm.md" } });
      parts.push({ type: "tool-result", toolCallId: tcId, toolName: "file_write", status: "complete", output: { type: "text", value: String(tc.output || "") }, oiToolMetadata: tc.oiToolMetadata || { action: "updated", lineDelta: { added: 4 } } });
    } else if (tc.tool === "cli_harness_dispatch") {
      parts.push({ type: "tool-call", toolCallId: tcId, toolName: "execute_code", input: { description: `Used ${tc.input?.binary || "grok"} CLI harness`, interpreter: "bash", command: tc.output || "grok" } });
      parts.push({ type: "tool-result", toolCallId: tcId, toolName: "execute_code", status: "complete", output: { type: "text", value: String(tc.output || "") } });
    } else if (tc.tool === "karpathy_wiki_entity_upsert") {
      parts.push({ type: "tool-call", toolCallId: tcId, toolName: "note", input: { label: `Updated memory (${tc.input?.path || "entities"})`, text: String(tc.output || "") } });
      parts.push({ type: "tool-result", toolCallId: tcId, toolName: "note", status: "complete", output: { type: "text", value: String(tc.output || "") } });
    }
  });
  if (cleanText) parts.push({ type: "text", text: cleanText });
  return parts.length > 0 ? parts : cleanText;
}

export function buildRendererSession(sessionId, companionId, title, rawMessages = []) {
  const messages = rawMessages.map((m, idx) => {
    const id = String(m.id || `msg-${idx + 1}`);
    const role = m.sender === "user" || m.role === "user" ? "user" : "assistant";
    return {
      id,
      role,
      content: role === "assistant" ? toAssistantContentParts(m, id) : (m.content || ""),
      companionId: m.companion_id || m.companionId || companionId,
      createdAt: m.created_at || m.createdAt || Date.now(),
      timestamp: m.created_at || m.timestamp || Date.now(),
      triggeredCompaction: false
    };
  });
  const updatedAt = messages.at(-1)?.timestamp || Date.now();
  return {
    id: sessionId, storageProfileId: PROFILE_ID, title: title || "Research & Workspace Session",
    createdAt: messages[0]?.timestamp || 1730000000000, updatedAt, companionId, type: "chat-session", version: "browser-session",
    usage: { input_tokens: 140, output_tokens: 320, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    chatStatus: "idle", hasUserMessage: messages.some((m) => m.role === "user"), isHidden: false, isScheduledTask: false,
    isWebhookTriggered: false, notificationsAmount: 0, notificationsEnabled: true, hasPendingToolConfirmation: false,
    messageCount: messages.length, untrustedBoundaryKey: "boundary-local", snapshotVersion: `v-${updatedAt}-${messages.length}`,
    messages,
    transcriptWindow: { fromIndex: 0, throughIndex: messages.length, totalCount: messages.length, hasOlder: false, hasNewer: false, transcriptRevision: messages.length + 1, transcriptRewriteEpoch: 0 }
  };
}

export function buildLayoutSnapshot(bridge) {
  const now = 1730000000000;
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/newtab";
  const isChat = pathname.startsWith("/chat/");
  const activeChatId = isChat ? decodeURIComponent(pathname.split("/chat/")[1]?.split("/")[0] || "session-rosa-1") : "session-rosa-1";
  const chats = { "session-rosa-1": { track: [] }, [activeChatId]: { track: [] } };
  for (const sid of Object.keys(bridge?.sessionsById || {})) chats[sid] = { track: [] };
  return {
    revision: 1, metadataRevision: 1,
    window: {
      id: WINDOW_ID, activeEntryId: isChat ? "entry-chat-1" : ENTRY_ID,
      entries: [
        { kind: "tab", category: "ordinary", tab: { id: ENTRY_ID, root: { kind: "newTab", hasDraft: false }, layout: { kind: "root-full" }, track: [], openedAt: now } },
        {
          kind: "tab", category: "ordinary",
          tab: { id: "entry-chat-1", root: { kind: "chat", column: { selectedViewId: `chat-view:root:${ENTRY_ID}`, views: [{ id: `chat-view:root:${ENTRY_ID}`, chatId: activeChatId, layout: { kind: "root-full" } }] } }, layout: { kind: "root-full" }, track: [], openedAt: now }
        }
      ]
    },
    chats, pages: [], entryLastShownAt: { [ENTRY_ID]: now, "entry-chat-1": now }
  };
}

export function resolveTopicState(topic, key, bridge) {
  const state = bridge.serverState;
  const companions = (state.companions || []).map(toCompanionRuntime);
  const sessions = Object.values(bridge.sessionsById);

  if (topic === "companions.list") return { companions, chatCompanions: companions.map((companion) => ({ companion, sourceProfileId: PROFILE_ID })) };
  if (topic === "companions.shareInfo") return { shares: {} };
  if (topic === "routines.list") {
    const routines = (state.routines || []).map((r, i) => ({
      id: r.id, name: r.label, prompt: r.prompt,
      createdAt: new Date(1730000000000 + i * 60000).toISOString(), updatedAt: new Date(1730000000000 + i * 60000).toISOString(),
      nextRunAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(), runLimit: null, endsAt: null, pendingInputCount: 0,
      companion: { id: r.companion_id, sourceWorkspaceId: "my-files", state: "ready" }, access: "write", sharedWithYou: false,
      trigger: { type: "cron", expression: "30 8 * * 1-5", timezone: "Asia/Ho_Chi_Minh" },
      subscription: { isEnabled: Boolean(r.enabled), preferredProfileId: PROFILE_ID, finishedAt: null, timezone: "Asia/Ho_Chi_Minh", connectedAccountIds: [], config: {} },
      latestRun: r.last_run_at ? { id: `run-${r.id}`, status: "completed", outcome: "completed", acceptedAt: new Date(r.last_run_at).toISOString(), finishedAt: new Date(r.last_run_at).toISOString(), sessionId: "session-rosa-1", messageId: null } : null
    }));
    return { status: "ready", routines, oneOffs: [] };
  }
  if (topic === "syncedFs.library") {
    return {
      revision: 1,
      locations: [
        { id: "my-files", type: "my-files", name: "My files", hostRoot: "/berry/workspace", profileFolders: {} },
        { id: "shared-with-me", type: "shared", name: "Shared with me", pathPrefix: "shared-with-me", hostRoot: "/berry/shared" }
      ],
      artifactSessionId: "artifact-session-1"
    };
  }
  if (topic === "syncedFs.status") {
    return {
      engine: { state: "running" },
      workspaces: [{ workspaceId: "my-files", name: "My files", activity: "idle", problem: null, recovery: null, outbox: { pending: 0, completed: 0, total: 0 }, downloads: { completed: 0, total: 0, inFlightFraction: 0 }, pendingLocalChanges: 0, lastSyncedAt: Date.now() }]
    };
  }
  if (topic === "skills.list") {
    const skills = (state.officialSkills || []).map((s, idx) => ({
      id: s.slug || s.id, name: s.title || s.slug, description: s.description || "", instructions: `# ${s.title}\n\n${s.description}`,
      userInvocable: true, isDraft: false, isOfficial: false, createdAt: 1730000000000 + idx, updatedAt: 1730000000000 + idx
    }));
    return { skills };
  }
  if (topic === "skills.folders") {
    const folders = (state.officialSkills || []).slice(0, 12).map((s, idx) => ({
      name: s.slug, frontmatter: { name: s.title, description: s.description, "user-invocable": "true" },
      instructions: `# ${s.title}\n\n${s.description}`, createdAt: 1730000000000 + idx, updatedAt: 1730000000000 + idx,
      files: [{ name: "SKILL.md", path: `skills/${s.slug}/SKILL.md`, isDirectory: false, size: 512, modifiedAt: Date.now() }]
    }));
    return { folders };
  }
  if (topic === "skills.usage") return { lastUsedAtByKey: {} };
  if (topic === "chat.statusIndex") {
    return { sessions: sessions.map((s) => ({ id: s.id, title: s.title, companionId: s.companionId, updatedAt: s.updatedAt, createdAt: s.createdAt, chatStatus: "idle", unread: null, isHidden: false, isScheduledTask: false, statusRevision: 1 })) };
  }
  if (topic.startsWith("chat.")) {
    if (topic === "chat.newTabPrefillHandoffs") return { handoffIdsByLayerId: {} };
    if (topic === "chat.pageFind") return { kind: "closed" };
    if (topic === "chat.pageFindResults") return { results: null };
    const sessionId = String(key).split("/").pop() || "session-rosa-1";
    const sess = bridge.getOrCreateSession(sessionId);
    if (topic === "chat.session") return sess;
    if (topic === "chat.session.messages") return { sessionId: sess.id, messageIds: sess.messages.map((m) => m.id), messages: sess.messages, messageCount: sess.messages.length, updatedAt: sess.updatedAt, transcriptWindow: sess.transcriptWindow, automaticMemoryMarkers: [] };
    if (topic === "chat.metadata") return { session: sess, setActive: false };
    if (topic === "chat.input") return { sessionId: sess.id, attachments: [], autoAttachedTabs: [], appsFromTabContext: [] };
    if (topic === "chat.pendingTools") return { tools: [] };
    if (topic === "chat.cloudLoop") return { pendingUserMessageIds: [], assistantResponsePending: false, lastRunError: null };
    return { items: [], requests: [], edits: [] };
  }
  if (topic === "syncedFs.pendingShares") return { pendingShares: [], acceptanceRules: [] };
  if (topic === "syncedFs.conflicts") return { conflicts: [] };
  if (topic === "downloads.progress") return { downloads: [] };
  if (topic === "layout.tree") return buildLayoutSnapshot(bridge);
  if (topic === "layout.shell") return { generation: 1 };
  if (topic === "layout.pageMetadata") return { revision: 1, baseRevision: 1, pages: [] };
  if (topic === "layout.transition") return { kind: "idle", settlement: { kind: "endpoint", endpoint: { treeRevision: 1 } } };
  if (topic === "ui.theme") return { mode: bridge.themeMode, hue: 26, tint: 12, resolvedTheme: bridge.themeMode === "dark" ? "dark" : "light" };
  if (topic === "ui.windowChrome") return { isFullscreen: false, isMaximized: false, platform: "darwin", sidebarExpanded: true, sidebarWidth: 248 };
  if (topic === "onboarding.checklist") return { status: "absent", eligible: false, visible: false, finished: true, record: null };
  if (topic === "profile.team") return { team: null, invite: null };
  if (topic === "profile.usage") return { creditsRemaining: 5000, creditsLimit: 5000, plan: "pro" };
  if (topic === "settings.chatgptPlan") {
    return {
      status: { kind: "ready", status: { signIn: { kind: "available" }, usageEnabled: true, connections: [{ id: "conn-cli-core", email: "local@oibrowser.vn · CLI Core (5/5 Ready)", status: "active", selected: true }] } },
      firstUseNoticePending: false
    };
  }
  return {};
}

import { PROFILE_ID, toCompanionRuntime, buildLayoutSnapshot } from "./berry-electron-state.js";
import { getFruitImageUrl } from "./berry-fruit-lottie.js";
import { handleDomainInvoke, handleDomainQuery } from "./berry-electron-domains.js";

function oiUrlToLocalPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "/newtab";
  if (rawUrl.startsWith("/")) return rawUrl;
  if (rawUrl.startsWith("oi://")) {
    try {
      const u = new URL(rawUrl);
      let p = u.hostname === "-" ? u.pathname : `${u.hostname}${u.pathname}`;
      p = p === "splash" || p === "" ? "/newtab" : (p.startsWith("/") ? p : `/${p}`);
      return `${p}${u.search || ""}${u.hash || ""}`;
    } catch { return "/newtab"; }
  }
  return rawUrl;
}

function extractPromptText(messageInput) {
  if (!messageInput) return "Analyze current workspace";
  if (typeof messageInput === "string") return messageInput;
  if (typeof messageInput.message === "string") return messageInput.message;
  if (typeof messageInput.text === "string") return messageInput.text;
  if (typeof messageInput.content === "string") return messageInput.content;
  if (Array.isArray(messageInput.parts)) return messageInput.parts.map((p) => p.text || p.content || "").join(" ");
  return JSON.stringify(messageInput);
}

async function dispatchServerIpc(channel, payload, bridge) {
  try {
    const res = await fetch("/api/ipc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, payload })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.handled !== false) {
        if (/(create|update|delete|write|restore|run|save|clear|reset|register|remove|approve|set|import|add|edit|duplicate|force|submit|confirm|finish|provision|share|revoke)/i.test(channel)) {
          await bridge.fetchServerState();
        }
        return data;
      }
    }
  } catch {}
  return null;
}

export async function handleInvoke(eventName, payload = {}, bridge) {
  await bridge.readyPromise;
  const state = bridge.serverState;

  const domainRes = await handleDomainInvoke(eventName, payload, bridge);
  if (domainRes !== null) return domainRes;
  if (eventName === "auth:get") {
    return {
      user: { id: "user-local", email: "local@oibrowser.vn", name: "Ổi Browser Workspace", user_metadata: { name: "Ổi Browser Workspace", avatar_url: null } },
      access: { hasAccess: true, hasBeenInvited: true, inviteRedeemWindowOpen: false, onWaitlist: false, offboarded: false, legalGate: { status: "compliant" } },
      error: null, legalGateBinding: null, pendingSignupEmail: null, pendingVerificationAttemptId: null
    };
  }
  if (eventName === "auth:is-admin") return { isAdmin: true };
  if (eventName === "account:getCreditActivity") return { buckets: [], totalUsed: 0 };
  if (eventName === "account:getAutoTopupSettings") return { enabled: false, thresholdCredits: 500, refillCredits: 2500 };
  if (eventName === "account:get-or-create-invite-code") return { success: true, code: "BERRY-LOCAL", remainingInvites: 5 };
  if (eventName === "team:pending-invite" || eventName === "team:discover") return { success: true, invites: [], invite: null, teams: [] };
  if (eventName === "profile:get-all-profiles") {
    return (await dispatchServerIpc(eventName, payload, bridge)) || { profiles: [{ id: PROFILE_ID, name: "Ổi Workspace Local", email: "local@oibrowser.vn", isActive: true, isDefault: true }] };
  }
  if (eventName === "sandbox:get-boot-status") {
    return {
      status: "ready",
      message: "OpenJarvis Guardrails & CLI Sandbox active",
      progress: 100,
      reason: null,
      errorEventId: null,
      backendKind: "local-guardrails",
      isSandboxed: state.settings?.sandboxMode !== "unrestricted",
      repairAvailable: false
    };
  }
  if (eventName === "chat-permissions:get-sandbox-mode") return { mode: state.settings?.sandboxMode || "sandboxed" };
  if (eventName === "chat-permissions:set-sandbox-mode") {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "sandboxMode", value: payload.mode || "sandboxed" }) });
    await bridge.fetchServerState();
    return { success: true, mode: payload.mode || "sandboxed" };
  }
  if (eventName === "chat-permissions:get-mode") return { mode: state.settings?.chatPermissionMode || "ask" };
  if (eventName === "chat-permissions:set-mode") {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "chatPermissionMode", value: payload.mode || "ask" }) });
    await bridge.fetchServerState();
    return { success: true, mode: payload.mode || "ask" };
  }
  if (eventName === "chat-permissions:list-rules") return (await dispatchServerIpc(eventName, payload, bridge)) || { rules: [] };
  if (eventName === "search-engine:get") return { engine: state.settings?.searchEngine || "google", defaultEngine: state.settings?.searchEngine || "google" };
  if (eventName === "search-engine:set") {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "searchEngine", value: payload.engine || "google" }) });
    await bridge.fetchServerState();
    return { success: true };
  }
  if (eventName === "browser:is-default") return { isDefault: true };
  if (eventName === "adblocker:get-enabled") return { enabled: state.settings?.adblockerEnabled !== false };
  if (eventName === "extensions:get-all") return (await dispatchServerIpc(eventName, payload, bridge)) || { extensions: [] };
  if (eventName === "passwords:get-all") return (await dispatchServerIpc(eventName, payload, bridge)) || { passwords: [] };
  if (eventName === "app:get-version") return { version: "1.0.0" };
  if (eventName === "storage:get-info") {
    const usage = state.storageUsage || { wikiBytes: 4096, dbBytes: 32768, wikiFilesCount: 10 };
    return {
      totalBytes: usage.wikiBytes + usage.dbBytes,
      cacheBytes: 0,
      chatSessionsSize: usage.dbBytes,
      totalImages: 0,
      totalSessions: (state.companions || []).length
    };
  }
  if (eventName === "settings:get") {
    if (payload.key === "theme") return { value: { mode: bridge.themeMode, hue: 26, tint: 12 } };
    if (payload.key === "dismissedPrompts") return { value: { sidebarMenuIntroduction: { dontShowAgain: true }, libraryWorkspaceIntroduction: { dontShowAgain: true }, companionMemoryIntroduction: { dontShowAgain: true } } };
    return { value: state.settings?.[payload.key] ?? null };
  }
  if (eventName === "settings:set" || eventName === "settings:set-theme" || eventName === "settings:dismiss-prompt") {
    if (payload.mode || payload.value?.mode) bridge.setThemeMode(payload.mode || payload.value.mode);
    if (payload.key) {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: payload.key, value: payload.value }) });
      await bridge.fetchServerState();
    }
    return { success: true };
  }
  if (eventName === "companions:get-all") return { companions: (state.companions || []).map(toCompanionRuntime) };
  if (eventName === "companions:get-share-info") return { shares: {} };
  if (eventName === "companions:get-local-skills") {
    const comp = (state.companions || []).find((c) => c.id === payload.companionId);
    const skills = (comp?.skills || []).map((id) => ({ id, name: id, description: `Skill ${id} for ${comp.name}`, instructions: `# ${id}`, userInvocable: true, createdAt: 1730000000000, updatedAt: 1730000000000 }));
    return { skills };
  }
  if (eventName === "skills:list-folders") {
    const folders = (state.officialSkills || []).slice(0, 12).map((s, idx) => ({
      name: s.slug, frontmatter: { name: s.title, description: s.description, "user-invocable": "true" },
      instructions: `# ${s.title}\n\n${s.description}`, createdAt: 1730000000000 + idx, updatedAt: 1730000000000 + idx
    }));
    return { folders };
  }
  if (eventName === "chat:create-page-session") {
    const companionId = payload.companionId || "research-rosa";
    return { sessionId: bridge.getOrCreateSession(`session-${companionId}`, companionId).id };
  }
  if (eventName === "chat:completion-requested") {
    const compId = payload.companionId || payload.messageInput?.companionId || "research-rosa";
    const sess = bridge.getOrCreateSession(payload.sessionId || `session-${compId}`, compId);
    await bridge.sendUserChatTurn(sess.id, sess.companionId || compId, extractPromptText(payload.messageInput || payload.draftAtSubmit));
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/newtab")) setTimeout(() => { window.location.href = `/chat/${sess.id}`; }, 60);
    return { success: true, sessionId: sess.id, draftDisposition: "consumed", newTabPromoted: true, acceptedOperation: { operationId: `op-${Date.now()}`, kind: "message", createdAt: Date.now() } };
  }
  if (eventName === "chat:get-agent-downloads" || eventName === "downloads:get-history" || eventName === "downloads:get-recent") {
    return (await dispatchServerIpc(eventName, payload, bridge)) || { downloads: [] };
  }
  if (eventName === "chat:cached-recent-sessions-paged" || eventName === "chat:recent-sessions-paged" || eventName === "chat:search-sessions-paged" || eventName === "chat:pinned-sessions") {
    return { sessions: Object.values(bridge.sessionsById), nextCursor: null, hasMore: false, hasExcludedDone: false };
  }
  if (eventName === "chat:list-filesystem-grants") return { grants: [] };
  if (eventName === "synced-fs:get-pending-shares-state") return { success: true, state: { pendingShares: [], acceptanceRules: [] } };
  if (eventName === "knowledge:list-skills") {
    const personal = (state.officialSkills || []).slice(0, 6).map((s, idx) => ({
      name: s.slug || s.id, title: s.title || s.slug, description: s.description || "", instructionsPreview: s.description || "",
      sandboxPath: `/skills/${s.slug}/SKILL.md`, createdAt: 1730000000000 + idx, latestUpdatedAt: 1730000000000 + idx
    }));
    const official = (state.officialSkills || []).map((s, idx) => ({
      name: `oi/${s.category || "general"}/${s.slug || s.id}`, title: s.title || s.slug, description: s.description || "", instructionsPreview: s.description || "",
      sandboxPath: `/skills/oi/${s.category || "general"}/${s.slug || s.id}/SKILL.md`, createdAt: 1730000000000 + idx, latestUpdatedAt: 1730000000000 + idx
    }));
    return { skills: [...personal, ...official] };
  }
  if (eventName === "knowledge:list-tree") {
    return { children: (state.memoryFiles || []).map((f, i) => ({ id: `mem-${i}`, name: f.path, path: f.path, type: "file", updatedAt: f.updatedAt || Date.now(), size: f.size || 512 })) };
  }
  if (eventName === "knowledge:read-file") {
    const targetPath = payload.path || state.memoryFiles?.[0]?.path || "PROFILE.md";
    try {
      const res = await fetch(`/api/memory/file?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.content) return { path: targetPath, name: targetPath.split("/").pop(), content: data.content, updatedAt: Date.now() };
      }
    } catch {}
    return { path: targetPath, name: targetPath, content: `# ${targetPath}\n`, updatedAt: Date.now() };
  }
  if (eventName === "knowledge:read-report") {
    const reqId = payload.agentId || payload.id || String(payload.sandboxPath || "").replace(/^\/artifacts\/|\.md$/g, "");
    const a = (state.artifacts || []).find((x) => x.id === reqId) || (state.artifacts || [])[0] || { title: "Báo cáo Ổi Browser", content_markdown: "# Báo cáo" };
    return { content: a.content_markdown || `# ${a.title}`, title: a.title, timestamp: a.created_at || Date.now() };
  }
  if (eventName === "audio:get-manager-state") return { status: "idle", activeRecordingId: null };
  if (eventName === "audio:get-permissions") return { microphone: "granted", screen: "granted" };
  const ipcRes = await dispatchServerIpc(eventName, payload, bridge);
  if (ipcRes !== null) return ipcRes;
  return { success: true };
}

export async function handleQuery(query = {}, bridge) {
  await bridge.readyPromise;
  const { domain, action, payload = {} } = query;
  const key = `${domain}:${action}`;
  const state = bridge.serverState;

  const domainQueryRes = handleDomainQuery(key, payload, bridge);
  if (domainQueryRes !== null) return domainQueryRes;

  if (key === "profile:listAccountProfiles") {
    return { success: true, profiles: [{ id: PROFILE_ID, name: "Ổi Workspace Local", email: "local@oibrowser.vn", isActive: true }] };
  }
  if (key === "profile:getPasswordSaveBlockedDomains") return { success: true, domains: [] };
  if (key === "profile:getPaymentMethods") return { success: true, methods: [] };
  if (key === "syncedFs:storageUsage") {
    const locations = state.storageUsage?.locations || [
      { kind: "my-files", id: "my-files", name: "Karpathy-Wiki & Workspace", fileCount: (state.memoryFiles || []).length, sizeBytes: 16384, bytesUsed: 16384, sizeInBytes: 16384 }
    ];
    return { success: true, locations };
  }
  if (key === "companions:listOfficial") {
    return { companions: (state.companions || []).map((c) => ({ id: c.id, name: c.fullName || c.name, summary: c.summary, appearance: c.appearance, visualsSeed: c.visualsSeed || c.id, companionImage: getFruitImageUrl(c.id) })) };
  }
  if (key === "companions:getDockIconPreviews") return { appIcon: "/fruits-3d/guava.png", companions: Object.fromEntries((state.companions || []).map((c) => [c.id, getFruitImageUrl(c.id)])) };
  if (key === "companions:getDockIconDesignerAssets") return { mask: "/favicon.svg", rim: "/favicon.svg", shadow: "/favicon.svg" };
  if (key === "settings:getTeamCreditNotices") return { success: true, notices: [] };
  if (key === "companions:getHireReview" || key === "companions:getProfile") {
    const id = payload.officialCompanionId || payload.companionId || "consulting-cora";
    const c = (state.companions || []).find((x) => x.id === id) || state.companions?.[0];
    return {
      success: true, mode: "snapshot",
      profile: {
        companionId: c.id, contentHash: c.contentHash || c.id,
        profile: c.profile || { summary: c.summary, templateSkills: c.skills || [], about: c.summary },
        runtime: { name: c.fullName || c.name, description: c.summary, appearance: c.appearance, visualsSeed: c.visualsSeed || c.id, companionImage: getFruitImageUrl(c.id), defaultChatMode: "expert" },
        creator: { name: "Ổi Browser" }
      }
    };
  }
  if (key === "companions:hireProfile") return { success: true, mode: "snapshot", installedCompanionId: payload.officialCompanionId || payload.companionId || "consulting-cora" };
  if (key === "companions:getForSession") {
    const sess = bridge.getOrCreateSession(payload.sessionId || "session-rosa-1");
    const c = (state.companions || []).find((x) => x.id === sess.companionId) || state.companions?.[0];
    return { success: true, companion: toCompanionRuntime(c) };
  }
  if (key === "chat:loadSession" || key === "chat:snapshotSession" || key === "chat:request-load-session") {
    return { success: true, session: bridge.getOrCreateSession(payload.sessionId || "session-rosa-1") };
  }
  if (key === "chat:loadSessionMetadata") return { success: true, sessions: (payload.sessionIds || []).map((id) => bridge.getOrCreateSession(id)) };
  if (key === "chat:getModelCatalog") return { models: [{ id: "auto", label: "Auto (Berry Agent)", provider: "auto" }], defaultModelId: "auto" };
  if (key === "chat:loadDraftAttachments") return { attachments: [], autoAttachedTabs: [] };
  if (key === "chat:startCompanionSetup") {
    const compId = payload.companionId || "consulting-cora";
    return { success: true, sessionId: bridge.getOrCreateSession(`session-${compId}`, compId).id };
  }
  if (key === "syncedFs:library") {
    return {
      success: true,
      state: {
        revision: 1, artifactSessionId: "artifact-session-1",
        locations: [
          { id: "my-files", type: "my-files", name: "My files", hostRoot: "/berry/workspace", profileFolders: {} },
          { id: "shared-with-me", type: "shared", name: "Shared with me", pathPrefix: "shared-with-me", hostRoot: "/berry/shared" }
        ]
      }
    };
  }
  if (key === "syncedFs:listArtifacts") {
    const artifacts = (state.artifacts || []).map((a) => ({ path: `artifacts/${a.id}.md`, modifiedAtMs: a.created_at || Date.now(), sizeBytes: 2048, hostPath: `/berry/workspace/artifacts/${a.id}.md`, shares: [], chatId: "session-rosa-1" }));
    return { success: true, artifacts, cursor: null };
  }
  if (key === "syncedFs:listFolder" || key === "syncedFs:findFiles") {
    const entries = (state.memoryFiles || []).map((f) => ({ kind: "file", path: f.path, modifiedAtMs: f.updatedAt || Date.now(), sizeBytes: f.size || 512, hostPath: `/berry/workspace/${f.path}`, shares: [] }));
    return { success: true, entries, files: entries, total: entries.length, cursor: null };
  }
  if (key === "syncedFs:folderTrail") return { success: true, trail: [] };
  if (key === "onboarding:refreshChecklist" || key === "onboarding:dismissAllChecklistItems") return { success: true, state: { status: "absent", eligible: false, visible: false, finished: true, record: null } };
  if (key === "routines:listSuggestions") return { success: true, suggestions: [] };
  if (key === "routines:listRuns") {
    const rList = payload.routineId ? (state.routines || []).filter((r) => r.id === payload.routineId) : (state.routines || []);
    const runs = rList.filter((r) => r.last_run_at).map((r) => ({
      id: `run-${r.id}`, routineId: r.id, status: "completed", outcome: "completed",
      acceptedAt: new Date(r.last_run_at).toISOString(), finishedAt: new Date(r.last_run_at).toISOString(),
      sessionId: `session-${r.companion_id || "research-rosa"}`, summary: r.last_result || ""
    }));
    return { success: true, runs, nextCursor: null };
  }
  if (key === "layout:getWindow") return { success: true, snapshot: buildLayoutSnapshot(bridge) };
  if (key === "layout:get") return { success: true, data: { schemaVersion: 3, windows: [buildLayoutSnapshot(bridge).window], chats: buildLayoutSnapshot(bridge).chats }, pages: [] };
  if (key === "tabs:openUrl") {
    const targetPath = oiUrlToLocalPath(payload.url);
    if (targetPath.startsWith("/") && window.location.pathname + window.location.search !== targetPath) window.location.href = targetPath;
    return { success: true, tabId: "entry-1" };
  }
  const ipcRes = await dispatchServerIpc(key, payload, bridge);
  if (ipcRes !== null) return ipcRes;
  return { success: true, profileId: PROFILE_ID };
}

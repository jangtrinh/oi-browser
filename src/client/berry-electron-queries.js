import { PROFILE_ID, toCompanionRuntime, buildLayoutSnapshot } from "./berry-electron-state.js";
import { getFruitImageUrl } from "./berry-fruit-lottie.js";

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
  if (typeof messageInput.text === "string") return messageInput.text;
  if (typeof messageInput.content === "string") return messageInput.content;
  if (Array.isArray(messageInput.parts)) return messageInput.parts.map((p) => p.text || p.content || "").join(" ");
  return JSON.stringify(messageInput);
}

export async function handleInvoke(eventName, payload = {}, bridge) {
  await bridge.readyPromise;
  const state = bridge.serverState;

  if (eventName === "auth:get") {
    return {
      user: { id: "user-local", email: "local@oibrowser.vn", name: "Ổi Browser Workspace", user_metadata: { name: "Ổi Browser Workspace", avatar_url: null } },
      access: { hasAccess: true, hasBeenInvited: true, inviteRedeemWindowOpen: false, onWaitlist: false, offboarded: false, legalGate: { status: "compliant" } },
      error: null, legalGateBinding: null, pendingSignupEmail: null, pendingVerificationAttemptId: null
    };
  }
  if (eventName === "auth:is-admin") return { isAdmin: true };
  if (eventName === "account:get") {
    return {
      id: "user-local", email: "local@oibrowser.vn", name: "Ổi Browser Workspace", plan: "pro",
      usage: { creditsRemaining: 5000, creditsLimit: 5000, creditsUsed: 0 },
      subscriptionAccess: { hasAccess: true, totalCreditsRemaining: 5000, sources: [{ type: "personal", creditsRemaining: 5000, creditsLimit: 5000, creditsUsed: 0 }] },
      billingAccounts: { activeBillingAccountId: "bill-local", accounts: [{ id: "bill-local", name: "Ổi Browser Workspace", type: "personal" }] },
      team: null
    };
  }
  if (eventName === "account:getCreditActivity") return { buckets: [], totalUsed: 0 };
  if (eventName === "account:getAutoTopupSettings") return { enabled: false, thresholdCredits: 500, refillCredits: 2500 };
  if (eventName === "account:get-or-create-invite-code") return { success: true, code: "BERRY-LOCAL", remainingInvites: 5 };
  if (eventName === "team:pending-invite") return { success: true, invites: [], invite: null };
  if (eventName === "settings:get") {
    if (payload.key === "theme") return { value: { mode: bridge.themeMode, hue: 26, tint: 12 } };
    if (payload.key === "dismissedPrompts") return { value: { sidebarMenuIntroduction: { dontShowAgain: true }, libraryWorkspaceIntroduction: { dontShowAgain: true }, companionMemoryIntroduction: { dontShowAgain: true } } };
    return { value: null };
  }
  if (eventName === "settings:set" || eventName === "settings:set-theme" || eventName === "settings:dismiss-prompt") {
    if (payload.mode || payload.value?.mode) bridge.setThemeMode(payload.mode || payload.value.mode);
    return { success: true };
  }
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
    const sessionId = `session-${companionId}-${Date.now().toString(36).slice(-4)}`;
    bridge.getOrCreateSession(sessionId, companionId);
    return { sessionId };
  }
  if (eventName === "chat:completion-requested") {
    const sessionId = payload.sessionId || "session-rosa-1";
    const sess = bridge.getOrCreateSession(sessionId);
    const text = extractPromptText(payload.messageInput || payload.draftAtSubmit);
    await bridge.sendUserChatTurn(sess.id, sess.companionId, text);
    return {
      success: true, sessionId: sess.id, draftDisposition: "consumed", newTabPromoted: false,
      acceptedOperation: { operationId: `op-${Date.now()}`, kind: "message", createdAt: Date.now() }
    };
  }
  if (eventName === "chat:get-agent-downloads" || eventName === "downloads:get-history") return { downloads: [] };
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
  if (eventName === "knowledge:list-memory-roots") return { roots: [] };
  if (eventName === "knowledge:list-reports") return { reports: [], total: 0 };
  if (eventName === "knowledge:list-things-to-try") return { suggestions: [] };
  if (eventName === "knowledge:list-transcriptions") return { transcriptions: [] };
  if (eventName === "meetings:get-recent" || eventName === "audio:get-recordings") return { meetings: [], recordings: [] };
  if (eventName === "audio:get-manager-state") return { status: "idle", activeRecordingId: null };
  if (eventName === "audio:get-permissions") return { microphone: "granted", screen: "granted" };
  return { success: true };
}

export async function handleQuery(query = {}, bridge) {
  await bridge.readyPromise;
  const { domain, action, payload = {} } = query;
  const key = `${domain}:${action}`;
  const state = bridge.serverState;

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
  }  if (key === "companions:hireProfile") return { success: true, mode: "snapshot", installedCompanionId: payload.officialCompanionId || payload.companionId || "consulting-cora" };
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
  if (key === "syncedFs:libraryEntities") {
    const entities = (state.companions || []).map((c, idx) => ({ path: `companions/${c.id}`, modifiedAtMs: 1730000000000 + idx * 1000, hostPath: `/berry/workspace/companions/${c.id}`, shares: [], folders: 2, files: 4, companionId: c.id, presentation: { kind: "companion", id: c.id, name: c.fullName || c.name } }));
    return { success: true, entities };
  }
  if (key === "syncedFs:folderTrail") return { success: true, trail: [] };
  if (key === "meetings:list") {
    const meetings = (state.meetings || []).map((m) => ({ recordingId: m.id, title: m.title, stage: "ready", startedAt: new Date(m.created_at || Date.now()).toISOString(), durationSeconds: m.duration_sec || 240, participants: ["Jang Trinh", "Executive Ellis"], meetingPath: `meetings/${m.id}.md`, canTranscribe: false, recordedElsewhere: false }));
    return { success: true, meetings };
  }
  if (key === "memory:listCompanionNotes") return { success: true, notes: (state.memoryFiles || []).map((f) => ({ id: f.path, path: f.path, title: f.path, updatedAtMs: f.updatedAt || Date.now(), author: "companion" })), hasMore: false };
  if (key === "memory:listCompanionDreams") return { success: true, dreams: [] };
  if (key === "onboarding:refreshChecklist" || key === "onboarding:dismissAllChecklistItems") return { success: true, state: { status: "absent", eligible: false, visible: false, finished: true, record: null } };
  if (key === "routines:listSuggestions") return { success: true, suggestions: [] };
  if (key === "routines:listRuns") return { success: true, runs: [] };
  if (key === "layout:getWindow") return { success: true, snapshot: buildLayoutSnapshot() };
  if (key === "layout:get") return { success: true, data: { schemaVersion: 3, windows: [buildLayoutSnapshot().window], chats: { "session-rosa-1": { track: [] } } }, pages: [] };
  if (key === "tabs:openUrl") {
    const targetPath = oiUrlToLocalPath(payload.url);
    if (targetPath.startsWith("/") && window.location.pathname + window.location.search !== targetPath) window.location.href = targetPath;
    return { success: true, tabId: "entry-1" };
  }
  return { success: true, profileId: PROFILE_ID };
}

import { PROFILE_ID, WINDOW_ID, ENTRY_ID, buildRendererSession, resolveTopicState } from "./berry-electron-state.js";
import { handleInvoke, handleQuery } from "./berry-electron-queries.js";
import { preloadFruitLotties } from "./berry-fruit-lottie.js";
import { mountCliTerminalDock, updateCliDockState } from "./berry-cli-terminal-dock.js";

if (window.location.pathname === "/") {
  window.history.replaceState(null, "", `/newtab${window.location.search}${window.location.hash}`);
}

class BerryElectronBridge {
  constructor() {
    this.serverState = { tabs: [], companions: [], routines: [], artifacts: [], meetings: [], memoryFiles: [], messages: [], officialSkills: [], cliStatus: null };
    this.selectedHarnessId = "auto";
    this.sessionsById = {};
    this.stateListeners = new Map();
    this.signalListeners = new Set();
    this.eventListeners = new Map();
    const urlTheme = new URLSearchParams(window.location.search).get("theme");
    this.themeMode = urlTheme || localStorage.getItem("berry-theme") || "light";
    this.applyThemeDom();
    this.readyPromise = this.fetchServerState();
  }

  applyThemeDom() {
    const isDark = this.themeMode === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }

  setThemeMode(mode) {
    this.themeMode = mode === "dark" ? "dark" : "light";
    try { localStorage.setItem("berry-theme", this.themeMode); } catch {}
    this.applyThemeDom();
    this.publishState("ui.theme", PROFILE_ID);
    this.publishState("ui.theme", WINDOW_ID);
  }

  async fetchServerState() {
    try {
      const [res] = await Promise.all([fetch("/api/state"), preloadFruitLotties()]);
      if (res.ok) {
        this.serverState = await res.json();
        if (this.serverState.cliStatus) {
          this.selectedHarnessId = this.serverState.cliStatus.activeHarnessId || "auto";
          updateCliDockState(this.serverState.cliStatus);
        }
      }
    } catch {}
    this.rebuildSessions();
    this.flushAllStateSubscriptions();
    mountCliTerminalDock();
  }

  rebuildSessions() {
    const msgs = this.serverState.messages || [];
    const rosaMsgs = msgs.filter((m) => m.companion_id === "research-rosa");
    this.sessionsById["session-rosa-1"] = buildRendererSession(
      "session-rosa-1",
      "research-rosa",
      "Hồ sơ Kiến trúc Ổi Browser & Biệt đội Trái cây Việt",
      rosaMsgs
    );
    for (const c of this.serverState.companions || []) {
      const sid = `session-${c.id}`;
      const cMsgs = msgs.filter((m) => m.companion_id === c.id);
      this.sessionsById[sid] = buildRendererSession(sid, c.id, `Làm việc cùng ${c.fullName || c.name}`, cMsgs);
    }
  }

  getOrCreateSession(sessionId, fallbackCompanionId = "research-rosa") {
    if (!this.sessionsById[sessionId]) {
      const inferredComp = (this.serverState.companions || []).find((c) => sessionId.includes(c.id))?.id || fallbackCompanionId;
      const cMsgs = (this.serverState.messages || []).filter((m) => m.companion_id === inferredComp);
      this.sessionsById[sessionId] = buildRendererSession(sessionId, inferredComp, "Workspace Session", cMsgs);
    }
    return this.sessionsById[sessionId];
  }

  async sendUserChatTurn(sessionId, companionId, message) {
    const sess = this.getOrCreateSession(sessionId, companionId);
    const optimisticMsgs = [...(sess.messages || []), { id: `u-${Date.now()}`, sender: "user", role: "user", content: message, companionId, createdAt: Date.now() }];
    this.sessionsById[sessionId] = { ...sess, ...buildRendererSession(sessionId, companionId, message.slice(0, 48), optimisticMsgs), chatStatus: "loading" };
    this.flushAllStateSubscriptions();
    const liveCli = this.selectedHarnessId !== "local";
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionId, message, harnessId: this.selectedHarnessId, liveCli })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.allMessages) this.serverState.messages = data.allMessages;
      if (data.artifacts) this.serverState.artifacts = data.artifacts;
      if (data.memoryFiles) this.serverState.memoryFiles = data.memoryFiles;
      if (data.cliStatus) updateCliDockState(data.cliStatus);
      const updated = buildRendererSession(sessionId, companionId, message.slice(0, 48), data.messages || []);
      this.sessionsById[sessionId] = { ...sess, ...updated, chatStatus: "idle" };
      this.flushAllStateSubscriptions();
    }
  }

  publishState(topic, key) {
    const subKey = `${topic}:${key}`;
    const cbs = this.stateListeners.get(subKey);
    if (!cbs || cbs.size === 0) return;
    const state = resolveTopicState(topic, key, this);
    const packet = { subscriptionKey: subKey, topic, key, state };
    for (const cb of [...cbs]) {
      try { cb(packet); } catch (e) { console.error("[BerryBridge] state cb error:", subKey, e); }
    }
  }

  flushAllStateSubscriptions() {
    for (const subKey of this.stateListeners.keys()) {
      const idx = subKey.indexOf(":");
      if (idx > 0) this.publishState(subKey.slice(0, idx), subKey.slice(idx + 1));
    }
  }
}

const bridge = new BerryElectronBridge();
window.__berryBridge = bridge;

window.electronAPI = {
  getWindowId: () => WINDOW_ID,
  getProfileId: () => PROFILE_ID,
  getLayerId: () => `chat:chat-view:root:${ENTRY_ID}`,
  getLayerType: () => (window.location.pathname === "/shell" ? "ui" : window.location.pathname.startsWith("/ui/") ? "component" : "ui-tab"),
  sendUIEvent: (eventName, payload) => {
    if (eventName === "theme:set" && payload?.mode) bridge.setThemeMode(payload.mode);
  },
  sendIPCCommand: (cmd) => {
    if (cmd?.domain === "routines") {
      if (cmd.action === "runNow" && cmd.payload?.routineId) {
        fetch("/api/routines/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cmd.payload.routineId }) })
          .then(() => bridge.fetchServerState());
      } else if (cmd.action === "setEnabled" || cmd.action === "toggle") {
        fetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id: cmd.payload?.routineId || cmd.payload?.id, enabled: cmd.payload?.enabled }) })
          .then(() => bridge.fetchServerState());
      } else if (cmd.action === "delete" && (cmd.payload?.routineId || cmd.payload?.id)) {
        fetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: cmd.payload.routineId || cmd.payload.id }) })
          .then(() => bridge.fetchServerState());
      } else if (cmd.action === "create") {
        fetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cmd.payload || {}) })
          .then(() => bridge.fetchServerState());
      }
    }
  },
  onEvent: (eventName, cb) => {
    if (!bridge.eventListeners.has(eventName)) bridge.eventListeners.set(eventName, new Set());
    bridge.eventListeners.get(eventName).add(cb);
    return () => bridge.eventListeners.get(eventName)?.delete(cb);
  },
  subscribeMainEvent: () => {},
  unsubscribeMainEvent: () => {},
  onIPCSignal: (filter, cb) => {
    const entry = { filter, cb };
    bridge.signalListeners.add(entry);
    return () => bridge.signalListeners.delete(entry);
  },
  subscribeIPCSignal: () => {},
  unsubscribeIPCSignal: () => {},
  onIPCState: (subscriptionKey, cb) => {
    if (!bridge.stateListeners.has(subscriptionKey)) bridge.stateListeners.set(subscriptionKey, new Set());
    bridge.stateListeners.get(subscriptionKey).add(cb);
    return () => bridge.stateListeners.get(subscriptionKey)?.delete(cb);
  },
  subscribeIPCState: (topic, key) => {
    queueMicrotask(() => bridge.publishState(topic, key));
    bridge.readyPromise.then(() => bridge.publishState(topic, key));
  },
  unsubscribeIPCState: () => {},
  invoke: (eventName, payload) => handleInvoke(eventName, payload, bridge),
  invokeIPCQuery: (query) => handleQuery(query, bridge)
};

window.__dialogBridge = {
  onInit: () => () => {},
  sendAction: () => {},
  close: () => {}
};

let dockState = {
  open: false,
  busy: false,
  activeHarnessId: "auto",
  harnesses: [],
  recentRuns: []
};

function injectDockStyles() {
  if (typeof document === "undefined" || document.getElementById("oi-cli-dock-styles")) return;
  const style = document.createElement("style");
  style.id = "oi-cli-dock-styles";
  style.textContent = `
    #oi-cli-dock-root { position: fixed; left: 20px; bottom: 20px; z-index: 99990; font-family: inherit; color: oklch(var(--foreground)); }
    .oi-cli-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 10px; border-radius: 999px; background: oklch(var(--popover)); color: oklch(var(--popover-foreground)); border: 1px solid oklch(var(--border)); box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); cursor: pointer; font-size: 12.5px; font-weight: 500; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .oi-cli-pill:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05); }
    .oi-cli-pill-icon { width: 20px; height: 20px; object-fit: contain; }
    .oi-cli-dot { width: 7px; height: 7px; border-radius: 999px; background: oklch(var(--success-foreground)); box-shadow: 0 0 0 3px oklch(var(--success)); }
    .oi-cli-panel { width: 560px; max-width: calc(100vw - 40px); background: oklch(var(--popover)); color: oklch(var(--popover-foreground)); border: 1px solid oklch(var(--border)); border-radius: var(--composer-radius, 1.5rem); box-shadow: 0 20px 50px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04); overflow: hidden; margin-bottom: 10px; }
    .oi-cli-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 12px; border-bottom: 1px solid oklch(var(--border)); }
    .oi-cli-hdr-title { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: oklch(var(--foreground)); }
    .oi-cli-hdr-sub { font-size: 11.5px; font-weight: 400; color: oklch(var(--muted-foreground)); }
    .oi-cli-close { width: 28px; height: 28px; border-radius: 999px; border: none; background: var(--theme-surface); color: oklch(var(--muted-foreground)); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
    .oi-cli-close:hover { background: var(--theme-surface-hover); color: oklch(var(--foreground)); }
    .oi-cli-grid { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; background: var(--theme-surface-faint); border-bottom: 1px solid oklch(var(--border)); }
    .oi-cli-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 500; background: var(--theme-surface); color: oklch(var(--muted-foreground)); border: 1px solid transparent; cursor: pointer; transition: all 0.12s ease; }
    .oi-cli-chip:hover { background: var(--theme-surface-hover); color: oklch(var(--foreground)); }
    .oi-cli-chip.active { background: oklch(var(--background)); color: oklch(var(--foreground)); border-color: oklch(var(--border)); font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
    .oi-cli-affinity { padding: 8px 16px; font-size: 11px; color: oklch(var(--muted-foreground)); background: oklch(var(--background)); border-bottom: 1px solid oklch(var(--border)); display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
    .oi-cli-aff-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .oi-cli-aff-item img { width: 15px; height: 15px; object-fit: contain; }
    .oi-cli-term { height: 200px; overflow-y: auto; padding: 12px 16px; background: var(--theme-surface-subtle); display: flex; flex-direction: column; gap: 8px; scrollbar-width: thin; }
    .oi-cli-run { padding: 10px 12px; border-radius: var(--radius, 0.625rem); background: oklch(var(--background)); border: 1px solid oklch(var(--border)); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5; }
    .oi-cli-run-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .oi-cli-cmd { color: oklch(var(--foreground)); font-weight: 600; word-break: break-all; }
    .oi-cli-badge { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: oklch(var(--success)); color: oklch(var(--success-foreground)); white-space: nowrap; }
    .oi-cli-out { color: oklch(var(--muted-foreground)); white-space: pre-wrap; word-break: break-word; }
    .oi-cli-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px; background: oklch(var(--popover)); border-top: 1px solid oklch(var(--border)); }
    .oi-cli-qbtn { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--theme-surface); color: oklch(var(--muted-foreground)); border: 1px solid oklch(var(--border)); cursor: pointer; white-space: nowrap; }
    .oi-cli-qbtn:hover { background: var(--theme-surface-hover); color: oklch(var(--foreground)); }
    .oi-cli-form { display: flex; align-items: center; gap: 8px; padding: 10px 16px 14px; background: oklch(var(--popover)); }
    .oi-cli-input { flex: 1; background: var(--theme-surface); color: oklch(var(--foreground)); border: 1px solid oklch(var(--border)); border-radius: 999px; padding: 8px 14px; font-size: 12.5px; font-family: inherit; outline: none; }
    .oi-cli-input:focus { background: oklch(var(--background)); box-shadow: 0 0 0 2px oklch(var(--ring) / 0.25); }
    .oi-cli-send { background: oklch(var(--primary)); color: oklch(var(--primary-foreground)); font-weight: 600; font-size: 12px; border: none; border-radius: 999px; padding: 8px 16px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function updateCliDockState(cliStatus) {
  if (!cliStatus) return;
  dockState.activeHarnessId = cliStatus.activeHarnessId || dockState.activeHarnessId;
  dockState.harnesses = cliStatus.harnesses || dockState.harnesses;
  dockState.recentRuns = cliStatus.recentRuns || dockState.recentRuns;
  if (typeof window !== "undefined" && window.__berryBridge) {
    window.__berryBridge.selectedHarnessId = dockState.activeHarnessId;
  }
  renderCliDock();
}

async function selectHarness(harnessId) {
  dockState.activeHarnessId = harnessId;
  if (window.__berryBridge) window.__berryBridge.selectedHarnessId = harnessId;
  renderCliDock();
  try {
    const res = await fetch("/api/cli/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harnessId })
    });
    if (res.ok) updateCliDockState(await res.json());
  } catch {}
}

async function runCliCommand(harnessId, prompt, mode = "raw") {
  if (!prompt || dockState.busy) return;
  dockState.busy = true;
  renderCliDock();
  try {
    const res = await fetch("/api/cli/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harnessId: harnessId || dockState.activeHarnessId, prompt, mode })
    });
    if (res.ok) updateCliDockState((await res.json()).cliStatus);
  } catch {}
  dockState.busy = false;
  renderCliDock();
}

export function renderCliDock() {
  if (typeof document === "undefined") return;
  injectDockStyles();
  let root = document.getElementById("oi-cli-dock-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "oi-cli-dock-root";
    document.body.appendChild(root);
  }
  const totalBins = dockState.harnesses.filter((h) => h.binary).length || 5;
  const installedCount = dockState.harnesses.filter((h) => h.binary && h.installed).length;
  const activeSpec = dockState.harnesses.find((h) => h.id === dockState.activeHarnessId) || { badge: "AUTO", label: "Auto" };

  const panelHtml = dockState.open
    ? `<div class="oi-cli-panel" data-testid="oi-cli-panel">
        <div class="oi-cli-hdr">
          <div class="oi-cli-hdr-title">
            <img src="/fruits-3d/guava.png" class="oi-cli-pill-icon" alt="Ổi" />
            <span>Multi-CLI Harness</span>
            <span class="oi-cli-hdr-sub">· ${installedCount}/${totalBins} local CLIs ready</span>
          </div>
          <button class="oi-cli-close" id="oi-cli-close" aria-label="Close">✕</button>
        </div>
        <div class="oi-cli-grid">
          ${dockState.harnesses
            .map(
              (h) => `<button class="oi-cli-chip ${h.id === dockState.activeHarnessId ? "active" : ""}" data-harness="${h.id}" title="${escapeHtml(h.binaryPath || h.role || "")}">
                <span class="oi-cli-dot" style="opacity:${h.installed ? "1" : "0.3"}"></span>
                <span>${escapeHtml(h.label)}</span>
              </button>`
            )
            .join("")}
        </div>
        <div class="oi-cli-affinity">
          <span class="oi-cli-aff-item"><img src="/fruits-3d/guava.png" alt=""/>Ổi → <b>claude</b></span>
          <span class="oi-cli-aff-item"><img src="/fruits-3d/peach.png" alt=""/>Măng Cụt → <b>agy</b></span>
          <span class="oi-cli-aff-item"><img src="/fruits-3d/mango.png" alt=""/>Sầu Riêng → <b>grok</b></span>
          <span class="oi-cli-aff-item"><img src="/fruits-3d/mangosteen.png" alt=""/>Bưởi → <b>codex</b></span>
          <span class="oi-cli-aff-item"><img src="/fruits-3d/melon.png" alt=""/>Vú Sữa → <b>agy</b></span>
        </div>
        <div class="oi-cli-term" id="oi-cli-term-out">
          ${dockState.recentRuns
            .map(
              (r) => `<div class="oi-cli-run">
                <div class="oi-cli-run-top">
                  <span class="oi-cli-cmd">$ ${escapeHtml(r.commandLine)}</span>
                  <span class="oi-cli-badge">${escapeHtml(r.resolvedHarness)} · ${r.durationMs}ms</span>
                </div>
                <div class="oi-cli-out">${escapeHtml(r.stdout)}</div>
              </div>`
            )
            .join("")}
        </div>
        <div class="oi-cli-quick">
          <button class="oi-cli-qbtn" data-qharness="orca" data-qcmd="status --json">orca status --json</button>
          <button class="oi-cli-qbtn" data-qharness="claude" data-qcmd="--version">claude --version</button>
          <button class="oi-cli-qbtn" data-qharness="agy" data-qcmd="--help">agy --help</button>
          <button class="oi-cli-qbtn" data-qharness="codex" data-qcmd="--version">codex --version</button>
          <button class="oi-cli-qbtn" data-qharness="grok" data-qcmd="--help">grok --help</button>
        </div>
        <form class="oi-cli-form" id="oi-cli-form">
          <input class="oi-cli-input" id="oi-cli-input" placeholder="Chạy lệnh hoặc prompt với ${escapeHtml(activeSpec.label)}..." ${dockState.busy ? "disabled" : ""} />
          <button class="oi-cli-send" type="submit">${dockState.busy ? "Đang chạy..." : "Chạy >_"}</button>
        </form>
      </div>`
    : "";

  root.innerHTML = `${panelHtml}<button class="oi-cli-pill" id="oi-cli-toggle" data-testid="oi-cli-toggle"><img src="/fruits-3d/guava.png" class="oi-cli-pill-icon" alt=""/><span class="oi-cli-dot"></span><span>CLI Core: <b>${escapeHtml(activeSpec.badge || dockState.activeHarnessId.toUpperCase())}</b> (${installedCount}/${totalBins})</span></button>`;

  root.querySelector("#oi-cli-toggle")?.addEventListener("click", () => { dockState.open = !dockState.open; renderCliDock(); });
  root.querySelector("#oi-cli-close")?.addEventListener("click", () => { dockState.open = false; renderCliDock(); });
  root.querySelectorAll("[data-harness]").forEach((b) => b.addEventListener("click", () => selectHarness(b.getAttribute("data-harness"))));
  root.querySelectorAll("[data-qcmd]").forEach((b) => b.addEventListener("click", () => runCliCommand(b.getAttribute("data-qharness"), b.getAttribute("data-qcmd"), "raw")));
  root.querySelector("#oi-cli-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = root.querySelector("#oi-cli-input")?.value?.trim();
    if (val) runCliCommand(dockState.activeHarnessId, val, val.startsWith("--") || val.startsWith("status") ? "raw" : "exec");
  });
}

export async function mountCliTerminalDock() {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("cliDock") === "open") dockState.open = true;
  renderCliDock();
  try {
    const res = await fetch("/api/cli/status");
    if (res.ok) updateCliDockState(await res.json());
  } catch {}
}

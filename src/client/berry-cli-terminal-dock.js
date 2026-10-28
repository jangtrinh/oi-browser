let dockState = { open: false, busy: false, activeHarnessId: "auto", harnesses: [], recentRuns: [], telemetry: null, guardrails: null, skillCatalog: null };

const AFFINITIES = [
  { name: "Ổi · Research", img: "/fruits-3d/guava.png", cli: "claude" },
  { name: "Măng Cụt · Consulting", img: "/fruits-3d/mangosteen.png", cli: "agy" },
  { name: "Sầu Riêng · Recruiting", img: "/fruits-3d/durian.png", cli: "grok" },
  { name: "Thanh Long · Executive", img: "/fruits-3d/dragon-fruit.png", cli: "claude" },
  { name: "Bưởi · Engineering", img: "/fruits-3d/melon.png", cli: "codex" },
  { name: "Vú Sữa · Operations", img: "/fruits-3d/peach.png", cli: "agy" },
  { name: "Xoài · Sales", img: "/fruits-3d/mango.png", cli: "claude" },
  { name: "Chôm Chôm · Marketing", img: "/fruits-3d/raspberry.png", cli: "grok" },
  { name: "Vải · Support", img: "/fruits-3d/lychee.png", cli: "orca" }
];

function injectDockStyles() {
  if (typeof document === "undefined" || document.getElementById("oi-cli-dock-styles")) return;
  const style = document.createElement("style");
  style.id = "oi-cli-dock-styles";
  style.textContent = `
    .oi-sidebar-cli-link { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 32px; padding: 0 8px; margin-top: 2px; border-radius: 8px; font-family: inherit; font-size: 13.5px; color: oklch(var(--foreground) / 0.8); text-decoration: none; cursor: pointer; transition: background 0.12s ease, color 0.12s ease; }
    .oi-sidebar-cli-link:hover { background: var(--theme-surface-hover, rgba(0,0,0,0.04)); color: oklch(var(--foreground)); }
    .oi-sidebar-cli-left { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
    .oi-sidebar-cli-badge { display: inline-flex; align-items: center; gap: 5px; padding: 1px 8px; border-radius: 9999px; font-family: inherit; font-variant-numeric: tabular-nums; font-size: 11px; font-weight: 500; background: oklch(var(--muted)); color: oklch(var(--muted-foreground)); border: 1px solid oklch(var(--border) / 0.8); }
    .oi-cli-dot { width: 6px; height: 6px; border-radius: 9999px; background: #15803d; flex-shrink: 0; }
    .oi-cli-dot.offline { background: oklch(var(--muted-foreground) / 0.35); }
    [data-testid="ai-provider-settings"] > div:not(#oi-cli-settings-host):not(:first-child) { display: none !important; }
    .oi-cli-settings-wrap { margin-top: 8px; display: flex; flex-direction: column; gap: 18px; color: oklch(var(--foreground)); font-family: inherit; }
    .oi-cli-card { background: oklch(var(--background)); border: 1px solid oklch(var(--border)); border-radius: 16px; overflow: hidden; }
    .oi-cli-card-hdr { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid oklch(var(--border) / 0.7); background: oklch(var(--card) / 0.45); }
    .oi-cli-card-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: oklch(var(--foreground)); }
    .oi-cli-card-title img { width: 22px; height: 22px; object-fit: contain; }
    .oi-cli-card-sub { font-size: 12.5px; color: oklch(var(--muted-foreground)); margin-top: 2px; }
    .oi-cli-status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-family: inherit; font-variant-numeric: tabular-nums; font-size: 11.5px; font-weight: 600; background: #dcfce7; color: #166534; white-space: nowrap; flex-shrink: 0; }
    .oi-cli-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 20px; border-bottom: 1px solid oklch(var(--border) / 0.55); }
    .oi-cli-row:last-child { border-bottom: none; }
    .oi-cli-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .oi-cli-row-top { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 500; color: oklch(var(--foreground)); }
    .oi-cli-role-tag { padding: 1px 8px; border-radius: 9999px; font-family: inherit; font-size: 11px; font-weight: 500; background: oklch(var(--muted)); color: oklch(var(--muted-foreground)); }
    .oi-cli-row-path { font-family: inherit; font-size: 12px; color: oklch(var(--muted-foreground)); }
    .oi-cli-select-btn { padding: 5px 14px; border-radius: 9999px; font-family: inherit; font-size: 12px; font-weight: 500; border: 1px solid oklch(var(--border)); background: oklch(var(--background)); color: oklch(var(--foreground)); cursor: pointer; transition: all 0.12s ease; white-space: nowrap; }
    .oi-cli-select-btn:hover { background: oklch(var(--muted)); }
    .oi-cli-select-btn.active { background: #b9382c; color: #ffffff; border-color: #b9382c; font-weight: 600; }
    .oi-cli-tel-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 14px 20px; }
    .oi-cli-tel-box { padding: 10px 12px; border-radius: 12px; border: 1px solid oklch(var(--border) / 0.7); background: oklch(var(--card) / 0.35); }
    .oi-cli-tel-lbl { font-size: 11.5px; color: oklch(var(--muted-foreground)); }
    .oi-cli-tel-val { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; color: oklch(var(--foreground)); margin-top: 2px; }
    .oi-cli-aff-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px 20px; }
    .oi-cli-aff-cell { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border-radius: 10px; border: 1px solid oklch(var(--border) / 0.7); background: oklch(var(--card) / 0.35); font-size: 12.5px; }
    .oi-cli-aff-who { display: inline-flex; align-items: center; gap: 7px; font-weight: 500; color: oklch(var(--foreground)); }
    .oi-cli-aff-who img { width: 20px; height: 20px; object-fit: contain; }
    .oi-cli-aff-cli { font-family: inherit; font-size: 11.5px; color: oklch(var(--muted-foreground)); font-weight: 600; }
    .oi-cli-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 20px; background: oklch(var(--card) / 0.3); border-bottom: 1px solid oklch(var(--border) / 0.6); }
    .oi-cli-qbtn { padding: 4px 10px; border-radius: 9999px; font-family: inherit; font-size: 11.5px; font-weight: 500; background: oklch(var(--background)); color: oklch(var(--muted-foreground)); border: 1px solid oklch(var(--border)); cursor: pointer; }
    .oi-cli-qbtn:hover { color: oklch(var(--foreground)); background: oklch(var(--muted)); }
    .oi-cli-form { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-bottom: 1px solid oklch(var(--border) / 0.6); }
    .oi-cli-input { flex: 1; font-family: inherit; background: oklch(var(--background)); color: oklch(var(--foreground)); border: 1px solid oklch(var(--border)); border-radius: 9999px; padding: 8px 14px; font-size: 12.5px; outline: none; }
    .oi-cli-input:focus { border-color: #b9382c; box-shadow: 0 0 0 2px rgba(185,56,44,0.15); }
    .oi-cli-send { font-family: inherit; background: #b9382c; color: #ffffff; font-weight: 600; font-size: 12px; border: none; border-radius: 9999px; padding: 8px 16px; cursor: pointer; }
    .oi-cli-term { max-height: 180px; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 8px; background: oklch(var(--card) / 0.25); }
    .oi-cli-run { padding: 10px 12px; border-radius: 10px; background: oklch(var(--background)); border: 1px solid oklch(var(--border) / 0.8); font-family: inherit; font-size: 12px; }
    .oi-cli-run-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .oi-cli-cmd { font-weight: 600; color: oklch(var(--foreground)); }
    .oi-cli-badge { padding: 1px 8px; border-radius: 9999px; font-size: 11px; font-variant-numeric: tabular-nums; background: #dcfce7; color: #166534; font-weight: 600; }
    .oi-cli-out { color: oklch(var(--muted-foreground)); white-space: pre-wrap; word-break: break-word; }
  `;
  document.head.appendChild(style);
}

const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function updateCliDockState(cliStatus) {
  if (!cliStatus) return;
  Object.assign(dockState, {
    activeHarnessId: cliStatus.activeHarnessId || dockState.activeHarnessId,
    harnesses: cliStatus.harnesses || dockState.harnesses,
    recentRuns: cliStatus.recentRuns || dockState.recentRuns,
    telemetry: cliStatus.telemetry || dockState.telemetry,
    guardrails: cliStatus.guardrails || dockState.guardrails,
    skillCatalog: cliStatus.skillCatalog || dockState.skillCatalog
  });
  if (typeof window !== "undefined" && window.__berryBridge) window.__berryBridge.selectedHarnessId = dockState.activeHarnessId;
  renderCliDock(true);
}

async function selectHarness(harnessId) {
  dockState.activeHarnessId = harnessId;
  if (window.__berryBridge) window.__berryBridge.selectedHarnessId = harnessId;
  renderCliDock(true);
  try {
    const res = await fetch("/api/cli/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ harnessId }) });
    if (res.ok) updateCliDockState(await res.json());
  } catch {}
}

async function runCliCommand(harnessId, prompt, mode = "raw") {
  if (!prompt || dockState.busy) return;
  dockState.busy = true;
  renderCliDock(true);
  try {
    const res = await fetch("/api/cli/exec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ harnessId: harnessId || dockState.activeHarnessId, prompt, mode }) });
    if (res.ok) updateCliDockState((await res.json()).cliStatus);
  } catch {}
  dockState.busy = false;
  renderCliDock(true);
}

function buildSettingsPanelHtml(installedCount, totalBins, activeSpec) {
  const tel = dockState.telemetry || { intelligencePerWattScore: 136.4, totalTokens: 1155, avgLatencyMs: 246, avgRssMb: 78.9 };
  const gr = dockState.guardrails || { totalScans: 3 };
  const sk = dockState.skillCatalog || { totalIndexedSkills: 31 };
  return `<div class="oi-cli-settings-wrap" data-testid="oi-cli-panel">
    <section class="oi-cli-card">
      <div class="oi-cli-card-hdr"><div><div class="oi-cli-card-title"><img src="/fruits-3d/guava.png" alt="Ổi" /><span>CLI Core — OpenJarvis Adaptive Harness Router</span></div><div class="oi-cli-card-sub">Điều phối tự động Biệt đội Trái cây qua các CLI cục bộ trên máy với chuỗi dự phòng thông minh (Cascade Fallback).</div></div><span class="oi-cli-status-pill"><span class="oi-cli-dot"></span>${installedCount}/${totalBins} CLIs Ready</span></div>
      <div>${dockState.harnesses.map((h) => {
        const isSel = h.id === dockState.activeHarnessId;
        return `<div class="oi-cli-row"><div class="oi-cli-row-main"><div class="oi-cli-row-top"><span class="oi-cli-dot ${h.installed || h.id === "auto" ? "" : "offline"}"></span><span>${escapeHtml(h.label)}</span><span class="oi-cli-role-tag">${escapeHtml(h.badge || h.id.toUpperCase())}</span></div><div class="oi-cli-row-path">${escapeHtml(h.role || h.binaryPath || "Automatic companion-affinity routing")}</div></div><button class="oi-cli-select-btn ${isSel ? "active" : ""}" data-harness="${h.id}">${isSel ? "Selected" : "Select"}</button></div>`;
      }).join("")}</div>
    </section>
    <section class="oi-cli-card">
      <div class="oi-cli-card-hdr"><div><div class="oi-cli-card-title"><span>OpenJarvis Local Telemetry & Guardrails</span></div><div class="oi-cli-card-sub">Đo lường hiệu năng phần cứng (Intelligence Per Watt), bộ lọc bảo mật PII/Secret và danh mục ${sk.totalIndexedSkills} kỹ năng XML.</div></div><span class="oi-cli-status-pill"><span class="oi-cli-dot"></span>Guardrails: ${gr.totalScans} scans</span></div>
      <div class="oi-cli-tel-grid">
        <div class="oi-cli-tel-box"><div class="oi-cli-tel-lbl">Intelligence / Watt</div><div class="oi-cli-tel-val">${tel.intelligencePerWattScore} tok/J</div></div>
        <div class="oi-cli-tel-box"><div class="oi-cli-tel-lbl">Tổng Tokens xử lý</div><div class="oi-cli-tel-val">${tel.totalTokens}</div></div>
        <div class="oi-cli-tel-box"><div class="oi-cli-tel-lbl">Độ trễ trung bình</div><div class="oi-cli-tel-val">${tel.avgLatencyMs} ms</div></div>
        <div class="oi-cli-tel-box"><div class="oi-cli-tel-lbl">Bộ nhớ RSS cục bộ</div><div class="oi-cli-tel-val">${tel.avgRssMb} MB</div></div>
      </div>
    </section>
    <section class="oi-cli-card">
      <div class="oi-cli-card-hdr"><div><div class="oi-cli-card-title"><span>Companion → CLI Affinity Matrix</span></div><div class="oi-cli-card-sub">Ánh xạ mặc định khi bật chế độ Auto Router cho 9 trợ lý trái cây.</div></div></div>
      <div class="oi-cli-aff-grid">${AFFINITIES.map((a) => `<div class="oi-cli-aff-cell"><span class="oi-cli-aff-who"><img src="${a.img}" alt="${a.name}" /><span>${a.name}</span></span><span class="oi-cli-aff-cli">${a.cli}</span></div>`).join("")}</div>
    </section>
    <section class="oi-cli-card">
      <div class="oi-cli-card-hdr"><div><div class="oi-cli-card-title"><span>Interactive CLI Diagnostic & Runner</span></div><div class="oi-cli-card-sub">Kiểm tra trực tiếp phiên bản, trạng thái và thực thi lệnh qua ${escapeHtml(activeSpec.label)}.</div></div></div>
      <div class="oi-cli-quick">
        <button class="oi-cli-qbtn" data-qharness="orca" data-qcmd="status --json">orca status --json</button>
        <button class="oi-cli-qbtn" data-qharness="claude" data-qcmd="--version">claude --version</button>
        <button class="oi-cli-qbtn" data-qharness="agy" data-qcmd="--help">agy --help</button>
        <button class="oi-cli-qbtn" data-qharness="codex" data-qcmd="--version">codex --version</button>
        <button class="oi-cli-qbtn" data-qharness="grok" data-qcmd="--help">grok --help</button>
      </div>
      <form class="oi-cli-form" id="oi-cli-form"><input class="oi-cli-input" id="oi-cli-input" placeholder="Chạy lệnh hoặc prompt với ${escapeHtml(activeSpec.label)}..." ${dockState.busy ? "disabled" : ""} /><button class="oi-cli-send" type="submit">${dockState.busy ? "Đang chạy..." : "Chạy lệnh"}</button></form>
      <div class="oi-cli-term" id="oi-cli-term-out">${dockState.recentRuns.map((r) => `<div class="oi-cli-run"><div class="oi-cli-run-top"><span class="oi-cli-cmd">${escapeHtml(r.commandLine)}</span><span class="oi-cli-badge">${escapeHtml(r.resolvedHarness)} · ${r.durationMs}ms</span></div><div class="oi-cli-out">${escapeHtml(r.stdout)}</div></div>`).join("")}</div>
    </section>
  </div>`;
}

export function renderCliDock(force = false) {
  if (typeof document === "undefined") return;
  injectDockStyles();
  const totalBins = dockState.harnesses.filter((h) => h.binary).length || 5;
  const installedCount = dockState.harnesses.filter((h) => h.binary && h.installed).length || 5;
  const activeSpec = dockState.harnesses.find((h) => h.id === dockState.activeHarnessId) || { badge: "AUTO", label: "Auto Router" };

  const libBtn = Array.from(document.querySelectorAll(".home-sidebar-layout button, .home-sidebar-layout a")).find((el) => el.textContent?.trim() === "Library");
  const libRow = libBtn?.closest("li, div") || libBtn;
  if (libRow && libRow.parentElement) {
    let navItem = document.getElementById("oi-sidebar-cli-settings-link");
    if (!navItem || force) {
      if (!navItem) {
        navItem = Object.assign(document.createElement("a"), { id: "oi-sidebar-cli-settings-link", className: "oi-sidebar-cli-link", href: "/settings/ai-provider" });
        navItem.setAttribute("data-testid", "oi-cli-toggle");
        libRow.insertAdjacentElement("afterend", navItem);
      }
      navItem.innerHTML = `<span class="oi-sidebar-cli-left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><span>CLI Core</span></span><span class="oi-sidebar-cli-badge"><span class="oi-cli-dot"></span>${escapeHtml(activeSpec.badge || dockState.activeHarnessId.toUpperCase())} ${installedCount}/${totalBins}</span>`;
    }
  }

  const aiProviderHost = document.querySelector('[data-testid="ai-provider-settings"]');
  if (aiProviderHost) {
    let container = document.getElementById("oi-cli-settings-host");
    if (!container || force) {
      if (!container) {
        container = Object.assign(document.createElement("div"), { id: "oi-cli-settings-host" });
        aiProviderHost.insertBefore(container, aiProviderHost.children[1] || null);
      }
      container.innerHTML = buildSettingsPanelHtml(installedCount, totalBins, activeSpec);
      container.querySelectorAll("[data-harness]").forEach((b) => b.addEventListener("click", () => selectHarness(b.getAttribute("data-harness"))));
      container.querySelectorAll("[data-qcmd]").forEach((b) => b.addEventListener("click", () => runCliCommand(b.getAttribute("data-qharness"), b.getAttribute("data-qcmd"), "raw")));
      container.querySelector("#oi-cli-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = container.querySelector("#oi-cli-input")?.value?.trim();
        if (val) runCliCommand(dockState.activeHarnessId, val, val.startsWith("--") || val.startsWith("status") ? "raw" : "exec");
      });
    }
  }
}

export async function mountCliTerminalDock() {
  if (typeof window === "undefined") return;
  renderCliDock(true);
  new MutationObserver(() => renderCliDock(false)).observe(document.body, { childList: true, subtree: true });
  try {
    const res = await fetch("/api/cli/status");
    if (res.ok) updateCliDockState(await res.json());
  } catch {}
}

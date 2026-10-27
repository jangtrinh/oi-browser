import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteWorkspaceStore } from "./sqlite-workspace-store.js";
import { KarpathyWikiMemoryEngine } from "./karpathy-wiki-memory-engine.js";
import { AgentDOMBrowserService } from "./agent-dom-browser-service.js";
import { CompanionChatOrchestrator } from "./companion-chat-orchestrator.js";
import { OFFICIAL_SKILLS } from "./official-companions-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8"
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 2_000_000) reject(new Error("Payload too large")); });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export function createBerryServer({ dataDir = path.join(PROJECT_ROOT, ".berry-data") } = {}) {
  const store = new SqliteWorkspaceStore(path.join(dataDir, "workspace.sqlite"));
  const memory = new KarpathyWikiMemoryEngine(path.join(dataDir, "karpathy-wiki"));
  const domService = new AgentDOMBrowserService();
  const orchestrator = new CompanionChatOrchestrator({ store, memory, domService });
  const publicDir = path.join(PROJECT_ROOT, "public");
  const clientDir = path.join(PROJECT_ROOT, "src/client");

  const server = http.createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = new URL(req.url, "http://127.0.0.1:4104");

      if (pathname === "/api/state" && req.method === "GET") {
        return sendJson(res, 200, {
          tabs: store.listTabs(), companions: store.listCompanions(), routines: store.listRoutines(),
          artifacts: store.listArtifacts(), meetings: store.listMeetings(), memoryFiles: memory.listFiles(),
          messages: store.listAllMessages(), officialSkills: OFFICIAL_SKILLS
        });
      }

      if (pathname === "/api/tabs" && req.method === "POST") {
        const body = await readJsonBody(req);
        if (body.action === "close") return sendJson(res, 200, { tabs: store.closeTab(body.id) });
        if (body.action === "update") {
          const url = body.url ? domService.normalizeUrl(body.url) : undefined;
          const surfaceKind = url ? (url.startsWith("berry://") ? url.replace("berry://", "") : "web") : undefined;
          store.updateTab(body.id, { ...body, url, surfaceKind });
          return sendJson(res, 200, { tabs: store.listTabs() });
        }
        const url = domService.normalizeUrl(body.url || "berry://newtab");
        const surfaceKind = url.startsWith("berry://") ? url.replace("berry://", "") : "web";
        const tab = store.createTab({ title: body.title || url, url, surfaceKind, activate: true });
        return sendJson(res, 200, { tab, tabs: store.listTabs() });
      }

      if (pathname === "/api/companions" && req.method === "POST") {
        const created = store.createCompanion(await readJsonBody(req));
        memory.writeFile(`companions/${created.id}/COMPANION.md`, `# ${created.name} — Companion Memory\n\n- **Role**: ${created.role}\n- **Summary**: ${created.summary}\n`);
        return sendJson(res, 200, { companion: created, companions: store.listCompanions() });
      }

      if (pathname === "/api/chat" && req.method === "GET") {
        return sendJson(res, 200, { messages: store.listMessages(searchParams.get("companionId") || "consulting-cora") });
      }

      if (pathname === "/api/chat" && req.method === "POST") {
        const body = await readJsonBody(req);
        const result = await orchestrator.handleUserTurn(body);
        return sendJson(res, 200, {
          ...result, messages: store.listMessages(body.companionId || "consulting-cora"),
          allMessages: store.listAllMessages(), artifacts: store.listArtifacts(), memoryFiles: memory.listFiles()
        });
      }

      if (pathname === "/api/browser/inspect" && req.method === "GET") {
        const snap = await domService.inspectUrl(searchParams.get("url") || "https://oibrowser.vn");
        return sendJson(res, 200, { ...snap, html: undefined });
      }

      if (pathname === "/api/browser/proxy" && req.method === "GET") {
        const html = await domService.renderProxiedHtml(searchParams.get("url") || "https://oibrowser.vn");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }

      if (pathname === "/api/routines" && req.method === "POST") {
        const routine = store.createRoutine(await readJsonBody(req));
        return sendJson(res, 200, { routine, routines: store.listRoutines() });
      }

      if (pathname === "/api/routines/run" && req.method === "POST") {
        const { id } = await readJsonBody(req);
        const routine = store.listRoutines().find((r) => r.id === id);
        if (!routine) return sendJson(res, 404, { error: "Routine not found" });
        const turn = await orchestrator.handleUserTurn({ companionId: routine.companion_id, message: `[Routine: ${routine.label}] ${routine.prompt}` });
        const updated = store.recordRoutineRun(id, turn.assistantMessage.content);
        return sendJson(res, 200, { routine: updated, routines: store.listRoutines(), artifact: turn.artifact });
      }

      if (pathname === "/api/memory/file" && req.method === "GET") {
        const filePath = searchParams.get("path") || "PROFILE.md";
        return sendJson(res, 200, { path: filePath, content: memory.readFile(filePath), files: memory.listFiles() });
      }

      if (pathname === "/api/memory/file" && req.method === "POST") {
        const { path: filePath, content } = await readJsonBody(req);
        return sendJson(res, 200, { saved: memory.writeFile(filePath, content), files: memory.listFiles() });
      }

      if (pathname === "/api/memory/dream" && req.method === "POST") {
        const { companionId } = await readJsonBody(req);
        return sendJson(res, 200, { dream: memory.runDreamConsolidation(companionId || "executive-ellis"), files: memory.listFiles() });
      }

      if (pathname === "/api/artifacts" && req.method === "POST") {
        const artifact = store.createArtifact(await readJsonBody(req));
        return sendJson(res, 200, { artifact, artifacts: store.listArtifacts() });
      }

      if (pathname === "/api/meetings" && req.method === "POST") {
        const body = await readJsonBody(req);
        const lines = String(body.transcriptText || "").split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
        const actionItems = lines.slice(0, 4).map((l, i) => `Action #${i + 1}: ${l}`);
        const summaryMarkdown = `### Meeting Summary\n- **Title**: ${body.title}\n- **Key Points**: ${lines.slice(0, 3).join("; ") || "Recorded session"}`;
        const meeting = store.createMeeting({ ...body, summaryMarkdown, actionItems });
        memory.appendObservation({ companionId: "executive-ellis", summary: `Transcribed meeting "${meeting.title}" (${actionItems.length} action items)` });
        return sendJson(res, 200, { meeting, meetings: store.listMeetings() });
      }

      const relPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.replace(/^\/+/, ""));
      for (const baseDir of [publicDir, clientDir]) {
        const candidate = path.resolve(baseDir, relPath);
        if (candidate.startsWith(baseDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(candidate)] || "application/octet-stream" });
          return fs.createReadStream(candidate).pipe(res);
        }
      }

      if (!path.extname(relPath)) {
        const spaHtml = path.join(publicDir, "index.html");
        if (fs.existsSync(spaHtml)) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          return fs.createReadStream(spaHtml).pipe(res);
        }
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  return { server, store, memory, domService, orchestrator };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIdx = process.argv.indexOf("--port");
  const port = portIdx !== -1 ? Number(process.argv[portIdx + 1]) : 4104;
  const { server } = createBerryServer();
  server.listen(port, "127.0.0.1", () => console.log(`Ổi Browser server listening on http://127.0.0.1:${port}`));
}

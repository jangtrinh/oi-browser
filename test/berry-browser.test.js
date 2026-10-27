import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBerryServer } from "../src/server/berry-http-server.js";

test("Ổi Browser full-stack verification suite", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-browser-test-"));
  const { server } = createBerryServer({ dataDir: tmpDir });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("GET /api/state returns 9 official companions, seeded tabs, 5 routines, Karpathy-Wiki files, and cliStatus", async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.companions.length, 9);
    assert.ok(data.companions.some((c) => c.id === "consulting-cora" && c.appearance?.color?.body));
    assert.ok(data.companions.some((c) => c.id === "developer-dana" && c.appearance?.head?.type));
    assert.equal(data.officialSkills.length, 31);
    assert.equal(data.routines.length, 5);
    assert.ok(data.tabs.length >= 4);
    assert.ok(data.memoryFiles.some((f) => f.path === "PROFILE.md"));
    assert.ok(data.cliStatus);
    assert.equal(data.cliStatus.activeHarnessId, "auto");
    assert.equal(data.cliStatus.harnesses.length, 7);
  });

  await t.test("GET /api/cli/status, POST /api/cli/select, and POST /api/cli/exec discover and run Multi-CLI Harnesses", async () => {
    const statusRes = await fetch(`${baseUrl}/api/cli/status`);
    assert.equal(statusRes.status, 200);
    const status = await statusRes.json();
    const ids = status.harnesses.map((h) => h.id);
    assert.deepEqual(ids, ["auto", "claude", "agy", "codex", "grok", "orca", "local"]);
    assert.equal(status.companionAffinities["consulting-cora"], "claude");
    assert.equal(status.companionAffinities["research-rosa"], "agy");
    assert.equal(status.companionAffinities["developer-dana"], "codex");

    const selectRes = await fetch(`${baseUrl}/api/cli/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harnessId: "agy" })
    });
    assert.equal(selectRes.status, 200);
    const selected = await selectRes.json();
    assert.equal(selected.activeHarnessId, "agy");

    const execRes = await fetch(`${baseUrl}/api/cli/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harnessId: "local", companionId: "consulting-cora", prompt: "Inspect workspace architecture", mode: "simulated" })
    });
    assert.equal(execRes.status, 200);
    const execData = await execRes.json();
    assert.equal(execData.run.exitCode, 0);
    assert.equal(execData.run.resolvedHarness, "local");
    assert.ok(execData.run.stdout.includes("Local Deterministic"));
  });

  await t.test("GET /newtab serves Ổi Browser SvelteKit 5 UI with Right-Hand-Side Sidebar and 3D fruit assets", async () => {
    const spaRes = await fetch(`${baseUrl}/newtab?layerId=chat:chat-view:root:entry-1`);
    assert.equal(spaRes.status, 200);
    const html = await spaRes.text();
    assert.ok(html.includes("/berry-electron-bridge.js"));
    assert.ok(html.includes("/_app/immutable/entry/start.DpNOqzh1.js"));
    assert.ok(html.includes("flex-direction: row-reverse"));

    const bridgeRes = await fetch(`${baseUrl}/berry-electron-bridge.js`);
    assert.equal(bridgeRes.status, 200);

    const dockRes = await fetch(`${baseUrl}/berry-cli-terminal-dock.js`);
    assert.equal(dockRes.status, 200);

    const manifestRes = await fetch(`${baseUrl}/models/asset-manifest.json`);
    assert.equal(manifestRes.status, 200);

    const fruitJsonRes = await fetch(`${baseUrl}/fruits/rambutan.json`);
    assert.equal(fruitJsonRes.status, 200);

    const fruit3dRes = await fetch(`${baseUrl}/fruits-3d/guava.png`);
    assert.equal(fruit3dRes.status, 200);
  });

  await t.test("POST /api/chat executes AgentDOMBrowserService, dispatches CLI Harness, creates Visual Artifact, and logs Karpathy-Wiki observation", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companionId: "research-rosa",
        message: "Extract a table spreadsheet from berry://newtab",
        activeUrl: "berry://newtab",
        harnessId: "auto"
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assistantMessage.sender, "assistant");
    assert.ok(data.assistantMessage.toolCalls.some((tc) => tc.tool === "cli_harness_dispatch"));
    assert.equal(data.artifact.kind, "spreadsheet");
    assert.ok(data.memoryFiles.some((f) => f.path.startsWith("observations/")));
  });

  await t.test("POST /api/memory/dream consolidates observations into COMPANION.md", async () => {
    const res = await fetch(`${baseUrl}/api/memory/dream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionId: "research-rosa" })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.dream.updatedFile, "companions/research-rosa/COMPANION.md");

    const fileRes = await fetch(`${baseUrl}/api/memory/file?path=companions/research-rosa/COMPANION.md`);
    const fileData = await fileRes.json();
    assert.ok(fileData.content.includes("Dream Consolidation"));
  });

  await t.test("POST /api/routines/run executes scheduled routine and records result", async () => {
    const res = await fetch(`${baseUrl}/api/routines/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "morning-priorities" })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.routine.last_run_at > 0);
    assert.ok(data.routine.last_result.length > 10);
  });

  await t.test("POST /api/meetings records transcript and extracts action items", async () => {
    const res = await fetch(`${baseUrl}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Architecture Kickoff",
        durationSec: 600,
        transcriptText: "Ship Ổi Browser on localhost 4104. Complete full verification suite."
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.meeting.title, "Architecture Kickoff");
    assert.equal(data.meeting.actionItems.length, 2);
  });
});

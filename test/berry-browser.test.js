import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBerryServer } from "../src/server/berry-http-server.js";

test("Ổi Browser full-stack REA reconstruction suite", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-browser-test-"));
  const { server } = createBerryServer({ dataDir: tmpDir });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("GET /api/state returns 9 official companions, seeded tabs, 5 routines, and Karpathy-Wiki files", async () => {
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
  });

  await t.test("GET /newtab and extracted Ổi Browser SvelteKit assets + 3D models manifest return 200", async () => {
    const spaRes = await fetch(`${baseUrl}/newtab?layerId=chat:chat-view:root:entry-1`);
    assert.equal(spaRes.status, 200);
    const html = await spaRes.text();
    assert.ok(html.includes("/berry-electron-bridge.js"));
    assert.ok(html.includes("/_app/immutable/entry/start.DpNOqzh1.js"));

    const bridgeRes = await fetch(`${baseUrl}/berry-electron-bridge.js`);
    assert.equal(bridgeRes.status, 200);

    const manifestRes = await fetch(`${baseUrl}/models/asset-manifest.json`);
    assert.equal(manifestRes.status, 200);

    const fruitJsonRes = await fetch(`${baseUrl}/fruits/rambutan.json`);
    assert.equal(fruitJsonRes.status, 200);

    const fruit3dRes = await fetch(`${baseUrl}/fruits-3d/guava.png`);
    assert.equal(fruit3dRes.status, 200);
  });

  await t.test("POST /api/chat executes AgentDOMBrowserService, creates Visual Artifact, and logs Karpathy-Wiki observation", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companionId: "research-rosa",
        message: "Extract a table spreadsheet from berry://newtab",
        activeUrl: "berry://newtab"
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assistantMessage.sender, "assistant");
    assert.ok(data.assistantMessage.toolCalls.length >= 3);
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
        transcriptText: "Ship Ổi Browser on localhost 4104. Complete REA evidence ledger."
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.meeting.title, "Architecture Kickoff");
    assert.equal(data.meeting.actionItems.length, 2);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { CliHarnessRouter } from "../src/server/cli-harness-router.js";
import { Spec008VaultShellEvalsService } from "../src/server/domains/spec-008-vault-shell-evals.js";

test("Spec 008: Browser Shell, Encrypted Password Vault, Multi-Profile & Local Eval Runner (AC-801 .. AC-804)", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-008-test-"));
  const dbPath = path.join(tmpDir, "workspace.sqlite");
  const store = new SqliteWorkspaceStore(dbPath);
  const cliRouter = new CliHarnessRouter({ projectRoot: tmpDir });
  const service = new Spec008VaultShellEvalsService({ store, cliRouter, dataDir: tmpDir });

  t.after(() => {
    try {
      store.db.close();
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("AC-801: AES-256-GCM password vault encryption/decryption, CRUD, and CSV import", async () => {
    const keyPath = path.join(tmpDir, ".vault.key");
    assert.ok(fs.existsSync(keyPath), ".vault.key should be generated on initSchema()");
    assert.equal(fs.readFileSync(keyPath).length, 32, ".vault.key must be 32 bytes for AES-256-GCM");

    // Add password via channel
    const addRes = await service.handleChannel("passwords:add", {
      domain: "https://github.com/jangtrinh/oi-browser",
      username: "jang@oibrowser.vn",
      password: "SuperSecret!VaultPassword#2026"
    });
    assert.equal(addRes.success, true);
    assert.equal(addRes.password.domain, "github.com");
    assert.equal(addRes.password.username, "jang@oibrowser.vn");
    assert.equal(addRes.password.password, "SuperSecret!VaultPassword#2026");

    // Verify raw SQLite storage is encrypted (no plaintext in ciphertext column)
    const rawRow = store.db.prepare("SELECT * FROM passwords WHERE id = ?").get(addRes.password.id);
    assert.ok(rawRow.ciphertext);
    assert.notEqual(rawRow.ciphertext, "SuperSecret!VaultPassword#2026");
    assert.equal(Buffer.from(rawRow.iv, "hex").length, 12, "GCM IV must be 12 bytes");
    assert.equal(Buffer.from(rawRow.auth_tag, "hex").length, 16, "GCM AuthTag must be 16 bytes");
    assert.equal(service.decryptPassword(rawRow), "SuperSecret!VaultPassword#2026");

    // Edit password
    const editRes = await service.handleChannel("passwords:edit", {
      id: addRes.password.id,
      username: "admin@oibrowser.vn",
      password: "Rotated#Password999"
    });
    assert.equal(editRes.success, true);
    assert.equal(editRes.password.username, "admin@oibrowser.vn");
    assert.equal(editRes.password.password, "Rotated#Password999");

    // CSV import & mapped CSV import
    const csvPayload = [
      "url,username,password",
      "https://news.ycombinator.com,hn_reader,hnPass!123",
      "https://mail.google.com,workspace@oibrowser.vn,gmailPass!456"
    ].join("\n");
    const importRes = await service.handleChannel("passwords:import-from-csv", { csv: csvPayload });
    assert.equal(importRes.success, true);
    assert.equal(importRes.importedCount, 2);
    assert.equal(importRes.passwords.length, 3);

    const mappedRes = await service.handleChannel("passwords:import-from-csv-mapped", {
      csv: "site_host,login_user,login_secret\nlinear.app,pm@oibrowser.vn,linearSecret!789",
      mapping: { domain: "site_host", username: "login_user", password: "login_secret" }
    });
    assert.equal(mappedRes.success, true);
    assert.equal(mappedRes.importedCount, 1);

    // Filter by domain & getPasswordAccounts
    const domainRes = await service.handleChannel("passwords:get-by-domain", { domain: "github.com" });
    assert.equal(domainRes.passwords.length, 1);
    assert.equal(domainRes.passwords[0].password, "Rotated#Password999");

    const acctRes = await service.handleChannel("profile:getPasswordAccounts", {});
    assert.equal(acctRes.success, true);
    assert.equal(acctRes.accounts.length, 4);

    // Delete password
    const delRes = await service.handleChannel("passwords:delete", { id: addRes.password.id });
    assert.equal(delRes.success, true);
    assert.equal(delRes.passwords.length, 3);
  });

  await t.test("AC-802: Multi-profile, bookmarks, browsing history, and downloads persistence", async () => {
    // Seeded default profile
    const initProfiles = await service.handleChannel("profile:get-all-profiles");
    assert.equal(initProfiles.success, true);
    assert.ok(initProfiles.profiles.some((p) => p.id === "profile-oi-local" && p.isDefault));

    // Create profile, update name & color
    const createdProf = await service.handleChannel("profile:create-empty", {
      name: "Engineering Profile",
      color: "#10b981",
      activate: true
    });
    assert.equal(createdProf.success, true);
    assert.equal(createdProf.profile.name, "Engineering Profile");
    assert.equal(createdProf.profile.isActive, true);

    const renamedProf = await service.handleChannel("profile:update-name", {
      id: createdProf.profile.id,
      name: "Ổi Core Engineering"
    });
    assert.equal(renamedProf.profile.name, "Ổi Core Engineering");

    const recoloredProf = await service.handleChannel("profile:update-color", {
      id: createdProf.profile.id,
      color: "#f59e0b"
    });
    assert.equal(recoloredProf.profile.color, "#f59e0b");

    // Clear caches & cookies
    const cacheRes = await service.handleChannel("profile:clear-all-browser-caches");
    assert.equal(cacheRes.success, true);
    assert.equal(cacheRes.message, "Browser cache and temporary site data cleared.");

    const cookieRes = await service.handleChannel("profile:clear-all-cookies-and-site-data");
    assert.equal(cookieRes.success, true);

    // History chronological, delete-entries, and clear
    const histRes = await service.handleChannel("history:get-history-chronological");
    assert.equal(histRes.success, true);
    assert.ok(histRes.entries.length >= 1, "Initial browsing history should be seeded from tabs");

    const firstId = histRes.entries[0].id;
    const afterSingleDel = await service.handleChannel("history:delete-entries", { ids: [firstId] });
    assert.ok(!afterSingleDel.entries.some((e) => e.id === firstId));

    const clearedHist = await service.handleChannel("history:clear");
    assert.equal(clearedHist.entries.length, 0);

    // Bookmarks create-folder & get-info
    const folderRes = await service.handleChannel("bookmark:create-folder", {
      title: "Vietnam AI Research",
      parentId: "bm-root-oi"
    });
    assert.equal(folderRes.success, true);
    assert.equal(folderRes.folder.title, "Vietnam AI Research");

    const bmInfo = await service.handleChannel("bookmark:get-info", { id: "bm-root-oi" });
    assert.equal(bmInfo.success, true);
    assert.ok(bmInfo.children.some((c) => c.title === "Vietnam AI Research"));

    // Downloads save-local-file, get-history, delete-entry, clear-history
    const dlSave = await service.handleChannel("downloads:save-local-file", {
      filename: "oi-architecture-report.md",
      url: "https://github.com/jangtrinh/oi-browser/releases/report.md",
      content: "# Ổi Browser Local Report\nVerified."
    });
    assert.equal(dlSave.success, true);
    assert.ok(fs.existsSync(dlSave.download.savePath));
    assert.ok(dlSave.download.sizeBytes > 10);

    const dlHist = await service.handleChannel("downloads:get-history");
    assert.equal(dlHist.downloads.length, 1);

    const dlDel = await service.handleChannel("downloads:delete-entry", { id: dlSave.download.id });
    assert.equal(dlDel.downloads.length, 0);

    await service.handleChannel("downloads:save-local-file", { filename: "temp.txt", content: "temp" });
    const dlCleared = await service.handleChannel("downloads:clear-history");
    assert.equal(dlCleared.downloads.length, 0);
  });

  await t.test("AC-803: Extensions management and Sandbox reset (GuardrailsSanitizer counter reset)", async () => {
    const extList = await service.handleChannel("extensions:get-all");
    assert.equal(extList.success, true);
    assert.equal(extList.extensions.length, 1);

    const permRes = await service.handleChannel("extensions:get-permissions", { id: "ext-oi-shield" });
    assert.ok(permRes.permissions.includes("webRequestBlocking"));

    const revokeRes = await service.handleChannel("extensions:revoke-permissions", {
      id: "ext-oi-shield",
      permissions: ["webRequestBlocking"]
    });
    assert.ok(!revokeRes.permissions.includes("webRequestBlocking"));
    assert.ok(revokeRes.permissions.includes("tabs"));

    const delExtRes = await service.handleChannel("extensions:delete", { id: "ext-oi-shield" });
    assert.equal(delExtRes.extensions.length, 0);

    // Trigger guardrails redaction first, then verify sandbox:reset clears counters
    cliRouter.guardrails.sanitizeText("Leak sk-1234567890abcdefghijklmnop", "test");
    assert.ok(cliRouter.guardrails.totalScans >= 1);
    assert.ok(cliRouter.guardrails.totalRedactions >= 1);

    const resetRes = await service.handleChannel("sandbox:reset");
    assert.equal(resetRes.success, true);
    assert.equal(resetRes.status, "ready");
    assert.equal(resetRes.running, true);
    assert.equal(resetRes.isSandboxed, true);
    assert.equal(resetRes.message, "OpenJarvis Guardrails & CLI Sandbox reset complete");
    assert.equal(cliRouter.guardrails.totalScans, 0);
    assert.equal(cliRouter.guardrails.totalRedactions, 0);
    assert.equal(cliRouter.guardrails.recentEvents.length, 0);
  });

  await t.test("AC-804: Interactive Local Benchmark & Eval Runner execution, transcripts, and step logs", async () => {
    // Verify 3 seeded default OpenJarvis benchmark runs
    const initialList = await service.handleChannel("benchmark:listRuns");
    assert.equal(initialList.success, true);
    assert.equal(initialList.runs.length, 3);
    assert.ok(initialList.runs.some((r) => r.id === "eval-oj-router"));
    assert.ok(initialList.runs.some((r) => r.id === "eval-oj-fts5"));
    assert.ok(initialList.runs.some((r) => r.id === "eval-oj-guardrails"));

    // Run a package via benchmark:run-package
    const runRes = await service.handleChannel("benchmark:run-package", {
      packageName: "openjarvis-core",
      benchmarkId: "openjarvis-live-eval",
      title: "OpenJarvis Full-Stack Live Verification"
    });
    assert.equal(runRes.success, true);
    assert.equal(runRes.run.status, "completed");
    assert.equal(runRes.run.passed, true);
    assert.equal(runRes.run.score, 1);
    assert.ok(runRes.run.stepLogs.length >= 3);
    assert.ok(runRes.run.transcript.length >= 3);

    // Inspect run, transcript, and step logs
    const getRunRes = await service.handleChannel("benchmark:getRun", { id: runRes.run.id });
    assert.equal(getRunRes.success, true);
    assert.equal(getRunRes.run.id, runRes.run.id);

    const transcriptRes = await service.handleChannel("benchmark:getTranscript", { id: runRes.run.id });
    assert.equal(transcriptRes.success, true);
    assert.equal(transcriptRes.runId, runRes.run.id);
    assert.ok(transcriptRes.transcript.some((m) => m.role === "assistant" && m.content.includes("SQLite verification passed")));

    const stepLogsRes = await service.handleChannel("benchmark:getStepLogs", { id: runRes.run.id });
    assert.equal(stepLogsRes.success, true);
    assert.equal(stepLogsRes.stepLogs.length, 3);
    assert.ok(stepLogsRes.stepLogs.every((s) => s.status === "passed"));

    // Save & delete custom local benchmark, then clearLocalRuns
    const savedRes = await service.handleChannel("benchmark:saveLocalBenchmark", {
      id: "run-custom-1",
      title: "Custom DOM Agent Eval"
    });
    assert.equal(savedRes.success, true);
    assert.equal(savedRes.run.id, "run-custom-1");

    const delBench = await service.handleChannel("benchmark:deleteLocalBenchmark", { id: "run-custom-1" });
    assert.ok(!delBench.runs.some((r) => r.id === "run-custom-1"));

    const clearBench = await service.handleChannel("benchmark:clearLocalRuns");
    assert.equal(clearBench.runs.length, 0);

    // Non-Spec-008 channel returns null
    const unknown = await service.handleChannel("companions:get-all", {});
    assert.equal(unknown, null);
  });
});

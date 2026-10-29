import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { KarpathyWikiMemoryEngine } from "../src/server/karpathy-wiki-memory-engine.js";
import { WikiFtsIndex } from "../src/server/wiki-fts-index.js";
import { Spec003SyncedFsArtifactsService } from "../src/server/domains/spec-003-syncedfs-artifacts.js";

test("Spec 003 — SyncedFS Workspace, Library CRUD & Visual Artifacts Engine (AC-301 .. AC-304)", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "berry-spec003-test-"));
  const dbPath = path.join(tmpDir, "workspace.sqlite");
  const memoryDir = path.join(tmpDir, "memory");

  const store = new SqliteWorkspaceStore(dbPath);
  const memory = new KarpathyWikiMemoryEngine(memoryDir);
  const wikiFts = new WikiFtsIndex({ db: store.db, memory });
  const service = new Spec003SyncedFsArtifactsService({
    store,
    memory,
    wikiFts,
    dataDir: tmpDir
  });

  t.after(() => {
    try {
      store.db.close();
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test("AC-301: synced-fs:write snapshots previous version, lists in synced-fs:list-versions, and restores via synced-fs:restore-version", async () => {
    const relPath = "entities/projects/oi-slva.md";
    const v1Content = "# Project SLVA\n\nVersion 1: Initial SyncedFS specification.";
    const v2Content = "# Project SLVA\n\nVersion 2: Updated with visual artifacts.";

    const w1 = await service.handleChannel("synced-fs:write", {
      path: relPath,
      content: v1Content
    });
    assert.equal(w1.success, true);
    assert.equal(w1.path, relPath);
    assert.ok(w1.versionId);
    assert.ok(w1.sha256);

    const w2 = await service.handleChannel("synced-fs:write", {
      path: relPath,
      content: v2Content
    });
    assert.equal(w2.success, true);
    assert.equal(w2.path, relPath);

    // Current file on disk should be v2Content
    const currentRead = await service.handleChannel("synced-fs:read", { path: relPath });
    assert.equal(currentRead.success, true);
    assert.equal(currentRead.content, v2Content);

    // .versions/<sha256> should exist on disk
    const versionDiskFile = path.join(memory.rootDir, ".versions", w2.sha256);
    assert.equal(fs.existsSync(versionDiskFile), true);
    assert.equal(fs.readFileSync(versionDiskFile, "utf8"), v1Content);

    // List versions
    const listRes = await service.handleChannel("synced-fs:list-versions", {
      path: relPath
    });
    assert.equal(listRes.success, true);
    assert.ok(listRes.versions.length >= 1);
    assert.equal(listRes.versions[0].content, v1Content);

    // Read specific version
    const readVer = await service.handleChannel("synced-fs:read-version", {
      versionId: listRes.versions[0].id
    });
    assert.equal(readVer.success, true);
    assert.equal(readVer.version.content, v1Content);

    // Restore v1 version
    const restoreRes = await service.handleChannel("synced-fs:restore-version", {
      path: relPath,
      versionId: listRes.versions[0].id
    });
    assert.equal(restoreRes.success, true);
    assert.equal(restoreRes.content, v1Content);

    const afterRestore = await service.handleChannel("synced-fs:read", { path: relPath });
    assert.equal(afterRestore.content, v1Content);
  });

  await t.test("AC-302: synced-fs:delete moves file to .trash/, lists in synced-fs:list-recently-deleted, and restores via synced-fs:restore-deleted & restore-all-deleted", async () => {
    const fileA = "entities/deals/deal-alpha.md";
    const fileB = "entities/deals/deal-beta.md";
    const bodyA = "# Deal Alpha\n\nValue: $120,000 ARR";
    const bodyB = "# Deal Beta\n\nValue: $250,000 ARR";

    await service.handleChannel("synced-fs:write", { path: fileA, content: bodyA });
    await service.handleChannel("synced-fs:write", { path: fileB, content: bodyB });

    const delA = await service.handleChannel("synced-fs:delete", { path: fileA });
    assert.equal(delA.success, true);
    assert.equal(delA.deletedPath, fileA);

    // Original file unlinked, .trash/<relPath> created
    assert.equal(fs.existsSync(memory.safeResolve(fileA)), false);
    assert.equal(
      fs.existsSync(path.join(memory.rootDir, ".trash", fileA)),
      true
    );

    const trashList = await service.handleChannel("synced-fs:list-recently-deleted");
    assert.equal(trashList.success, true);
    assert.ok(trashList.deletedFiles.some((f) => f.path === fileA));

    // Restore single deleted file
    const restoreA = await service.handleChannel("synced-fs:restore-deleted", {
      path: fileA
    });
    assert.equal(restoreA.success, true);
    assert.equal(restoreA.restoredPath, fileA);
    assert.equal(memory.readFile(fileA), bodyA);
    assert.equal(
      fs.existsSync(path.join(memory.rootDir, ".trash", fileA)),
      false
    );

    // Delete both and test restore-all-deleted
    await service.handleChannel("synced-fs:delete", { path: fileA });
    await service.handleChannel("synced-fs:delete", { path: fileB });
    const restoreAll = await service.handleChannel("synced-fs:restore-all-deleted");
    assert.equal(restoreAll.success, true);
    assert.equal(restoreAll.restoredCount, 2);
    assert.equal(memory.readFile(fileA), bodyA);
    assert.equal(memory.readFile(fileB), bodyB);
  });

  await t.test("AC-303: syncedFs:searchFiles and synced-fs:search return BM25-ranked matches from WikiFtsIndex", async () => {
    const uniqueDoc = "entities/companies/quantum-mango.md";
    await service.handleChannel("synced-fs:write", {
      path: uniqueDoc,
      content:
        "# Quantum Mango Photonics\n\nQuantumMangoLattice is an optical computing accelerator for local browsers."
    });

    const searchRes = await service.handleChannel("syncedFs:searchFiles", {
      query: "QuantumMangoLattice",
      limit: 10
    });
    assert.equal(searchRes.success, true);
    assert.ok(searchRes.total >= 1);
    assert.equal(searchRes.results[0].path, uniqueDoc);
    assert.equal(searchRes.files[0].path, uniqueDoc);
    assert.ok(typeof searchRes.results[0].score === "number");

    const aliasRes = await service.handleChannel("synced-fs:search", {
      q: "QuantumMangoLattice"
    });
    assert.equal(aliasRes.success, true);
    assert.equal(aliasRes.results[0].path, uniqueDoc);
  });

  await t.test("FR-302/Host Bridge: fs:* and file:* channels are safely scoped to memory.rootDir", async () => {
    const rootsRes = await service.handleChannel("fs:list-roots");
    assert.equal(rootsRes.success, true);
    assert.equal(rootsRes.roots[0].path, memory.rootDir);

    const filesRes = await service.handleChannel("fs:list-files", {});
    assert.equal(filesRes.success, true);
    assert.ok(filesRes.files.some((f) => f.path === "PROFILE.md"));

    const editRes = await service.handleChannel("fs:edit-file", {
      path: "notes/bridge-test.md",
      content: "# Bridge Note\n\nHello from host bridge."
    });
    assert.equal(editRes.success, true);

    const b64Res = await service.handleChannel("fs:read-file-base64", {
      path: "notes/bridge-test.md"
    });
    assert.equal(b64Res.success, true);
    assert.equal(
      Buffer.from(b64Res.base64, "base64").toString("utf8"),
      "# Bridge Note\n\nHello from host bridge."
    );

    const dataUrlRes = await service.handleChannel("file:read-as-data-url", {
      path: "notes/bridge-test.md"
    });
    assert.equal(dataUrlRes.success, true);
    assert.ok(dataUrlRes.dataUrl.startsWith("data:text/markdown"));

    const copyRes = await service.handleChannel("fs:copy-files-into-folder", {
      targetFolder: "entities/projects",
      files: ["notes/bridge-test.md"]
    });
    assert.equal(copyRes.success, true);
    assert.deepEqual(copyRes.copiedFiles, ["entities/projects/bridge-test.md"]);

    const saveAsRes = await service.handleChannel("file:save-as", {
      path: "notes/saved-copy.md",
      content: "# Saved Copy"
    });
    assert.equal(saveAsRes.success, true);
    assert.equal(memory.readFile("notes/saved-copy.md"), "# Saved Copy");

    const showRes = await service.handleChannel("knowledge:show-in-folder", {
      path: "notes/saved-copy.md"
    });
    assert.equal(showRes.success, true);
    assert.equal(showRes.exists, true);

    // Path traversal outside memory.rootDir must throw
    await assert.rejects(
      async () => {
        await service.handleChannel("fs:read-file", { path: "../../../etc/passwd" });
      },
      /Invalid memory path/
    );
  });

  await t.test("FR-303 & AC-304: Artifact KV DB, Preview & RFC-4180 CSV / XLSX / PDF Exports", async () => {
    const capRes = await service.handleChannel("artifact-db:create-capability-set", {
      artifactId: "art-sales-q4"
    });
    assert.equal(capRes.success, true);
    assert.ok(capRes.capabilities.includes("set"));

    const setRes = await service.handleChannel("artifact-db:request", {
      artifactId: "art-sales-q4",
      action: "set",
      key: "filterState",
      value: { region: "APAC", minArr: 50000 }
    });
    assert.equal(setRes.success, true);

    const getRes = await service.handleChannel("artifact-db:request", {
      artifactId: "art-sales-q4",
      action: "get",
      key: "filterState"
    });
    assert.equal(getRes.success, true);
    assert.deepEqual(getRes.value, { region: "APAC", minArr: 50000 });

    const listKv = await service.handleChannel("artifact-db:request", {
      artifactId: "art-sales-q4",
      action: "list"
    });
    assert.equal(listKv.success, true);
    assert.equal(listKv.items.length, 1);

    const delKv = await service.handleChannel("artifact-db:request", {
      artifactId: "art-sales-q4",
      action: "delete",
      key: "filterState"
    });
    assert.equal(delKv.success, true);

    // Create spreadsheet artifact with special characters requiring RFC-4180 quoting
    const art = store.createArtifact({
      id: "art-rfc4180",
      title: "Q4 Pipeline, Quotes & Notes",
      kind: "spreadsheet",
      companionId: "sales-sally",
      columns: ["Company", "Summary", "ARR"],
      rows: [
        { Company: "Acme, Inc.", Summary: 'Said "Ready to sign"', ARR: "120000" },
        { Company: "Beta Corp", Summary: "Multi-line\nnote", ARR: "85000" }
      ]
    });
    assert.equal(art.id, "art-rfc4180");

    const previewRes = await service.handleChannel("visual-artifacts:resolve-preview", {
      artifactId: "art-rfc4180"
    });
    assert.equal(previewRes.success, true);
    assert.ok(previewRes.htmlPreview.includes("<table"));
    assert.ok(previewRes.htmlPreview.includes("Acme, Inc."));

    const csvRes = await service.handleChannel("table:save-as-csv", {
      artifactId: "art-rfc4180"
    });
    assert.equal(csvRes.success, true);
    assert.equal(csvRes.filename, "art-rfc4180.csv");
    assert.equal(fs.existsSync(csvRes.filePath), true);

    const expectedCsv = [
      "Company,Summary,ARR",
      '"Acme, Inc.","Said ""Ready to sign""",120000',
      'Beta Corp,"Multi-line\nnote",85000'
    ].join("\r\n");
    assert.equal(csvRes.content, expectedCsv);

    const xlsxRes = await service.handleChannel("table:save-as-xlsx", {
      artifactId: "art-rfc4180"
    });
    assert.equal(xlsxRes.success, true);
    assert.equal(fs.existsSync(xlsxRes.filePath), true);

    const pdfRes = await service.handleChannel("report:export-pdf", {
      artifactId: "art-rfc4180"
    });
    assert.equal(pdfRes.success, true);
    assert.equal(fs.existsSync(pdfRes.filePath), true);
    assert.ok(pdfRes.content.includes("<!doctype html>"));

    // Unrecognized channel returns null
    const unknown = await service.handleChannel("non-existent:channel", {});
    assert.equal(unknown, null);
  });
});

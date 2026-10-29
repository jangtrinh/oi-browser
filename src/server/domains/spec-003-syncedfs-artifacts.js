import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function sha256Hex(content = "") {
  return crypto.createHash("sha256").update(String(content), "utf8").digest("hex");
}

function guessMimeType(filePath = "") {
  const ext = path.extname(String(filePath)).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "text/markdown; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".tsv") return "text/tab-separated-values; charset=utf-8";
  if (ext === ".html" || ext === ".htm") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".pdf") return "application/pdf";
  return "text/plain; charset=utf-8";
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class Spec003SyncedFsArtifactsService {
  constructor({ store, memory, wikiFts, dataDir } = {}) {
    this.store = store || null;
    this.memory = memory || null;
    this.wikiFts = wikiFts || null;
    this.dataDir =
      dataDir ||
      (this.memory?.rootDir ? path.dirname(this.memory.rootDir) : process.cwd());
    this.initSchema();
  }

  initSchema() {
    if (!this.store?.db) return;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS synced_fs_versions (
        id TEXT PRIMARY KEY,
        rel_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        content TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS synced_fs_trash (
        rel_path TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        deleted_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS artifact_kv_store (
        artifact_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (artifact_id, key)
      );
    `);
  }

  normalizeRelPath(rawPath = "PROFILE.md") {
    const cleaned = String(rawPath || "PROFILE.md")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    return cleaned || "PROFILE.md";
  }

  _reindexFts(relPath = null, content = null, isDelete = false) {
    if (!this.wikiFts) return;
    if (typeof this.wikiFts.indexAll === "function") {
      this.wikiFts.indexAll();
    }
    if (isDelete && relPath && this.wikiFts.db) {
      try {
        this.wikiFts.db
          .prepare("DELETE FROM wiki_fts WHERE path = ?")
          .run(String(relPath));
      } catch {}
      return;
    }
    if (
      relPath &&
      content !== null &&
      !String(relPath).startsWith(".trash/") &&
      !String(relPath).startsWith(".versions/") &&
      typeof this.wikiFts.indexDocument === "function"
    ) {
      const text = String(content);
      const match = text.match(/^#+\s+(.+)$/m);
      const title = match ? match[1].trim() : relPath;
      const parts = String(relPath).split("/");
      const category = parts.length > 1 ? parts[0] : "profile";
      this.wikiFts.indexDocument({ path: relPath, title, category, content: text });
      return;
    }
    if (typeof this.wikiFts.syncAllFromDisk === "function") {
      this.wikiFts.syncAllFromDisk();
    }
    try {
      this.wikiFts.db
        ?.prepare(
          "DELETE FROM wiki_fts WHERE path LIKE '.trash/%' OR path LIKE '.versions/%'"
        )
        .run();
    } catch {
      // Ignore if wiki_fts is not initialized
    }
  }

  _saveVersionSnapshot(relPath, content) {
    const text = String(content ?? "");
    const sha256 = sha256Hex(text);
    const sizeBytes = Buffer.byteLength(text, "utf8");
    const createdAt = Date.now();
    const versionId = `ver-${sha256.slice(0, 12)}-${createdAt.toString(36)}`;

    if (this.memory?.rootDir) {
      const versionsDir = path.join(this.memory.rootDir, ".versions");
      fs.mkdirSync(versionsDir, { recursive: true });
      fs.writeFileSync(path.join(versionsDir, sha256), text, "utf8");
    }

    if (this.store?.db) {
      const existing = this.store.db
        .prepare(
          "SELECT id FROM synced_fs_versions WHERE rel_path = ? AND sha256 = ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(relPath, sha256);
      if (existing) {
        this.store.db
          .prepare("UPDATE synced_fs_versions SET created_at = ? WHERE id = ?")
          .run(createdAt, existing.id);
        return { versionId: existing.id, sha256, sizeBytes, createdAt };
      }
      this.store.db
        .prepare(
          "INSERT INTO synced_fs_versions (id, rel_path, sha256, content, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(versionId, relPath, sha256, text, sizeBytes, createdAt);
    }

    return { versionId, sha256, sizeBytes, createdAt };
  }

  readFile(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath || "PROFILE.md"
    );
    const content = String(this.memory.readFile(relPath) ?? "");
    return {
      success: true,
      path: relPath,
      content,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      sha256: sha256Hex(content)
    };
  }

  writeFile(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath || "PROFILE.md"
    );
    const newContent = String(payload.content ?? "");
    const fullPath = this.memory.safeResolve(relPath);
    const existedBefore = fs.existsSync(fullPath);

    let snapshot = null;
    if (existedBefore) {
      const prevContent = String(this.memory.readFile(relPath) ?? "");
      snapshot = this._saveVersionSnapshot(relPath, prevContent);
    }

    this.memory.writeFile(relPath, newContent);

    const newSha256 = sha256Hex(newContent);
    if (this.memory?.rootDir) {
      const versionsDir = path.join(this.memory.rootDir, ".versions");
      fs.mkdirSync(versionsDir, { recursive: true });
      fs.writeFileSync(path.join(versionsDir, newSha256), newContent, "utf8");
    }

    if (!snapshot) {
      snapshot = this._saveVersionSnapshot(relPath, newContent);
    }

    this._reindexFts(relPath, newContent, false);

    return {
      success: true,
      path: relPath,
      versionId: snapshot.versionId,
      sha256: snapshot.sha256,
      currentSha256: newSha256,
      sizeBytes: Buffer.byteLength(newContent, "utf8")
    };
  }

  deleteFile(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath
    );
    const fullPath = this.memory.safeResolve(relPath);
    const content = fs.existsSync(fullPath)
      ? String(this.memory.readFile(relPath) ?? "")
      : "";
    const sizeBytes = Buffer.byteLength(content, "utf8");
    const deletedAt = Date.now();

    if (this.store?.db) {
      this.store.db
        .prepare(
          "INSERT OR REPLACE INTO synced_fs_trash (rel_path, content, size_bytes, deleted_at) VALUES (?, ?, ?, ?)"
        )
        .run(relPath, content, sizeBytes, deletedAt);
    }

    if (this.memory?.rootDir) {
      const trashFile = this.memory.safeResolve(path.posix.join(".trash", relPath));
      fs.mkdirSync(path.dirname(trashFile), { recursive: true });
      fs.writeFileSync(trashFile, content, "utf8");
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    this._reindexFts(relPath, null, true);

    return {
      success: true,
      deletedPath: relPath,
      path: relPath,
      sizeBytes,
      deletedAt
    };
  }

  listVersions(payload = {}) {
    const hasPath = Boolean(payload.path || payload.relPath || payload.filePath);
    const relPath = hasPath
      ? this.normalizeRelPath(payload.path || payload.relPath || payload.filePath)
      : null;

    let rows = [];
    if (this.store?.db) {
      rows = relPath
        ? this.store.db
            .prepare(
              "SELECT * FROM synced_fs_versions WHERE rel_path = ? ORDER BY created_at DESC, rowid DESC"
            )
            .all(relPath)
        : this.store.db
            .prepare(
              "SELECT * FROM synced_fs_versions ORDER BY created_at DESC, rowid DESC"
            )
            .all();
    }

    const versions = rows.map((r) => ({
      id: r.id,
      versionId: r.id,
      path: r.rel_path,
      rel_path: r.rel_path,
      relPath: r.rel_path,
      sha256: r.sha256,
      content: r.content,
      sizeBytes: r.size_bytes,
      size_bytes: r.size_bytes,
      createdAt: r.created_at,
      created_at: r.created_at
    }));

    return {
      success: true,
      path: relPath,
      versions
    };
  }

  readVersion(payload = {}) {
    const versionId = payload.versionId || payload.id || null;
    const sha256 = payload.sha256 || null;
    const relPath =
      payload.path || payload.relPath
        ? this.normalizeRelPath(payload.path || payload.relPath)
        : null;

    let row = null;
    if (this.store?.db) {
      if (versionId) {
        row = this.store.db
          .prepare(
            "SELECT * FROM synced_fs_versions WHERE id = ? OR sha256 = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(String(versionId), String(versionId));
      } else if (sha256) {
        row = this.store.db
          .prepare(
            "SELECT * FROM synced_fs_versions WHERE sha256 = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(String(sha256));
      } else if (relPath) {
        row = this.store.db
          .prepare(
            "SELECT * FROM synced_fs_versions WHERE rel_path = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(relPath);
      }
    }

    if (!row && sha256 && this.memory?.rootDir) {
      const diskVersion = path.join(this.memory.rootDir, ".versions", String(sha256));
      if (fs.existsSync(diskVersion)) {
        const content = fs.readFileSync(diskVersion, "utf8");
        row = {
          id: `ver-${String(sha256).slice(0, 12)}`,
          rel_path: relPath || "PROFILE.md",
          sha256: String(sha256),
          content,
          size_bytes: Buffer.byteLength(content, "utf8"),
          created_at: Date.now()
        };
      }
    }

    if (!row) {
      return { success: false, version: null, error: "Version not found" };
    }

    const version = {
      id: row.id,
      versionId: row.id,
      path: row.rel_path,
      rel_path: row.rel_path,
      relPath: row.rel_path,
      sha256: row.sha256,
      content: row.content,
      sizeBytes: row.size_bytes,
      size_bytes: row.size_bytes,
      createdAt: row.created_at,
      created_at: row.created_at
    };

    return { success: true, version };
  }

  restoreVersion(payload = {}) {
    const found = this.readVersion(payload);
    if (!found.success || !found.version) {
      return { success: false, error: "Version not found" };
    }
    const targetPath = this.normalizeRelPath(
      payload.path || payload.relPath || found.version.rel_path
    );
    this.memory.writeFile(targetPath, found.version.content);
    this._reindexFts(targetPath, found.version.content, false);

    return {
      success: true,
      path: targetPath,
      versionId: found.version.id,
      sha256: found.version.sha256,
      content: found.version.content
    };
  }

  listRecentlyDeleted() {
    let rows = [];
    if (this.store?.db) {
      rows = this.store.db
        .prepare("SELECT * FROM synced_fs_trash ORDER BY deleted_at DESC")
        .all();
    }
    const deletedFiles = rows.map((r) => ({
      path: r.rel_path,
      rel_path: r.rel_path,
      relPath: r.rel_path,
      content: r.content,
      sizeBytes: r.size_bytes,
      size_bytes: r.size_bytes,
      deletedAt: r.deleted_at,
      deleted_at: r.deleted_at
    }));
    return {
      success: true,
      deletedFiles
    };
  }

  restoreDeleted(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath
    );
    let content = null;

    if (this.store?.db) {
      const row = this.store.db
        .prepare("SELECT * FROM synced_fs_trash WHERE rel_path = ?")
        .get(relPath);
      if (row) {
        content = row.content;
        this.store.db
          .prepare("DELETE FROM synced_fs_trash WHERE rel_path = ?")
          .run(relPath);
      }
    }

    const trashDiskPath = this.memory?.rootDir
      ? this.memory.safeResolve(path.posix.join(".trash", relPath))
      : null;

    if (content === null && trashDiskPath && fs.existsSync(trashDiskPath)) {
      content = fs.readFileSync(trashDiskPath, "utf8");
    }

    if (content === null) {
      return { success: false, restoredPath: relPath, error: "Deleted file not found" };
    }

    this.memory.writeFile(relPath, content);
    if (trashDiskPath && fs.existsSync(trashDiskPath)) {
      fs.unlinkSync(trashDiskPath);
    }

    this._reindexFts(relPath, content, false);

    return {
      success: true,
      restoredPath: relPath,
      path: relPath,
      content
    };
  }

  restoreAllDeleted() {
    const { deletedFiles } = this.listRecentlyDeleted();
    let restoredCount = 0;
    const restoredPaths = [];

    for (const item of deletedFiles) {
      const res = this.restoreDeleted({ path: item.rel_path });
      if (res.success) {
        restoredCount++;
        restoredPaths.push(item.rel_path);
      }
    }

    return {
      success: true,
      restoredCount,
      restoredPaths
    };
  }

  searchFiles(payload = {}) {
    const query = String(payload.query ?? payload.q ?? "").trim();
    const limit = Math.max(1, Number(payload.limit) || 20);
    let results = [];

    if (this.wikiFts && typeof this.wikiFts.search === "function") {
      if (typeof this.wikiFts.getDocCount === "function" && this.wikiFts.getDocCount() === 0) {
        this._reindexFts();
      }
      const rawOut = this.wikiFts.search(query, limit);
      const list = Array.isArray(rawOut)
        ? rawOut
        : Array.isArray(rawOut?.results)
          ? rawOut.results
          : [];
      results = list.filter(
        (item) =>
          !String(item.path || "").startsWith(".trash/") &&
          !String(item.path || "").startsWith(".versions/")
      );
    }

    if (results.length === 0 && this.memory?.listFiles) {
      const needle = query.toLowerCase();
      const allFiles = this.memory
        .listFiles()
        .filter(
          (f) =>
            !String(f.path || "").startsWith(".trash/") &&
            !String(f.path || "").startsWith(".versions/")
        );
      for (const f of allFiles) {
        const content = String(this.memory.readFile(f.path) || "");
        if (
          !needle ||
          f.path.toLowerCase().includes(needle) ||
          content.toLowerCase().includes(needle)
        ) {
          const heading = content.match(/^#+\s+(.+)$/m);
          results.push({
            path: f.path,
            title: heading ? heading[1].trim() : f.path,
            category: f.path.includes("/") ? f.path.split("/")[0] : "profile",
            snippet: content.slice(0, 160),
            score: -1.0
          });
          if (results.length >= limit) break;
        }
      }
    }

    return {
      success: true,
      query,
      results,
      files: results,
      total: results.length
    };
  }

  listRoots() {
    return {
      success: true,
      roots: [
        {
          id: "karpathy-wiki-root",
          name: "Karpathy-Wiki Memory",
          path: this.memory?.rootDir || this.dataDir
        }
      ]
    };
  }

  fsListFiles(payload = {}) {
    const subDir = String(payload.dir || payload.path || "")
      .trim()
      .replace(/^\/+/, "");
    const targetDir = subDir
      ? this.memory.safeResolve(subDir)
      : this.memory.rootDir;

    if (!fs.existsSync(targetDir)) {
      return { success: true, files: [], entries: [] };
    }

    const files = (this.memory.listFiles(targetDir, subDir) || []).filter(
      (f) =>
        !String(f.path || "").startsWith(".trash/") &&
        !String(f.path || "").startsWith(".versions/")
    );
    return {
      success: true,
      files,
      entries: files
    };
  }

  fsReadFile(payload = {}) {
    return this.readFile(payload);
  }

  fsReadFileBase64(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath || "PROFILE.md"
    );
    const fullPath = this.memory.safeResolve(relPath);
    const buf = fs.existsSync(fullPath)
      ? fs.readFileSync(fullPath)
      : Buffer.from("", "utf8");
    return {
      success: true,
      path: relPath,
      base64: buf.toString("base64"),
      mimeType: guessMimeType(relPath),
      sizeBytes: buf.length
    };
  }

  fsEditFile(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath || "PROFILE.md"
    );
    let nextContent;
    if (payload.content !== undefined) {
      nextContent = String(payload.content);
    } else {
      const current = String(this.memory.readFile(relPath) ?? "");
      const findStr = String(payload.search ?? payload.oldText ?? "");
      const replaceStr = String(payload.replace ?? payload.newText ?? "");
      nextContent = findStr ? current.replace(findStr, replaceStr) : current + replaceStr;
    }
    const writeRes = this.writeFile({ path: relPath, content: nextContent });
    return {
      ...writeRes,
      content: nextContent
    };
  }

  fsCopyFilesIntoFolder(payload = {}) {
    const targetFolder = String(
      payload.targetFolder || payload.folder || payload.destDir || "imports"
    )
      .trim()
      .replace(/^\/+/, "");
    const sourceItems = Array.isArray(payload.files)
      ? payload.files
      : Array.isArray(payload.sourcePaths)
        ? payload.sourcePaths
        : [];
    const copiedFiles = [];

    for (const item of sourceItems) {
      if (typeof item === "object" && item !== null) {
        const name = path.basename(String(item.name || item.path || "file.md"));
        const destRel = this.normalizeRelPath(path.posix.join(targetFolder, name));
        const content =
          item.content !== undefined
            ? String(item.content)
            : this.memory.readFile(this.normalizeRelPath(item.path));
        this.writeFile({ path: destRel, content });
        copiedFiles.push(destRel);
      } else if (typeof item === "string") {
        const srcRel = this.normalizeRelPath(item);
        const name = path.basename(srcRel);
        const destRel = this.normalizeRelPath(path.posix.join(targetFolder, name));
        const content = this.memory.readFile(srcRel);
        this.writeFile({ path: destRel, content });
        copiedFiles.push(destRel);
      }
    }

    return {
      success: true,
      targetFolder,
      copiedFiles
    };
  }

  fileReadAsDataUrl(payload = {}) {
    const b64 = this.fsReadFileBase64(payload);
    const dataUrl = `data:${b64.mimeType};base64,${b64.base64}`;
    return {
      success: true,
      path: b64.path,
      mimeType: b64.mimeType,
      dataUrl,
      url: dataUrl
    };
  }

  fileSaveAs(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filename || "exports/saved.md"
    );
    const fullPath = this.memory.safeResolve(relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (payload.base64) {
      const buf = Buffer.from(String(payload.base64), "base64");
      fs.writeFileSync(fullPath, buf);
      return {
        success: true,
        path: relPath,
        filePath: fullPath,
        sizeBytes: buf.length
      };
    }
    const writeRes = this.writeFile({
      path: relPath,
      content: String(payload.content ?? "")
    });
    return {
      ...writeRes,
      filePath: fullPath
    };
  }

  knowledgeShowInFolder(payload = {}) {
    const relPath = this.normalizeRelPath(
      payload.path || payload.relPath || payload.filePath || "PROFILE.md"
    );
    const fullPath = this.memory.safeResolve(relPath);
    return {
      success: true,
      path: relPath,
      fullPath,
      folderPath: path.dirname(fullPath),
      exists: fs.existsSync(fullPath)
    };
  }

  createArtifactCapabilitySet(payload = {}) {
    const artifactId = String(payload.artifactId || payload.id || "default");
    return {
      success: true,
      artifactId,
      namespace: `artifact_kv_${artifactId}`,
      capabilities: ["get", "set", "delete", "list"],
      token: `cap-${artifactId}`
    };
  }

  artifactDbRequest(payload = {}) {
    const artifactId = String(payload.artifactId || payload.id || "default");
    const action = String(
      payload.action || payload.op || payload.method || "list"
    ).toLowerCase();
    const key = payload.key !== undefined ? String(payload.key) : "";

    if (action === "set" || action === "put" || action === "upsert") {
      const updatedAt = Date.now();
      const value = payload.value !== undefined ? payload.value : null;
      const valueJson = JSON.stringify(value);
      this.store.db
        .prepare(
          "INSERT OR REPLACE INTO artifact_kv_store (artifact_id, key, value_json, updated_at) VALUES (?, ?, ?, ?)"
        )
        .run(artifactId, key, valueJson, updatedAt);
      return {
        success: true,
        artifactId,
        key,
        value,
        updatedAt
      };
    }

    if (action === "get") {
      const row = this.store.db
        .prepare(
          "SELECT value_json, updated_at FROM artifact_kv_store WHERE artifact_id = ? AND key = ?"
        )
        .get(artifactId, key);
      let value = null;
      if (row) {
        try {
          value = JSON.parse(row.value_json);
        } catch {
          value = row.value_json;
        }
      }
      return {
        success: true,
        artifactId,
        key,
        value,
        exists: Boolean(row),
        updatedAt: row?.updated_at ?? null
      };
    }

    if (action === "delete" || action === "remove") {
      this.store.db
        .prepare(
          "DELETE FROM artifact_kv_store WHERE artifact_id = ? AND key = ?"
        )
        .run(artifactId, key);
      return {
        success: true,
        artifactId,
        key,
        deleted: true
      };
    }

    const rows = this.store.db
      .prepare(
        "SELECT key, value_json, updated_at FROM artifact_kv_store WHERE artifact_id = ? ORDER BY key ASC"
      )
      .all(artifactId);
    const items = rows.map((r) => {
      let value = null;
      try {
        value = JSON.parse(r.value_json);
      } catch {
        value = r.value_json;
      }
      return { key: r.key, value, updatedAt: r.updated_at };
    });

    return {
      success: true,
      artifactId,
      items,
      entries: items
    };
  }

  _resolveArtifact(payload = {}) {
    if (payload.artifact && typeof payload.artifact === "object") {
      return payload.artifact;
    }
    const list = this.store?.listArtifacts ? this.store.listArtifacts() : [];
    const targetId = payload.artifactId || payload.id || null;
    if (targetId) {
      const found = list.find((a) => a.id === targetId);
      if (found) return found;
    }
    if (payload.columns || payload.rows || payload.contentMarkdown) {
      return {
        id: targetId || "art-inline",
        title: payload.title || "Exported Artifact",
        kind: payload.kind || (payload.columns || payload.rows ? "spreadsheet" : "document"),
        content_markdown: payload.contentMarkdown || payload.content_markdown || "",
        columns: payload.columns || [],
        rows: payload.rows || []
      };
    }
    return list[0] || null;
  }

  resolveArtifactPreview(payload = {}) {
    const artifact = this._resolveArtifact(payload);
    if (!artifact) {
      return {
        success: false,
        artifact: null,
        htmlPreview: "",
        source: "",
        error: "Artifact not found"
      };
    }

    const columns = Array.isArray(artifact.columns)
      ? artifact.columns
      : Array.isArray(artifact.rows) && artifact.rows[0] && typeof artifact.rows[0] === "object"
        ? Object.keys(artifact.rows[0])
        : [];
    const rows = Array.isArray(artifact.rows) ? artifact.rows : [];
    const markdown = String(
      artifact.content_markdown || artifact.contentMarkdown || ""
    );

    let htmlPreview = "";
    let source = markdown;

    if (columns.length > 0 || rows.length > 0) {
      const ths = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
      const trs = rows
        .map((row) => {
          const cells = Array.isArray(row)
            ? row.map((v) => `<td>${escapeHtml(v)}</td>`).join("")
            : columns.map((c) => `<td>${escapeHtml(row?.[c] ?? "")}</td>`).join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      htmlPreview = `<div class="oi-artifact-preview" data-artifact-id="${escapeHtml(artifact.id)}"><h2>${escapeHtml(artifact.title || artifact.id)}</h2><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
      if (!source) {
        source = this._formatRowsAsCsv(columns, rows);
      }
    } else {
      htmlPreview = `<article class="oi-artifact-preview" data-artifact-id="${escapeHtml(artifact.id)}"><h2>${escapeHtml(artifact.title || artifact.id)}</h2><div class="oi-markdown-body">${escapeHtml(markdown)}</div></article>`;
    }

    const bundleFileUrl = `/api/artifacts/preview?id=${encodeURIComponent(artifact.id)}`;
    return {
      success: true,
      artifact,
      htmlPreview,
      source,
      url: bundleFileUrl,
      bundleFileUrl
    };
  }

  _formatRowsAsCsv(columns = [], rows = [], delimiter = ",") {
    const inferredCols =
      columns.length > 0
        ? columns
        : rows.length > 0 && typeof rows[0] === "object" && !Array.isArray(rows[0])
          ? Object.keys(rows[0])
          : [];

    const formatCell = (val) => {
      if (delimiter === "\t") {
        return String(val ?? "").replace(/[\t\r\n]+/g, " ");
      }
      return escapeCsvCell(val);
    };

    const lines = [];
    if (inferredCols.length > 0) {
      lines.push(inferredCols.map(formatCell).join(delimiter));
    }

    for (const row of rows) {
      if (Array.isArray(row)) {
        lines.push(row.map(formatCell).join(delimiter));
      } else if (row && typeof row === "object") {
        lines.push(inferredCols.map((col) => formatCell(row[col])).join(delimiter));
      }
    }

    return lines.join("\r\n");
  }

  exportArtifact(payload = {}) {
    const format = String(payload.format || "csv").toLowerCase();
    const artifact = this._resolveArtifact(payload) || {
      id: "art-export",
      title: payload.title || "Artifact Export",
      columns: payload.columns || [],
      rows: payload.rows || [],
      content_markdown: payload.contentMarkdown || ""
    };

    const columns = Array.isArray(payload.columns)
      ? payload.columns
      : Array.isArray(artifact.columns)
        ? artifact.columns
        : [];
    const rows = Array.isArray(payload.rows)
      ? payload.rows
      : Array.isArray(artifact.rows)
        ? artifact.rows
        : [];

    const safeBase = String(
      payload.filename || artifact.id || artifact.title || "artifact-export"
    )
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "artifact-export";

    let ext = format;
    let mimeType = "text/csv; charset=utf-8";
    let content = "";

    if (format === "csv") {
      ext = "csv";
      mimeType = "text/csv; charset=utf-8";
      content = this._formatRowsAsCsv(columns, rows, ",");
    } else if (format === "xlsx" || format === "tsv") {
      ext = format === "xlsx" ? "xlsx" : "tsv";
      mimeType =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/tab-separated-values; charset=utf-8";
      content = this._formatRowsAsCsv(columns, rows, "\t");
    } else if (format === "pdf" || format === "html") {
      ext = format === "pdf" ? "pdf" : "html";
      mimeType = format === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
      const preview = this.resolveArtifactPreview({ artifact });
      content = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(artifact.title || safeBase)}</title></head><body>${preview.htmlPreview}</body></html>`;
    } else {
      ext = "md";
      mimeType = "text/markdown; charset=utf-8";
      content =
        String(artifact.content_markdown || artifact.contentMarkdown || "") ||
        this._formatRowsAsCsv(columns, rows, ",");
    }

    const filename = `${safeBase}.${ext}`;
    const exportsDir = path.join(this.dataDir, "exports");
    fs.mkdirSync(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, content, "utf8");

    return {
      success: true,
      artifactId: artifact.id,
      format,
      filename,
      filePath,
      content,
      mimeType,
      sizeBytes: Buffer.byteLength(content, "utf8")
    };
  }

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      case "synced-fs:read":
        return this.readFile(payload);
      case "synced-fs:write":
        return this.writeFile(payload);
      case "synced-fs:delete":
        return this.deleteFile(payload);
      case "synced-fs:list-versions":
        return this.listVersions(payload);
      case "synced-fs:read-version":
        return this.readVersion(payload);
      case "synced-fs:restore-version":
        return this.restoreVersion(payload);
      case "synced-fs:list-recently-deleted":
        return this.listRecentlyDeleted();
      case "synced-fs:restore-deleted":
        return this.restoreDeleted(payload);
      case "synced-fs:restore-all-deleted":
        return this.restoreAllDeleted();
      case "synced-fs:search":
      case "syncedFs:searchFiles":
        return this.searchFiles(payload);
      case "synced-fs:get-pending-shares-state":
        return {
          success: true,
          state: { pendingShares: [], acceptanceRules: [] }
        };
      case "fs:list-roots":
        return this.listRoots();
      case "fs:list-files":
        return this.fsListFiles(payload);
      case "fs:read-file":
        return this.fsReadFile(payload);
      case "fs:read-file-base64":
        return this.fsReadFileBase64(payload);
      case "fs:edit-file":
        return this.fsEditFile(payload);
      case "fs:copy-files-into-folder":
        return this.fsCopyFilesIntoFolder(payload);
      case "file:read-as-data-url":
      case "knowledge:read-file-data-url":
        return this.fileReadAsDataUrl(payload);
      case "file:save-as":
        return this.fileSaveAs(payload);
      case "knowledge:show-in-folder":
        return this.knowledgeShowInFolder(payload);
      case "artifact-db:create-capability-set":
        return this.createArtifactCapabilitySet(payload);
      case "artifact-db:request":
        return this.artifactDbRequest(payload);
      case "artifact-app:request":
      case "visual-artifacts:resolve-preview":
      case "document-viewer:get-source":
      case "artifact:get-bundle-file-url":
        return this.resolveArtifactPreview(payload);
      case "table:save-as-csv":
        return this.exportArtifact({ ...payload, format: "csv" });
      case "table:save-as-xlsx":
        return this.exportArtifact({ ...payload, format: "xlsx" });
      case "report:export-pdf":
        return this.exportArtifact({ ...payload, format: "pdf" });
      default:
        return null;
    }
  }
}

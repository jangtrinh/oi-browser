import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { McpClientBridge } from "../mcp-client-bridge.js";

function sanitizeHandle(raw = "") {
  const cleaned = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `db-${crypto.randomUUID().slice(0, 8)}`;
}

function introspectSqliteHandle(db, filePath, dbHandle, displayName) {
  const tableRows = db
    .prepare("SELECT name, type FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'wiki_fts_%' ORDER BY name ASC")
    .all();
  const tables = tableRows.map((t) => {
    const safeName = t.name.replace(/"/g, "");
    const cols = db.prepare(`PRAGMA table_info("${safeName}")`).all();
    let rowCount = 0;
    try {
      rowCount = Number(db.prepare(`SELECT COUNT(*) AS c FROM "${safeName}"`).get()?.c ?? 0);
    } catch {}
    return {
      schemaName: "main",
      tableName: t.name,
      tableType: "table",
      rowCount,
      columns: cols.map((c) => ({
        name: c.name,
        dataType: c.type || "TEXT",
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk === 1
      }))
    };
  });
  let sizeBytes = 4096;
  try {
    sizeBytes = fs.statSync(filePath).size;
  } catch {}
  return {
    dbHandle,
    name: displayName || dbHandle,
    tables,
    sizeBytes
  };
}

export class Spec006McpDatabasesService {
  constructor({ store, dataDir, mcpBridge } = {}) {
    this.store = store;
    this.dataDir = dataDir || (store?.dbPath ? path.dirname(store.dbPath) : path.join(process.cwd(), ".berry-data"));
    this.mcpBridge = mcpBridge || new McpClientBridge();
    if (this.store?.db) {
      this.initSchema();
    }
  }

  initSchema() {
    if (!this.store?.db) return;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_databases (
        db_handle TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        owner_id TEXT DEFAULT 'user-local',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_db_grants (
        id TEXT PRIMARY KEY,
        db_handle TEXT NOT NULL,
        email TEXT,
        grantee_label TEXT NOT NULL,
        grantee_type TEXT DEFAULT 'companion',
        role TEXT DEFAULT 'readwrite',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_db_companion_access (
        db_handle TEXT NOT NULL,
        companion_id TEXT NOT NULL,
        allowed INTEGER DEFAULT 1,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (db_handle, companion_id)
      );
      CREATE TABLE IF NOT EXISTS mcp_tool_permissions (
        tool_slug TEXT PRIMARY KEY,
        app_id TEXT,
        permission TEXT DEFAULT 'ask',
        updated_at INTEGER NOT NULL
      );
    `);
  }

  // ===========================================================================
  // FR-601: Live MCP Lifecycle & Permissions
  // ===========================================================================

  async registerMcp(payload = {}) {
    const rawName = payload.name || payload.serverName || payload.id || payload.appId || "custom-mcp";
    const slug = payload.id || payload.appId || `mcp-${String(rawName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
    const name = payload.name || payload.serverName || slug;
    const entryUrl =
      payload.url ||
      payload.entryUrl ||
      (payload.command ? `stdio://${payload.command}${Array.isArray(payload.args) && payload.args.length ? " " + payload.args.join(" ") : ""}` : "http://127.0.0.1:4104/mcp");

    const probe = await this.mcpBridge.probeServer({
      ...payload,
      id: slug,
      name,
      entryUrl
    });

    const toolSlugs = Array.isArray(probe.toolSlugs) && probe.toolSlugs.length > 0 ? probe.toolSlugs : [`${slug.replace(/[^a-z0-9]+/g, "_")}_execute`];
    const now = Date.now();

    this.store.db
      .prepare("INSERT OR REPLACE INTO integrations VALUES (?, ?, ?, ?, ?, ?, 1, ?)")
      .run(slug, name, payload.logoUrl || "/favicon.svg", entryUrl, `integration:${slug}`, JSON.stringify(toolSlugs), now);

    const permStmt = this.store.db.prepare(
      "INSERT OR IGNORE INTO mcp_tool_permissions (tool_slug, app_id, permission, updated_at) VALUES (?, ?, 'ask', ?)"
    );
    for (const toolSlug of toolSlugs) {
      permStmt.run(toolSlug, slug, now);
    }

    return {
      ok: true,
      success: true,
      appId: slug,
      id: slug,
      name,
      entryUrl,
      requiresAuth: Boolean(payload.requiresAuth),
      live: Boolean(probe.live),
      transport: probe.transport,
      toolSlugs,
      tools: probe.tools,
      integrations: this.store.listIntegrations()
    };
  }

  removeMcp(payload = {}) {
    const targetId = payload.appId || payload.id || payload.slug;
    if (!targetId) {
      return { ok: false, success: false, error: "appId is required" };
    }
    this.store.db
      .prepare("DELETE FROM integrations WHERE id = ? OR integration_name = ?")
      .run(targetId, `integration:${targetId}`);
    this.store.db
      .prepare("DELETE FROM mcp_tool_permissions WHERE app_id = ?")
      .run(targetId);

    return {
      ok: true,
      success: true,
      appId: targetId,
      integrations: this.store.listIntegrations()
    };
  }

  approveLocalMcp(payload = {}) {
    const targetId = payload.appId || payload.id;
    if (!targetId) {
      return { ok: false, success: false, error: "appId is required" };
    }
    const now = Date.now();
    const existing = this.store.db.prepare("SELECT * FROM integrations WHERE id = ?").get(targetId);
    if (existing) {
      this.store.db.prepare("UPDATE integrations SET is_connected = 1, updated_at = ? WHERE id = ?").run(now, targetId);
    } else {
      this.store.addCustomMcp({ id: targetId, name: payload.name || targetId, entryUrl: payload.entryUrl || "stdio://local" });
    }
    this.store.db
      .prepare("UPDATE mcp_tool_permissions SET permission = 'allow', updated_at = ? WHERE app_id = ?")
      .run(now, targetId);

    return {
      ok: true,
      success: true,
      appId: targetId,
      approved: true,
      integrations: this.store.listIntegrations()
    };
  }

  authenticateMcp(payload = {}) {
    const targetId = payload.appId || payload.id || payload.connectionId;
    if (!targetId) {
      return { ok: false, success: false, error: "appId is required" };
    }
    const now = Date.now();
    this.store.db.prepare("UPDATE integrations SET is_connected = 1, updated_at = ? WHERE id = ?").run(now, targetId);
    return {
      ok: true,
      success: true,
      appId: targetId,
      connectionId: payload.connectionId || `conn-${targetId}`,
      isAuthenticated: true,
      integrations: this.store.listIntegrations()
    };
  }

  connectApiKey(payload = {}) {
    const targetId = payload.appId || payload.id;
    const apiKey = payload.apiKey || payload.key || "";
    if (!targetId || !apiKey) {
      return { ok: false, success: false, error: "Both appId and apiKey are required" };
    }
    const now = Date.now();
    const existing = this.store.db.prepare("SELECT * FROM integrations WHERE id = ?").get(targetId);
    if (existing) {
      this.store.db.prepare("UPDATE integrations SET is_connected = 1, updated_at = ? WHERE id = ?").run(now, targetId);
    } else {
      this.store.addCustomMcp({ id: targetId, name: payload.name || targetId });
    }
    this.store.setSetting(`mcp_api_key:${targetId}`, { configured: true, updatedAt: now });
    return {
      ok: true,
      success: true,
      appId: targetId,
      isConnected: true,
      integrations: this.store.listIntegrations()
    };
  }

  async refreshIntegration(payload = {}) {
    const targetId = payload.appId || payload.id || payload.provider || payload.connectionId;
    const now = Date.now();
    if (targetId) {
      const row = this.store.db.prepare("SELECT * FROM integrations WHERE id = ?").get(targetId);
      if (row) {
        if (row.entry_url?.startsWith("stdio://") || row.id?.startsWith("mcp-")) {
          const probe = await this.mcpBridge.probeServer({
            id: row.id,
            name: row.name,
            entryUrl: row.entry_url,
            toolSlugs: JSON.parse(row.tool_slugs_json || "[]")
          });
          this.store.db
            .prepare("UPDATE integrations SET tool_slugs_json = ?, is_connected = 1, updated_at = ? WHERE id = ?")
            .run(JSON.stringify(probe.toolSlugs), now, row.id);
        } else {
          this.store.db.prepare("UPDATE integrations SET updated_at = ? WHERE id = ?").run(now, row.id);
        }
      }
    }
    return {
      ok: true,
      success: true,
      appId: targetId || null,
      refreshedAt: now,
      integrations: this.store.listIntegrations()
    };
  }

  getPermissionsMap() {
    const rows = this.store.db.prepare("SELECT tool_slug, app_id, permission, updated_at FROM mcp_tool_permissions").all();
    return new Map(rows.map((r) => [r.tool_slug, r]));
  }

  getTools() {
    const permMap = this.getPermissionsMap();
    const integrations = this.store.listIntegrations();
    const tools = integrations.flatMap((a) =>
      (a.toolSlugs || []).map((slug) => {
        const perm = permMap.get(slug)?.permission || "ask";
        return {
          appId: a.id,
          toolSlug: slug,
          name: slug.replace(/_/g, " "),
          description: `Công cụ ${slug} trên ${a.name}`,
          permission: perm,
          decision: perm
        };
      })
    );
    return { ok: true, success: true, tools };
  }

  listDangerousToolsPermissions() {
    const { tools } = this.getTools();
    return {
      ok: true,
      success: true,
      tools
    };
  }

  setToolPermissionGlobal(payload = {}) {
    const toolSlug = payload.toolSlug || payload.slug || payload.name;
    if (!toolSlug) {
      return { ok: false, success: false, error: "toolSlug is required" };
    }
    const permission = payload.decision || payload.permission || "ask";
    const appId = payload.appId || null;
    const now = Date.now();
    this.store.db
      .prepare("INSERT OR REPLACE INTO mcp_tool_permissions (tool_slug, app_id, permission, updated_at) VALUES (?, ?, ?, ?)")
      .run(toolSlug, appId, permission, now);
    return {
      ok: true,
      success: true,
      toolSlug,
      appId,
      permission,
      decision: permission
    };
  }

  getConnections() {
    const integrations = this.store.listIntegrations();
    return {
      ok: true,
      success: true,
      integrations: integrations.map((a, i) => ({
        id: a.id,
        name: a.name,
        logoUrl: a.logoUrl,
        entryUrl: a.entryUrl,
        toolSlugs: a.toolSlugs,
        isConnected: a.isConnected,
        isAuthenticated: a.isConnected,
        connectionId: `conn-oi-${i + 1}`,
        accountName: "local@oibrowser.vn",
        toolProvider: a.id.startsWith("mcp-") ? "custom-mcp" : "managed-mcp",
        healthKind: "healthy",
        tokenState: "valid",
        managed: { healthy: true },
        enabledServices: ["read", "write"]
      }))
    };
  }

  // ===========================================================================
  // FR-602: Multi-Database Provisioning & Write-Capable Agent SQL
  // ===========================================================================

  provisionDatabase(payload = {}) {
    const rawHandle = payload.dbHandle || payload.handle || payload.name || "agent-db";
    const dbHandle = sanitizeHandle(rawHandle);
    if (dbHandle === "berry-workspace-sqlite") {
      return { ok: false, success: false, error: { message: "berry-workspace-sqlite is reserved" } };
    }
    const name = payload.name || dbHandle;
    const dbDir = path.join(this.dataDir, "databases");
    fs.mkdirSync(dbDir, { recursive: true });
    const filePath = path.join(dbDir, `${dbHandle}.sqlite`);

    const targetDb = new DatabaseSync(filePath);
    try {
      targetDb.exec(`
        CREATE TABLE IF NOT EXISTS records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT,
          value TEXT,
          created_at INTEGER
        );
      `);
      if (typeof payload.initialSql === "string" && payload.initialSql.trim()) {
        targetDb.exec(payload.initialSql);
      }
    } finally {
      try { targetDb.close(); } catch {}
    }

    const now = Date.now();
    this.store.db
      .prepare("INSERT OR REPLACE INTO agent_databases (db_handle, name, file_path, owner_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(dbHandle, name, filePath, payload.ownerId || payload.companionId || "user-local", now);

    const database = {
      dbHandle,
      name,
      filePath,
      isOwner: true,
      accessKind: "owner",
      effectiveRole: "admin",
      status: "ready"
    };

    return {
      ok: true,
      success: true,
      database,
      databases: this.listDatabases().databases
    };
  }

  deleteDatabase(payload = {}) {
    const dbHandle = payload.dbHandle || payload.handle;
    if (!dbHandle || dbHandle === "berry-workspace-sqlite") {
      return {
        ok: false,
        success: false,
        error: { message: "Cannot delete system database berry-workspace-sqlite" }
      };
    }

    const row = this.store.db.prepare("SELECT * FROM agent_databases WHERE db_handle = ?").get(dbHandle);
    const filePath = row?.file_path || path.join(this.dataDir, "databases", `${dbHandle}.sqlite`);

    this.store.db.prepare("DELETE FROM agent_databases WHERE db_handle = ?").run(dbHandle);
    this.store.db.prepare("DELETE FROM agent_db_grants WHERE db_handle = ?").run(dbHandle);
    this.store.db.prepare("DELETE FROM agent_db_companion_access WHERE db_handle = ?").run(dbHandle);

    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        if (fs.existsSync(`${filePath}${suffix}`)) {
          fs.rmSync(`${filePath}${suffix}`, { force: true });
        }
      } catch {}
    }

    return {
      ok: true,
      success: true,
      deleted: dbHandle,
      databases: this.listDatabases().databases
    };
  }

  listDatabases() {
    const wsIntrospection = this.store.introspectDatabase();
    const workspaceList = wsIntrospection.databases || [
      {
        dbHandle: "berry-workspace-sqlite",
        name: "workspace.sqlite",
        isOwner: true,
        accessKind: "owner",
        effectiveRole: "admin",
        status: "ready"
      }
    ];

    const rows = this.store.db.prepare("SELECT * FROM agent_databases ORDER BY created_at ASC").all();
    const provisioned = rows.map((r) => {
      let sizeBytes = 4096;
      try {
        if (fs.existsSync(r.file_path)) {
          sizeBytes = fs.statSync(r.file_path).size;
        }
      } catch {}
      return {
        dbHandle: r.db_handle,
        name: r.name,
        filePath: r.file_path,
        ownerId: r.owner_id,
        isOwner: true,
        accessKind: "owner",
        effectiveRole: "admin",
        status: "ready",
        sizeBytes,
        createdAt: r.created_at
      };
    });

    return {
      ok: true,
      success: true,
      databases: [...workspaceList, ...provisioned]
    };
  }

  getDatabaseSchema(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const { databases } = this.listDatabases();
    if (dbHandle === "berry-workspace-sqlite") {
      const ws = this.store.introspectDatabase();
      return {
        ok: true,
        success: true,
        dbHandle,
        tables: ws.tables,
        dbBytes: ws.dbBytes,
        databases
      };
    }

    const row = this.store.db.prepare("SELECT * FROM agent_databases WHERE db_handle = ?").get(dbHandle);
    const filePath = row?.file_path || path.join(this.dataDir, "databases", `${dbHandle}.sqlite`);
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        success: false,
        error: { message: `Database not found: ${dbHandle}` },
        tables: [],
        databases
      };
    }

    const targetDb = new DatabaseSync(filePath);
    try {
      const info = introspectSqliteHandle(targetDb, filePath, dbHandle, row?.name || dbHandle);
      return {
        ok: true,
        success: true,
        dbHandle,
        tables: info.tables,
        dbBytes: info.sizeBytes,
        databases
      };
    } finally {
      try { targetDb.close(); } catch {}
    }
  }

  executeSql(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const trimmed = String(payload.sql || payload.query || "").trim();
    if (!trimmed) {
      return { ok: false, success: false, error: { message: "SQL query is required" } };
    }

    const isReadQuery = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed);

    if (dbHandle === "berry-workspace-sqlite") {
      try {
        if (isReadQuery) {
          const rows = this.store.db.prepare(trimmed).all();
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          return { ok: true, success: true, dbHandle, columns, rows, rowCount: rows.length };
        }
        if (/^(DROP\s+TABLE|ALTER\s+TABLE)\s+(tabs|companions|chat_messages|routines|artifacts|meetings|integrations|workspace_settings)\b/i.test(trimmed)) {
          return { ok: false, success: false, error: { message: "Cannot drop or alter core system tables" } };
        }
        const info = this.store.db.prepare(trimmed).run();
        return {
          ok: true,
          success: true,
          dbHandle,
          columns: [],
          rows: [],
          rowCount: Number(info?.changes ?? 0),
          changes: Number(info?.changes ?? 0),
          lastInsertRowid: Number(info?.lastInsertRowid ?? 0)
        };
      } catch (err) {
        return { ok: false, success: false, error: { message: err.message } };
      }
    }

    const row = this.store.db.prepare("SELECT * FROM agent_databases WHERE db_handle = ?").get(dbHandle);
    const filePath = row?.file_path || path.join(this.dataDir, "databases", `${dbHandle}.sqlite`);
    if (!fs.existsSync(filePath)) {
      return { ok: false, success: false, error: { message: `Database not found: ${dbHandle}` } };
    }

    const targetDb = new DatabaseSync(filePath);
    try {
      if (isReadQuery) {
        const rows = targetDb.prepare(trimmed).all();
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return {
          ok: true,
          success: true,
          dbHandle,
          columns,
          rows,
          rowCount: rows.length
        };
      }
      try {
        const info = targetDb.prepare(trimmed).run();
        return {
          ok: true,
          success: true,
          dbHandle,
          columns: [],
          rows: [],
          rowCount: Number(info?.changes ?? 0),
          changes: Number(info?.changes ?? 0),
          lastInsertRowid: Number(info?.lastInsertRowid ?? 0)
        };
      } catch (singleErr) {
        if (trimmed.includes(";")) {
          targetDb.exec(trimmed);
          return {
            ok: true,
            success: true,
            dbHandle,
            columns: [],
            rows: [],
            rowCount: 0,
            changes: 0
          };
        }
        throw singleErr;
      }
    } catch (err) {
      return { ok: false, success: false, error: { message: err.message } };
    } finally {
      try { targetDb.close(); } catch {}
    }
  }

  // ===========================================================================
  // FR-603: Database Grants & Companion Access Persistence
  // ===========================================================================

  shareGrant(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const email = payload.email ? String(payload.email).trim() : null;
    const granteeLabel = payload.granteeLabel || email || payload.companionId || "Companion Grantee";
    const granteeType = payload.granteeType || (email ? "user" : "companion");
    const role = payload.role || "readwrite";
    const now = Date.now();

    const existing = email
      ? this.store.db.prepare("SELECT * FROM agent_db_grants WHERE db_handle = ? AND email = ?").get(dbHandle, email)
      : this.store.db.prepare("SELECT * FROM agent_db_grants WHERE db_handle = ? AND grantee_label = ?").get(dbHandle, granteeLabel);

    const id = existing?.id || payload.id || `grant-${crypto.randomUUID().slice(0, 8)}`;
    this.store.db
      .prepare(
        "INSERT OR REPLACE INTO agent_db_grants (id, db_handle, email, grantee_label, grantee_type, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, dbHandle, email, granteeLabel, granteeType, role, now);

    return {
      ok: true,
      success: true,
      dbHandle,
      grant: {
        id,
        dbHandle,
        email,
        granteeLabel,
        granteeType,
        role,
        createdAt: now
      },
      grants: this.listGrants({ dbHandle }).grants
    };
  }

  revokeGrant(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const id = payload.id || payload.grantId || null;
    const email = payload.email ? String(payload.email).trim() : null;
    const granteeLabel = payload.granteeLabel || null;

    if (id) {
      this.store.db.prepare("DELETE FROM agent_db_grants WHERE db_handle = ? AND id = ?").run(dbHandle, id);
    } else if (email) {
      this.store.db.prepare("DELETE FROM agent_db_grants WHERE db_handle = ? AND (email = ? OR grantee_label = ?)").run(dbHandle, email, email);
    } else if (granteeLabel) {
      this.store.db.prepare("DELETE FROM agent_db_grants WHERE db_handle = ? AND grantee_label = ?").run(dbHandle, granteeLabel);
    }

    return {
      ok: true,
      success: true,
      dbHandle,
      grants: this.listGrants({ dbHandle }).grants
    };
  }

  listGrants(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const rows = this.store.db
      .prepare("SELECT * FROM agent_db_grants WHERE db_handle = ? ORDER BY created_at ASC")
      .all(dbHandle);
    const grants = rows.map((r) => ({
      id: r.id,
      dbHandle: r.db_handle,
      email: r.email,
      granteeLabel: r.grantee_label,
      granteeType: r.grantee_type,
      role: r.role,
      createdAt: r.created_at
    }));
    return {
      ok: true,
      success: true,
      dbHandle,
      grants
    };
  }

  setCompanionAccess(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const now = Date.now();

    if (Array.isArray(payload.companions)) {
      const allowedSet = new Set(payload.companions.map(String));
      const allCompanions = this.store.listCompanions().map((c) => c.id);
      const universe = new Set([...allCompanions, ...allowedSet]);
      const stmt = this.store.db.prepare(
        "INSERT OR REPLACE INTO agent_db_companion_access (db_handle, companion_id, allowed, updated_at) VALUES (?, ?, ?, ?)"
      );
      for (const cid of universe) {
        stmt.run(dbHandle, cid, allowedSet.has(cid) ? 1 : 0, now);
      }
    } else if (payload.companionId) {
      const allowed = payload.allowed !== undefined ? (payload.allowed ? 1 : 0) : 1;
      this.store.db
        .prepare(
          "INSERT OR REPLACE INTO agent_db_companion_access (db_handle, companion_id, allowed, updated_at) VALUES (?, ?, ?, ?)"
        )
        .run(dbHandle, String(payload.companionId), allowed, now);
    }

    return this.getCompanionAccess({ dbHandle });
  }

  getCompanionAccess(payload = {}) {
    const dbHandle = payload.dbHandle || "berry-workspace-sqlite";
    const rows = this.store.db
      .prepare("SELECT * FROM agent_db_companion_access WHERE db_handle = ? ORDER BY companion_id ASC")
      .all(dbHandle);

    if (rows.length === 0) {
      const companions = this.store.listCompanions().map((c) => c.id);
      return {
        ok: true,
        success: true,
        dbHandle,
        whitelistActive: false,
        companions,
        accessList: []
      };
    }

    const allowedCompanions = rows.filter((r) => r.allowed === 1).map((r) => r.companion_id);
    const accessList = rows.map((r) => ({
      dbHandle: r.db_handle,
      companionId: r.companion_id,
      allowed: Boolean(r.allowed),
      updatedAt: r.updated_at
    }));

    return {
      ok: true,
      success: true,
      dbHandle,
      whitelistActive: true,
      companions: allowedCompanions,
      accessList
    };
  }

  // ===========================================================================
  // Unified 24-Channel Dispatcher
  // ===========================================================================

  async handleChannel(channel, payload = {}) {
    switch (channel) {
      // MCP Lifecycle & Permissions (FR-601)
      case "integration:register-mcp":
      case "integration:add-custom-mcp":
      case "integration:create-custom":
        return await this.registerMcp(payload);
      case "integration:remove-mcp":
        return this.removeMcp(payload);
      case "integration:approve-local-mcp":
        return this.approveLocalMcp(payload);
      case "integration:authenticate-mcp":
        return this.authenticateMcp(payload);
      case "integration:connect-api-key":
        return this.connectApiKey(payload);
      case "integration:refresh":
      case "integrations:refresh-connection":
        return await this.refreshIntegration(payload);
      case "integration:list-dangerous-tools-permissions":
        return this.listDangerousToolsPermissions(payload);
      case "integration:set-tool-permission-global":
        return this.setToolPermissionGlobal(payload);
      case "integration:get-tools":
        return this.getTools();
      case "integration:get-connections":
        return this.getConnections();
      case "integration:connect":
      case "integration:disconnect": {
        const isConnected = channel === "integration:connect";
        const targetId = payload.id || payload.appId || payload.integration?.id;
        const integrations = this.store.toggleIntegration(targetId, isConnected);
        return { ok: true, success: true, isConnected, integrations };
      }
      case "integration:pipedream-search-apps":
      case "apps:get-all":
        return { ok: true, success: true, apps: this.store.listIntegrations() };
      case "integration:reset-code-integration": {
        const targetId = payload.appId || payload.id;
        if (targetId) this.store.toggleIntegration(targetId, true);
        return { ok: true, success: true, appId: targetId };
      }
      case "integration:call-tool":
        return await this.mcpBridge.callTool(payload, payload);
      case "integration:get-domain-app-action":
        return { ok: true, success: true, action: null };
      case "integration:get-domain-app-suggestion":
        return { ok: true, success: true, show: false };
      case "integration:dismiss-domain-app-suggestion":
      case "integration:close-domain-app-suggestion":
      case "integration:show-domain-app-suggestion":
        return { ok: true, success: true };
      case "integration:get-domain-app-suggestion-data":
        return null;
      case "integration:get-gmail-thread-reply-recipient":
        return { ok: true, success: true, recipient: null };
      case "integrations:searchAppMentions": {
        const integrations = this.store.listIntegrations();
        return {
          ok: true,
          success: true,
          mentions: integrations.map((a) => ({
            id: a.id,
            name: a.name,
            logoUrl: a.logoUrl,
            integrationName: a.integrationName,
            isConnected: a.isConnected
          }))
        };
      }

      // Multi-Database Provisioning & Write-Capable Agent SQL (FR-602)
      case "agent-db:provision-database":
        return this.provisionDatabase(payload);
      case "agent-db:delete-database":
        return this.deleteDatabase(payload);
      case "agent-db:list-databases":
        return this.listDatabases();
      case "agent-db:get-schema":
        return this.getDatabaseSchema(payload);
      case "agent-db:execute-sql":
      case "agent-db:query":
        return this.executeSql(payload);

      // Database Grants & Companion Access (FR-603)
      case "agent-db:share-grant":
        return this.shareGrant(payload);
      case "agent-db:revoke-grant":
        return this.revokeGrant(payload);
      case "agent-db:list-grants":
        return this.listGrants(payload);
      case "agent-db:get-companion-access":
        return this.getCompanionAccess(payload);
      case "agent-db:set-companion-access":
        return this.setCompanionAccess(payload);

      default:
        return null;
    }
  }
}

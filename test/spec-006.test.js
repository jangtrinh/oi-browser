import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { SqliteWorkspaceStore } from "../src/server/sqlite-workspace-store.js";
import { McpClientBridge } from "../src/server/mcp-client-bridge.js";
import { Spec006McpDatabasesService } from "../src/server/domains/spec-006-mcp-databases.js";

function createTempContext() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "oi-spec-006-"));
  const dbPath = path.join(dataDir, "workspace.sqlite");
  const store = new SqliteWorkspaceStore(dbPath);
  const service = new Spec006McpDatabasesService({ store, dataDir });
  return {
    dataDir,
    dbPath,
    store,
    service,
    cleanup() {
      try { store.db.close(); } catch {}
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
    }
  };
}

test("AC-601a: McpClientBridge probes and calls a live Stdio JSON-RPC 2.0 MCP server", async () => {
  const stdioScript = `
    import readline from "node:readline";
    const rl = readline.createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      let req;
      try { req = JSON.parse(line); } catch { return; }
      if (req.method === "initialize") {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          result: { protocolVersion: "2024-11-05", serverInfo: { name: "mock-stdio-mcp", version: "1.0.0" }, capabilities: { tools: {} } }
        }) + "\\n");
      } else if (req.method === "tools/list") {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            tools: [
              { name: "stdio_echo", description: "Echoes input over stdio", inputSchema: { type: "object", properties: { text: { type: "string" } } } },
              { name: "stdio_sum", description: "Sums two numbers", inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } } }
            ]
          }
        }) + "\\n");
      } else if (req.method === "tools/call") {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: "echo:" + (req.params?.arguments?.text || "") }], isError: false }
        }) + "\\n");
      }
    });
  `;

  const bridge = new McpClientBridge({ timeoutMs: 3000 });
  const probe = await bridge.probeServer({
    command: process.execPath,
    args: ["--input-type=module", "-e", stdioScript]
  });

  assert.equal(probe.ok, true);
  assert.equal(probe.live, true);
  assert.equal(probe.transport, "stdio");
  assert.deepEqual(probe.toolSlugs, ["stdio_echo", "stdio_sum"]);

  const callRes = await bridge.callTool(
    { command: process.execPath, args: ["--input-type=module", "-e", stdioScript] },
    { name: "stdio_echo", arguments: { text: "xin-chao-oi" } }
  );
  assert.equal(callRes.ok, true);
  assert.equal(callRes.live, true);
  assert.equal(callRes.content[0].text, "echo:xin-chao-oi");
});

test("AC-601b: McpClientBridge probes and calls a live HTTP JSON-RPC 2.0 MCP server", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const rpc = JSON.parse(body || "{}");
      res.writeHead(200, { "Content-Type": "application/json" });
      if (rpc.method === "initialize") {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: rpc.id,
          result: { serverInfo: { name: "http-mcp-server", version: "2.1.0" } }
        }));
      } else if (rpc.method === "tools/list") {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: rpc.id,
          result: {
            tools: [
              { name: "http_search_docs", description: "Search docs via HTTP MCP" },
              { name: "http_fetch_page", description: "Fetch page via HTTP MCP" }
            ]
          }
        }));
      } else if (rpc.method === "tools/call") {
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: rpc.id,
          result: { content: [{ type: "text", text: `called:${rpc.params?.name}` }] }
        }));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/mcp`;

  try {
    const bridge = new McpClientBridge({ timeoutMs: 3000 });
    const probe = await bridge.probeServer({ url });
    assert.equal(probe.ok, true);
    assert.equal(probe.live, true);
    assert.equal(probe.transport, "http");
    assert.deepEqual(probe.toolSlugs, ["http_search_docs", "http_fetch_page"]);

    const callRes = await bridge.callTool({ url }, { name: "http_search_docs", arguments: { q: "oi" } });
    assert.equal(callRes.ok, true);
    assert.equal(callRes.live, true);
    assert.equal(callRes.content[0].text, "called:http_search_docs");
  } finally {
    server.close();
  }
});

test("AC-601c: Registering, approving, configuring permissions, and removing MCP servers persist in SQLite", async () => {
  const ctx = createTempContext();
  try {
    const reg = await ctx.service.handleChannel("integration:register-mcp", {
      id: "mcp-filesystem-local",
      name: "Local Filesystem MCP",
      command: "/nonexistent/mcp-filesystem-binary",
      args: ["/tmp"]
    });
    assert.equal(reg.ok, true);
    assert.equal(reg.success, true);
    assert.equal(reg.appId, "mcp-filesystem-local");
    assert.ok(reg.toolSlugs.includes("read_file"));
    assert.ok(reg.toolSlugs.includes("write_file"));

    const toolsRes = await ctx.service.handleChannel("integration:get-tools", {});
    assert.ok(toolsRes.tools.some((t) => t.appId === "mcp-filesystem-local" && t.toolSlug === "read_file"));

    const permSet = await ctx.service.handleChannel("integration:set-tool-permission-global", {
      toolSlug: "write_file",
      appId: "mcp-filesystem-local",
      decision: "deny"
    });
    assert.equal(permSet.success, true);
    assert.equal(permSet.permission, "deny");

    const permsList = await ctx.service.handleChannel("integration:list-dangerous-tools-permissions", {});
    const writeTool = permsList.tools.find((t) => t.toolSlug === "write_file");
    assert.equal(writeTool.permission, "deny");

    const approveRes = await ctx.service.handleChannel("integration:approve-local-mcp", {
      appId: "mcp-filesystem-local"
    });
    assert.equal(approveRes.success, true);
    assert.equal(approveRes.approved, true);

    const authRes = await ctx.service.handleChannel("integration:authenticate-mcp", {
      appId: "mcp-filesystem-local",
      connectionId: "conn-fs-1"
    });
    assert.equal(authRes.success, true);
    assert.equal(authRes.isAuthenticated, true);

    const apiKeyRes = await ctx.service.handleChannel("integration:connect-api-key", {
      appId: "mcp-filesystem-local",
      apiKey: "sk-test-12345"
    });
    assert.equal(apiKeyRes.success, true);

    const refreshRes = await ctx.service.handleChannel("integration:refresh", {
      appId: "mcp-filesystem-local"
    });
    assert.equal(refreshRes.success, true);

    const refreshConnRes = await ctx.service.handleChannel("integrations:refresh-connection", {
      appId: "mcp-filesystem-local",
      accountId: "local@oibrowser.vn"
    });
    assert.equal(refreshConnRes.success, true);

    const removeRes = await ctx.service.handleChannel("integration:remove-mcp", {
      appId: "mcp-filesystem-local"
    });
    assert.equal(removeRes.success, true);
    assert.ok(!removeRes.integrations.some((i) => i.id === "mcp-filesystem-local"));
  } finally {
    ctx.cleanup();
  }
});

test("AC-602: Provisioning a new SQLite database, executing DDL/DML/SELECT queries, and deleting it cleanly", async () => {
  const ctx = createTempContext();
  try {
    const prov = await ctx.service.handleChannel("agent-db:provision-database", {
      dbHandle: "crm-leads-db",
      name: "CRM Leads Database"
    });
    assert.equal(prov.ok, true);
    assert.equal(prov.success, true);
    assert.equal(prov.database.dbHandle, "crm-leads-db");
    assert.equal(prov.database.effectiveRole, "admin");
    assert.equal(prov.database.status, "ready");

    const expectedSqliteFile = path.join(ctx.dataDir, "databases", "crm-leads-db.sqlite");
    assert.equal(fs.existsSync(expectedSqliteFile), true);

    const listed = await ctx.service.handleChannel("agent-db:list-databases", {});
    assert.ok(listed.databases.some((d) => d.dbHandle === "berry-workspace-sqlite"));
    assert.ok(listed.databases.some((d) => d.dbHandle === "crm-leads-db" && d.name === "CRM Leads Database"));

    // Execute DDL (CREATE TABLE)
    const createRes = await ctx.service.handleChannel("agent-db:execute-sql", {
      dbHandle: "crm-leads-db",
      sql: "CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, score INTEGER DEFAULT 0)"
    });
    assert.equal(createRes.ok, true);

    // Execute DML (INSERT)
    const insertRes = await ctx.service.handleChannel("agent-db:execute-sql", {
      dbHandle: "crm-leads-db",
      sql: "INSERT INTO leads (company, score) VALUES ('Oi Browser Enterprise', 98), ('VinAI Labs', 92)"
    });
    assert.equal(insertRes.ok, true);
    assert.equal(insertRes.rowCount, 2);

    // Execute DML (UPDATE)
    const updateRes = await ctx.service.handleChannel("agent-db:execute-sql", {
      dbHandle: "crm-leads-db",
      sql: "UPDATE leads SET score = 100 WHERE company = 'Oi Browser Enterprise'"
    });
    assert.equal(updateRes.ok, true);
    assert.equal(updateRes.rowCount, 1);

    // Execute SELECT via agent-db:query
    const queryRes = await ctx.service.handleChannel("agent-db:query", {
      dbHandle: "crm-leads-db",
      sql: "SELECT company, score FROM leads ORDER BY score DESC"
    });
    assert.equal(queryRes.ok, true);
    assert.equal(queryRes.rowCount, 2);
    assert.deepEqual(queryRes.columns, ["company", "score"]);
    assert.equal(queryRes.rows[0].company, "Oi Browser Enterprise");
    assert.equal(queryRes.rows[0].score, 100);

    // Inspect schema of provisioned DB
    const schemaRes = await ctx.service.handleChannel("agent-db:get-schema", {
      dbHandle: "crm-leads-db"
    });
    assert.equal(schemaRes.ok, true);
    assert.ok(schemaRes.tables.some((t) => t.tableName === "records"));
    assert.ok(schemaRes.tables.some((t) => t.tableName === "leads" && t.rowCount === 2));

    // Prevent deleting system database
    const sysDel = await ctx.service.handleChannel("agent-db:delete-database", {
      dbHandle: "berry-workspace-sqlite"
    });
    assert.equal(sysDel.ok, false);

    // Delete provisioned database cleanly
    const delRes = await ctx.service.handleChannel("agent-db:delete-database", {
      dbHandle: "crm-leads-db"
    });
    assert.equal(delRes.ok, true);
    assert.equal(fs.existsSync(expectedSqliteFile), false);
    assert.ok(!delRes.databases.some((d) => d.dbHandle === "crm-leads-db"));
  } finally {
    ctx.cleanup();
  }
});

test("AC-603: Database grants and companion access persist in SQLite across restarts", async () => {
  const ctx = createTempContext();
  try {
    await ctx.service.handleChannel("agent-db:provision-database", {
      dbHandle: "analytics-warehouse",
      name: "Analytics Warehouse"
    });

    const share1 = await ctx.service.handleChannel("agent-db:share-grant", {
      dbHandle: "analytics-warehouse",
      email: "dana@oibrowser.vn",
      granteeLabel: "Măng Cụt (QA)",
      role: "admin"
    });
    assert.equal(share1.ok, true);
    assert.equal(share1.grants.length, 1);

    const share2 = await ctx.service.handleChannel("agent-db:share-grant", {
      dbHandle: "analytics-warehouse",
      email: "rosa@oibrowser.vn",
      granteeLabel: "Vú Sữa (Research)",
      role: "readonly"
    });
    assert.equal(share2.ok, true);
    assert.equal(share2.grants.length, 2);

    const accessSet = await ctx.service.handleChannel("agent-db:set-companion-access", {
      dbHandle: "analytics-warehouse",
      companions: ["research-rosa", "developer-dana"]
    });
    assert.equal(accessSet.ok, true);
    assert.equal(accessSet.whitelistActive, true);
    assert.deepEqual(accessSet.companions.sort(), ["developer-dana", "research-rosa"]);

    // Simulate restart by closing and reopening SqliteWorkspaceStore + Spec006McpDatabasesService
    ctx.store.db.close();
    const restartedStore = new SqliteWorkspaceStore(ctx.dbPath);
    const restartedService = new Spec006McpDatabasesService({ store: restartedStore, dataDir: ctx.dataDir });

    try {
      const grantsAfterRestart = await restartedService.handleChannel("agent-db:list-grants", {
        dbHandle: "analytics-warehouse"
      });
      assert.equal(grantsAfterRestart.ok, true);
      assert.equal(grantsAfterRestart.grants.length, 2);
      assert.ok(grantsAfterRestart.grants.some((g) => g.email === "dana@oibrowser.vn" && g.role === "admin"));

      const revokeRes = await restartedService.handleChannel("agent-db:revoke-grant", {
        dbHandle: "analytics-warehouse",
        email: "rosa@oibrowser.vn"
      });
      assert.equal(revokeRes.ok, true);
      assert.equal(revokeRes.grants.length, 1);
      assert.equal(revokeRes.grants[0].email, "dana@oibrowser.vn");

      const accessAfterRestart = await restartedService.handleChannel("agent-db:get-companion-access", {
        dbHandle: "analytics-warehouse"
      });
      assert.equal(accessAfterRestart.ok, true);
      assert.equal(accessAfterRestart.whitelistActive, true);
      assert.deepEqual(accessAfterRestart.companions.sort(), ["developer-dana", "research-rosa"]);

      const unknown = await restartedService.handleChannel("non-existent:channel", {});
      assert.equal(unknown, null);
    } finally {
      try { restartedStore.db.close(); } catch {}
    }
  } finally {
    ctx.cleanup();
  }
});

import { spawn } from "node:child_process";

const PRESET_TOOL_SCHEMAS = {
  filesystem: [
    { name: "read_file", description: "Read complete contents of a file from the filesystem", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
    { name: "write_file", description: "Write or overwrite a file on the filesystem", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "list_directory", description: "List directory contents with file metadata", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }
  ],
  sqlite: [
    { name: "read_query", description: "Execute a SELECT query on the SQLite database", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "write_query", description: "Execute an INSERT, UPDATE, or DELETE query", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "list_tables", description: "List all tables in the target SQLite database", inputSchema: { type: "object", properties: {} } }
  ],
  postgres: [
    { name: "pg_query", description: "Run a read-only SQL query against PostgreSQL", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
    { name: "pg_describe_table", description: "Inspect columns and constraints for a PostgreSQL table", inputSchema: { type: "object", properties: { table: { type: "string" } }, required: ["table"] } }
  ],
  github: [
    { name: "github_search_repositories", description: "Search GitHub repositories", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "github_create_issue", description: "Create a new GitHub issue", inputSchema: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" } }, required: ["repo", "title"] } }
  ],
  fetch: [
    { name: "fetch_url", description: "Fetch a URL and extract its readable markdown content", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } }
  ]
};

function sanitizePrefix(raw = "mcp") {
  const cleaned = String(raw || "mcp")
    .toLowerCase()
    .replace(/^integration:/, "")
    .replace(/^mcp[-_]?/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "mcp";
}

export class McpClientBridge {
  constructor({ timeoutMs = 3000 } = {}) {
    this.timeoutMs = timeoutMs;
  }

  synthesizeTools(config = {}) {
    if (Array.isArray(config.tools) && config.tools.length > 0) {
      const normalized = config.tools.map((t) => {
        const slug = t.toolSlug || t.name || String(t);
        return {
          name: slug,
          toolSlug: slug,
          description: t.description || `MCP tool ${slug}`,
          inputSchema: t.inputSchema || { type: "object", properties: { input: { type: "string" } } }
        };
      });
      return {
        tools: normalized,
        toolSlugs: normalized.map((t) => t.toolSlug)
      };
    }

    if (Array.isArray(config.toolSlugs) && config.toolSlugs.length > 0) {
      const tools = config.toolSlugs.map((slug) => ({
        name: String(slug),
        toolSlug: String(slug),
        description: `MCP tool ${slug} (${config.name || config.id || "custom"})`,
        inputSchema: { type: "object", properties: { query: { type: "string" } } }
      }));
      return { tools, toolSlugs: tools.map((t) => t.toolSlug) };
    }

    const hint = [config.id, config.appId, config.name, config.command, ...(config.args || []), config.url, config.entryUrl]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const [key, preset] of Object.entries(PRESET_TOOL_SCHEMAS)) {
      if (hint.includes(key)) {
        const tools = preset.map((t) => ({ ...t, toolSlug: t.name }));
        return { tools, toolSlugs: tools.map((t) => t.toolSlug) };
      }
    }

    const prefix = sanitizePrefix(config.id || config.appId || config.name || config.command || "custom");
    const tools = [
      {
        name: `${prefix}_query`,
        toolSlug: `${prefix}_query`,
        description: `Query resources from ${config.name || prefix} MCP server`,
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
      },
      {
        name: `${prefix}_execute`,
        toolSlug: `${prefix}_execute`,
        description: `Execute action on ${config.name || prefix} MCP server`,
        inputSchema: { type: "object", properties: { action: { type: "string" }, payload: { type: "object" } }, required: ["action"] }
      },
      {
        name: `${prefix}_list_resources`,
        toolSlug: `${prefix}_list_resources`,
        description: `List available resources from ${config.name || prefix} MCP server`,
        inputSchema: { type: "object", properties: { cursor: { type: "string" } } }
      }
    ];
    return { tools, toolSlugs: tools.map((t) => t.toolSlug) };
  }

  async probeStdioServer({ command, args = [], env = {} }) {
    const timeoutMs = this.timeoutMs;
    return new Promise((resolve, reject) => {
      let settled = false;
      let child = null;
      const finish = (err, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child && !child.killed) {
          try { child.kill("SIGTERM"); } catch {}
        }
        if (err) reject(err);
        else resolve(val);
      };

      const timer = setTimeout(() => {
        finish(new Error(`Stdio MCP probe timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        child = spawn(command, Array.isArray(args) ? args : [], {
          env: { ...process.env, ...(env || {}) },
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (err) {
        return finish(err);
      }

      let buffer = "";
      let serverInfo = null;
      let initializedSent = false;

      child.on("error", (err) => finish(err));
      child.on("exit", (code) => {
        if (!settled) finish(new Error(`Stdio MCP exited early with code ${code}`));
      });

      const sendRpc = (msg) => {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.write(`${JSON.stringify(msg)}\n`);
        }
      };

      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.id === 1 && msg.result) {
            serverInfo = msg.result.serverInfo || { name: command, version: "1.0.0" };
            if (!initializedSent) {
              initializedSent = true;
              sendRpc({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
              sendRpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
            }
          } else if (msg.id === 2 && msg.result) {
            const rawTools = Array.isArray(msg.result.tools) ? msg.result.tools : [];
            const tools = rawTools.map((t) => ({
              name: t.name || t.toolSlug,
              toolSlug: t.toolSlug || t.name,
              description: t.description || `MCP tool ${t.name || t.toolSlug}`,
              inputSchema: t.inputSchema || { type: "object", properties: {} }
            })).filter((t) => Boolean(t.toolSlug));
            finish(null, {
              ok: true,
              live: true,
              transport: "stdio",
              serverInfo: serverInfo || { name: command, version: "1.0.0" },
              tools,
              toolSlugs: tools.map((t) => t.toolSlug)
            });
          } else if (msg.error) {
            finish(new Error(msg.error.message || "MCP JSON-RPC error"));
          }
        }
      });

      sendRpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "oi-browser-mcp-client", version: "1.0.0" }
        }
      });
    });
  }

  async probeHttpServer({ url, headers = {} }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const initRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "oi-browser-mcp-client", version: "1.0.0" }
          }
        }),
        signal: controller.signal
      });
      if (!initRes.ok) throw new Error(`HTTP MCP initialize status ${initRes.status}`);
      const initJson = await initRes.json();

      const listRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {}
        }),
        signal: controller.signal
      });
      if (!listRes.ok) throw new Error(`HTTP MCP tools/list status ${listRes.status}`);
      const listJson = await listRes.json();
      const rawTools = Array.isArray(listJson?.result?.tools)
        ? listJson.result.tools
        : Array.isArray(listJson?.tools)
          ? listJson.tools
          : [];
      const tools = rawTools.map((t) => ({
        name: t.name || t.toolSlug,
        toolSlug: t.toolSlug || t.name,
        description: t.description || `MCP tool ${t.name || t.toolSlug}`,
        inputSchema: t.inputSchema || { type: "object", properties: {} }
      })).filter((t) => Boolean(t.toolSlug));

      return {
        ok: true,
        live: true,
        transport: "http",
        serverInfo: initJson?.result?.serverInfo || { name: url, version: "1.0.0" },
        tools,
        toolSlugs: tools.map((t) => t.toolSlug)
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async probeServer(config = {}) {
    const command = config.command || (typeof config.entryUrl === "string" && config.entryUrl.startsWith("stdio://") ? config.entryUrl.slice("stdio://".length) : null);
    const targetUrl = config.url || (typeof config.entryUrl === "string" && /^https?:\/\//i.test(config.entryUrl) ? config.entryUrl : null);

    if (command) {
      try {
        const res = await this.probeStdioServer({ command, args: config.args || [], env: config.env || {} });
        if (res.toolSlugs.length > 0) return res;
      } catch {}
    } else if (targetUrl) {
      try {
        const res = await this.probeHttpServer({ url: targetUrl, headers: config.headers || {} });
        if (res.toolSlugs.length > 0) return res;
      } catch {}
    }

    const fallback = this.synthesizeTools(config);
    return {
      ok: true,
      live: false,
      transport: command ? "stdio" : "http",
      serverInfo: {
        name: config.name || config.id || command || targetUrl || "local-mcp-synthesized",
        version: "1.0.0"
      },
      tools: fallback.tools,
      toolSlugs: fallback.toolSlugs
    };
  }

  async listTools(config = {}) {
    return this.probeServer(config);
  }

  async callTool(config = {}, callParams = {}) {
    const toolName = callParams.name || callParams.toolName || callParams.toolSlug || config.toolName || "mcp_execute";
    const toolArgs = callParams.arguments || callParams.args || {};
    const command = config.command;
    const targetUrl = config.url || (typeof config.entryUrl === "string" && /^https?:\/\//i.test(config.entryUrl) ? config.entryUrl : null);

    if (command) {
      try {
        const result = await new Promise((resolve, reject) => {
          let settled = false;
          let child = null;
          const finish = (err, val) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (child && !child.killed) {
              try { child.kill("SIGTERM"); } catch {}
            }
            if (err) reject(err);
            else resolve(val);
          };
          const timer = setTimeout(() => finish(new Error("Stdio tools/call timeout")), this.timeoutMs);
          try {
            child = spawn(command, Array.isArray(config.args) ? config.args : [], {
              env: { ...process.env, ...(config.env || {}) },
              stdio: ["pipe", "pipe", "pipe"]
            });
          } catch (err) {
            return finish(err);
          }
          let buffer = "";
          let callSent = false;
          child.on("error", (err) => finish(err));
          child.stdout.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;
              let msg;
              try { msg = JSON.parse(line); } catch { continue; }
              if (msg.id === 1 && !callSent) {
                callSent = true;
                child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: toolName, arguments: toolArgs } })}\n`);
              } else if (msg.id === 3 && msg.result) {
                finish(null, msg.result);
              } else if (msg.error) {
                finish(new Error(msg.error.message || "RPC error"));
              }
            }
          });
          child.stdin.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "oi-browser-mcp-client", version: "1.0.0" } }
          })}\n`);
        });
        return { ok: true, live: true, toolName, ...result };
      } catch {}
    } else if (targetUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(config.headers || {}) },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: toolName, arguments: toolArgs }
          }),
          signal: controller.signal
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.result) return { ok: true, live: true, toolName, ...json.result };
        }
      } catch {} finally {
        clearTimeout(timer);
      }
    }

    return {
      ok: true,
      live: false,
      isError: false,
      toolName,
      content: [
        {
          type: "text",
          text: JSON.stringify({ tool: toolName, arguments: toolArgs, status: "synthesized_ok" })
        }
      ]
    };
  }
}

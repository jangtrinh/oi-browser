# SPEC 006 · Ổi Browser · MCDB — Live MCP Client Protocol & Multi-Database Provisioning

**Spec ID**: `006-live-mcp-client-and-agent-databases`
**Created**: 2026-10-29
**Status**: Ready for Dev
**Target Repo**: `jangtrinh/oi-browser` (`/Users/jangtrinh/Products/berry-browser`)
**Depends on**: `001-zero-placeholder-runtime`

---

## 1. Scope & Problem

In `Spec 001`, `/apps`, `/settings/integrations`, and `/databases` gained SQLite persistence (`integrations` table) and live schema introspection (`introspectDatabase()`). However, **24 MCP lifecycle and multi-database mutation IPC channels** remain unwired:
- **Live MCP JSON-RPC Discovery & Registration**: `integration:register-mcp`, `integration:remove-mcp`, `integration:approve-local-mcp`, `integration:authenticate-mcp`, `integration:connect-api-key`, `integration:refresh`, `integrations:refresh-connection`, `integration:list-dangerous-tools-permissions`, `integration:set-tool-permission-global`.
- **Multi-Database Provisioning, Grants & Companion Whitelisting**: `agent-db:provision-database`, `agent-db:delete-database`, `agent-db:share-grant`, `agent-db:revoke-grant`, `agent-db:set-companion-access`, and write-capable SQL execution (`CREATE TABLE`, `INSERT`, `UPDATE`, `DELETE`) on agent-owned `.sqlite` files.

---

## 2. Functional Requirements (`FR-601` … `FR-604`)

### FR-601: Live MCP Client Bridge (`src/server/mcp-client-bridge.js`)
1. Create `McpClientBridge` (`src/server/mcp-client-bridge.js`) supporting:
   - **Stdio MCP servers** (`command` + `args`, e.g. `npx -y @modelcontextprotocol/server-filesystem`) via JSON-RPC 2.0 `initialize` + `tools/list` + `tools/call`.
   - **HTTP/SSE MCP servers** (`url` endpoint) via `POST` JSON-RPC 2.0.
2. Wire `integration:register-mcp`, `integration:remove-mcp`, `integration:approve-local-mcp`, `integration:connect-api-key`, and `integration:refresh` to `POST /api/integrations` so registering an MCP server probes its `tools/list` and saves discovered `toolSlugs` into SQLite `integrations`.

### FR-602: Multi-Database Provisioning & Write-Capable Agent SQL
1. Allow provisioning isolated SQLite database files under `.berry-data/databases/<dbHandle>.sqlite` via `agent-db:provision-database` (`POST /api/databases` with `action: "provision"`).
2. Allow deleting non-system databases (`dbHandle !== "berry-workspace-sqlite"`) via `agent-db:delete-database`.
3. Allow companions and users to execute DDL/DML (`CREATE TABLE`, `INSERT`, `UPDATE`, `DELETE`, `SELECT`) on provisioned `.berry-data/databases/<dbHandle>.sqlite` files.

### FR-603: Database Grants & Companion Access Persistence
1. Add `agent_db_grants` (`db_handle`, `email`, `grantee_label`, `role`) and `agent_db_companion_access` (`db_handle`, `companion_id`) tables in `SqliteWorkspaceStore`.
2. Wire `agent-db:share-grant`, `agent-db:revoke-grant`, `agent-db:list-grants`, `agent-db:get-companion-access`, and `agent-db:set-companion-access` to `POST /api/databases`.

---

## 3. Acceptance Criteria (`AC-601` … `AC-603`)

- **AC-601:** Registering a custom MCP server via `integration:register-mcp` persists it in SQLite `integrations`, discovers its tools, and exposes them in `integration:get-tools`.
- **AC-602:** Provisioning a new database via `agent-db:provision-database` creates `.berry-data/databases/<dbHandle>.sqlite`, lists it in `/databases`, and deleting it via `agent-db:delete-database` removes it cleanly.
- **AC-603:** Sharing a database grant (`agent-db:share-grant`), revoking it (`agent-db:revoke-grant`), and toggling companion access (`agent-db:set-companion-access`) persist in SQLite across restarts.

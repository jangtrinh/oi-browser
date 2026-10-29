# Implementation Plan — Spec 006: Live MCP Client Protocol & Multi-Database Provisioning

**Spec**: `specs/006-live-mcp-client-and-agent-databases/spec.md`

## 1. File Touch List
- `src/server/mcp-client-bridge.js` *(new)*: Stdio & HTTP JSON-RPC 2.0 MCP client (`initialize`, `tools/list`, `tools/call`).
- `src/server/sqlite-workspace-store.js`: Add `agent_db_grants` and `agent_db_companion_access` tables, plus multi-DB provisioning/deletion in `.berry-data/databases/`.
- `src/server/berry-http-server.js`: Extend `POST /api/integrations` and `POST /api/databases` (`provision`, `delete`, `shareGrant`, `revokeGrant`, `setCompanionAccess`).
- `src/client/berry-electron-domains.js`: Wire all 24 `integration:*` and `agent-db:*` IPC invokes.
- `test/spec-006-mcp-and-databases.test.js`: Integration tests for `AC-601` … `AC-603`.

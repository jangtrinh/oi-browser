# Tasks — Spec 006: Live MCP Client Protocol & Multi-Database Provisioning

- [ ] **601.1 (P1 — MCP JSON-RPC Client Bridge):** Create `src/server/mcp-client-bridge.js` and wire `register-mcp` / `remove-mcp` in `POST /api/integrations`.
- [ ] **601.2 (P1 — Multi-DB Provisioning & Grants in SQLite):** Extend `SqliteWorkspaceStore` and `POST /api/databases` with `provisionDatabase`, `deleteDatabase`, `shareGrant`, `revokeGrant`, and `setCompanionAccess`.
- [ ] **602.1 (P2 — Client MCP & Agent-DB IPC):** Wire `integration:register-mcp`, `integration:remove-mcp`, `integration:set-tool-permission-global`, `agent-db:provision-database`, `agent-db:delete-database`, `agent-db:share-grant`, `agent-db:revoke-grant`, and `agent-db:set-companion-access` in `src/client/berry-electron-domains.js`.
- [ ] **603.1 (P3 — Verification):** Add `test/spec-006-mcp-and-databases.test.js` covering `AC-601` … `AC-603`.

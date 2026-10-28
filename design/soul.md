---
status: ratified
---

# Design Soul — oi-browser

_Declared stance for `Ổi Browser (oi-browser)`. Every `/ui:*` flow and design agent reads this BEFORE picking personas, tokens, or layouts. Precedence: brief > soul (project > studio > factory) > memory prior > knowledge floors. Values live in `public/index.html`, `design/design.tokens.json`, and `design/ontology.tokens.json`; this file names them and says when each one applies._

## Never

- Never place the primary navigation sidebar on the left: the root `.home-sidebar-layout` MUST enforce `flex-direction: row-reverse !important` so the 290px Navigation Dock always sits on the Right-Hand Side — evidence: `public/index.html`
- Never let the bottom-left `CLI Core: AUTO (5/5)` pill overlap the Right-Hand Sidebar footer (`local@oibrowser.vn`): `#oi-cli-dock-root` is pinned to `left: 20px; bottom: 20px` — evidence: `src/client/berry-cli-terminal-dock.js`
- Never use raw emoji glyphs (`\p{Extended_Pictographic}`) anywhere in UI components, companion names, tool cards, or database records; all 9 companions use 3D Vietnamese fruit artwork (`/images/fruits/*.png`) — evidence: `src/server/official-companions-catalog.js`
- Never use purple or violet for chrome, buttons, badges, or focus rings; primary actions use Guava Coral (`#B9382C`, `colors.primary`) and online indicators use Guava Leaf Green (`#15803D`, `colors.success`) — evidence: `design/design.tokens.json`
- Never replace the SvelteKit 5 workspace views (`/newtab`, `/chat/:id`, `/routines`, `/apps`, `/skills`, `/databases`, `/timeline`, `/meetings`, `/library`, `/use-cases`) with static mockups — evidence: `src/client/berry-electron-state.js`
- Never nest a rounded shape off-curve: composer container uses `24px` (`radius-composer`), cards use `20px`/`14px` (`radius-xl`/`radius-lg`), inner rows use `10px` (`radius-md`), and pills use `9999px` (`radius-pill`) — evidence: `design/ontology.tokens.json`
- Never introduce a color or spacing literal outside the 3-tier ontology (`primitive-*` -> `semantic-*` -> `composite-*`) — evidence: `design/ontology.tokens.json`
- Never ship a custom server or client module exceeding 200 lines of code — evidence: `test/berry-browser.test.js`

## Always

- Always dock the 290px Navigation Sidebar on the Right-Hand Side (`Layout/RightHandSidebarShell`) with a 1px left hairline border (`border-left: 1px solid oklch(var(--border) / 0.65)`) — evidence: `public/index.html`
- Always pair every companion session and starter card with its canonical short Vietnamese fruit name (`Ổi`, `Măng Cụt`, `Sầu Riêng`, `Thanh Long`, `Bưởi`, `Vú Sữa`, `Xoài`, `Chôm Chôm`, `Vải`) and 3D fruit PNG asset — evidence: `src/server/official-companions-catalog.js`
- Always maintain >= 4.5:1 WCAG AA contrast across all 15 declared text x surface token pairs and 8 interaction-state pairs — evidence: `design/design.tokens.json`
- Always render structured agent execution steps inside `Content/WorkTraceAccordion` (`Searched the web`, `Read pages`, `Used CLI harness`, `Updated crm.md`) with tabular sans-serif count badges (`Badge/StatusCount`) — evidence: `src/client/berry-electron-state.js`
- Always tag extracted interactive DOM elements with `data-oi-id="oi-1..N"` in `AgentDOMBrowserService` — evidence: `src/server/agent-dom-browser-service.js`
- Always expose all 6 interactive states (`Default`, `Hover`, `Active`, `Focus`, `Disabled`, plus `Empty` for data containers) across the 24 registered components — evidence: `design/component-registry.json`

## Voice

- Concise, practical Vietnamese-first workspace nomenclature (`Làm việc cùng Ổi`, `Khám phá Ổi Browser`, `Route: Priority`, `CLI Core: AUTO (5/5)`) without emojis or marketing fluff — inherited: `src/server/companion-chat-orchestrator.js`
- Grounded, verifiable deliverable citations linking real URLs, buying signals, and `knowledge/crm.md` line deltas — evidence: `src/server/agent-dom-browser-service.js`

## Evidence pointers

- `public/index.html` — Right-Hand Sidebar layout rules (`.home-sidebar-layout { flex-direction: row-reverse !important; }`) and brand typography
- `src/client/berry-cli-terminal-dock.js` — Bottom-left Multi-CLI Harness Dock (`left: 20px; bottom: 20px`)
- `src/client/berry-electron-state.js` — SvelteKit 5 state bridge, Work-Trace tool-call mapping, and companion runtime hydration
- `src/client/berry-electron-domains.js` — Domain handlers for Apps, Databases, Timeline, Meetings, Knowledge, Credits, and Use Cases
- `src/server/official-companions-catalog.js` — Canonical 9 Vietnamese fruit companions and 31 skill mappings
- `design/ontology.tokens.json` — 3-tier DTCG token hierarchy (Primitives -> Semantic -> Composite)
- `design/component-registry.json` — 24 registered components across Primitives, Molecules, and Composites
- `design/flow.json` — 11-screen IA flow graph verified by `ui flow lint`

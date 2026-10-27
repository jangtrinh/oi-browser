# DESIGN.md — Ổi Browser (Direct SvelteKit 5 Frontend + Local Backend)

## 1. Aesthetic Direction & Frontend Architecture
- **Brand Identity**: **Ổi Browser** — 3D Guava brand mark (`/fruits-3d/guava.png`) + 9 Vietnamese Fruit Companions (`Ổi Đào`, `Măng Cụt`, `Sầu Riêng Ri6`, `Thanh Long Đỏ`, `Bưởi Da Xanh`, `Vú Sữa Lò Rèn`, `Xoài Cát Hòa Lộc`, `Chôm Chôm Nhãn`, `Vải Thiều Thanh Hà`).
- **Renderer Bundle (`public/`)**:
  - `public/_app/immutable/` — Compiled SvelteKit 5 + Tailwind v4 + Bits UI + Tiptap renderer chunks and CSS assets.
  - `public/fruits-3d/` — 12 high-resolution 3D tropical fruit icons (`fruits-3d-icon-pack_332547`).
  - `public/fruits/` — 10 Lottie fruit animations (`fruits-animation-pack_331109`) + `lottie.min.js`.
  - `public/fonts/Oi-Sans.woff2`, `public/icons/`, `public/images/`, `public/sounds/`, `public/videos/`.
- **Client IPC Shim (`src/client/`)**:
  - `berry-electron-bridge.js` (159 lines) — Installs `window.electronAPI`, `window.__dialogBridge`, and loads `berry-fruit-lottie.js` before SvelteKit's `EventBus` initializes.
  - `berry-electron-state.js` (140 lines) — Synthesizes topic state payloads (`companions.list`, `routines.list`, `syncedFs.library`, `skills.list`, `skills.folders`, `chat.session`, `chat.session.messages`, `layout.tree`, `ui.theme`, `onboarding.checklist`).
  - `berry-electron-queries.js` (198 lines) — Routes `invoke()` and `invokeIPCQuery()` calls to our local Node 24 SQLite + Karpathy-Wiki + AgentDOM backend on `http://127.0.0.1:4104`.
  - `berry-fruit-lottie.js` (83 lines) — Maps every companion ID/seed/name to its 3D Vietnamese fruit icon and Lottie animation.

## 2. Color & Atmospheric Polarity
- **Light Mode (Warm Alabaster Default)**:
  - Canvas background: `#FAF8F5` (`--theme-background`)
  - Elevated surface / card: `#FFFFFF`
  - Subtle surface / pill: `#F3EFEA`
  - Primary Ink: `#181512`
  - Secondary Ink: `#575049`
  - Accent Primary (Guava Leaf Green): `#2E8B57`
- **Dark Mode (`?theme=dark`)**:
  - Canvas background: `#121110`
  - Elevated surface: `#1A1816`
  - Primary Ink: `#F5F2EE`

## 3. Typography & Scannable Hierarchy
- **Primary UI & Display**: `Oi Sans` (`/fonts/Oi-Sans.woff2`) with system fallback (`-apple-system`, `Inter`).
- **Monospace / Telemetry / DOM Citations**: `JetBrains Mono`, `SF Mono`, `ui-monospace`, `tabular-nums`.

## 4. Verification & `design-os` Gate Results
- `ui gate public/index.html`: **0 errors, 0 warnings — PASS** (`layout: clean`, `a11y: clean`, `taste: clean`, `tell: clean`, `content: clean`, `autofix: clean`).
- `ui gate docs/index.html`: **0 errors, 0 warnings — PASS**.
- Headless Chrome CDP route sweep (`/newtab`, `/hire/official`, `/chat/session-rosa-1`, `/library`, `/routines`, `/meetings`, `/skills`, `/settings/theme`): **0 console errors, 0 uncaught page exceptions**.

---
description: "ease-design /ui:to-figma — Author idiomatic Figma on the canvas from intent or an existing ease-design output. Use when the user wants a design built or edited in Figma (auto-layout, components, variables) via the figma-agent hand."
---

# /ui:to-figma

Follow the runtime-neutral workflow at:
`/opt/homebrew/lib/node_modules/ease-design/templates/workflows/to-figma.md`

The workflow reads files under `knowledge/`. Resolve every such path against this absolute base: `/opt/homebrew/lib/node_modules/ease-design/knowledge` (e.g. `knowledge/persona-index.md` → `/opt/homebrew/lib/node_modules/ease-design/knowledge/persona-index.md`).


When the workflow instructs it, invoke skill `design-os-figma-craft`.
When the workflow instructs it, invoke skill `design-os-pick-persona`.
When the workflow instructs it, invoke skill `design-os-score-taste`.

---
description: "ease-design /ui:figma — Import a Figma frame and produce an HTML reproduction. Use when the user provides a figma.com URL or frame to convert to code."
---

# /ui:figma

Follow the runtime-neutral workflow at:
`/opt/homebrew/lib/node_modules/ease-design/templates/workflows/figma.md`

The workflow reads files under `knowledge/`. Resolve every such path against this absolute base: `/opt/homebrew/lib/node_modules/ease-design/knowledge` (e.g. `knowledge/persona-index.md` → `/opt/homebrew/lib/node_modules/ease-design/knowledge/persona-index.md`).


When the workflow instructs it, invoke skill `design-os-apply-prompt-mode`.

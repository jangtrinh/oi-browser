---
name: visual-artifact
description: Use when you want to create a higher quality static visual artifact such as decks, posters, one-pagers, diagrams, infographics, social graphics (headers, posts, etc), or mockups. Do not use for interactive dashboards, websites, or browser tools; create and present a standalone HTML file for those instead. After a research session, ask the user before starting this workflow.
metadata:
  title: Visual Artifact
---

# Visual Artifact

Use this skill for designed static pieces: slide decks, posters, one-pagers, diagrams, infographics, app mockups, and social graphics. You build them in HTML and CSS, but you are doing print and presentation design, not making web pages.

Interactive dashboards, websites, and browser tools are out of scope: build one self-contained HTML file and call `present_files` on it.

## Before you start

Start when the user asked for this kind of artifact or agreed to one. Then make sure you know the style source: a brand or website to match, a reference or attachment, or "you decide".

- If the request already names the style source, start working. Do not ask about style.
- If it does not, ask once with `oi.askQuestion()`. Offer: match a brand or website (ask for the URL), let you choose a direction, or other. Put anything else you need to know into the same question.

## Workflow

Each step is one `exec` call or one batch of parallel file writes. Do not split them further.

1. **Set up.** Call `createArtifact({ title, width, height, preset, multiFrame })`. It returns the `root` folder, and you write only under it (`resolveArtifactRoot(artifactId)` finds it again in later steps). Presets: `deck`, `poster`, `one-pager`, `diagram`, `infographic`, `app-mockup`, `social-graphic`, `custom`. Use the canvas sizes under Craft. When the style source is a website, call `inspectBrand({ artifactId, url })` in the same exec.
2. **Read the evidence.** For a brand, two screenshots are attached: the top of the page and the most distinctive section further down. Compare them with the returned roles:
   - `colors`: `background`, `surface`, `text`, `muted`, `accents` (each with where it was seen, such as `logo+cta`), `cta`, and the page's own `tokens`. Keep an accent as small as the site keeps it. `confidence` rates `background`, `text`, `accents`, and `cta` as `high`, `medium`, or `low`. `unpainted` lists brand-named tokens the page never shows: they are not the brand's colors on this site unless the screenshots say otherwise. `imagery` gives the main tones of the photography, for image treatments, not for UI color.
   - `colors.check`, when present, lists up to three candidates for each uncertain role, best guess first, with where each was seen, such as `#0f766e cta x6, logo 38%` (`cta x6`: six filled buttons; `logo 38%`: share of the logo; `screens 4%`: share of the screenshots). An accents candidate that starts with `none` means the brand has no accent color. Settle every `check` entry before you write the system: pick the candidate that the attached screenshots show in that role, and record the pick and the reason in one line per role under `## Brand`, for example `accents: #0f766e, the logo and every primary button use it`.
   - `type`: one CSS-ready line per role (`display`, `heading`, `body`, `label`, `button`, `mono`): family, weight, size/line-height, tracking, transform, color.
   - `logo`: `onLight` and `onDark` files. `derived` names the variant made by recoloring a one-color mark; `text` means the logo is live text in a brand font.
   - `shape`: button, card, and image treatment.

   Up to four screens of the page are saved in `brand/assets/screens/`, and `brand/probe.json` has the full data. Open another page only if the homepage does not show the system you need, for example product screenshots.
3. **Write the brief and the system in one batch.** You don't need to read the scaffold first: it holds empty `artifact.md` sections, `root.css` tokens marked `/* placeholder */` plus a computed type scale and grid, and an empty storyboard.
   - `artifact.md`: fill every section (`Audience and Scene`, `Says`, `Brand`, `Design Direction`, `Refuses`, `Weird Choice`, `Source Material`), and record the brand evidence and any substitutions under `## Brand`.
   - `styles/root.css`: replace each value marked `/* placeholder */` and delete its marker. Keep the first line, `@import url("fonts.css");`, and the computed `--text-*`, `--space`, `--margin`, `--gutter`, and `--columns` tokens: installed fonts and the grid depend on them.
   - `storyboard.md`, for multi-frame artifacts: one line per frame giving its file name, its one job, and its content.

   Install any fonts the brand does not supply with `installGoogleFonts` in this step or before it.
4. **Generate images only when they carry the piece**, such as hero photography, a texture, or a product scene. Brand images and screenshots come first.
   - Generate at most two, started together with `Promise.all` in one exec.
   - Copy them into `assets/` in the same exec.
5. **Write all frames in one batch** of parallel `file_write` calls, as `frames/01-title.html`, `frames/02-....html`, and so on. Put shared styling in `root.css` classes and keep each frame's own `<style>` short. Use subagents only for 8 or more frames that split into independent groups.
6. **Critique and export in one call.** Call `critiqueArtifact({ artifactId, exportTargets })`. Use `['pdf']` for decks, documents, and print, and `['png']` for social graphics and on-screen images. Critique exports only when its verdict is `ship`. Then `file_read` the returned `contactSheet`, which shows every frame in order, left to right and top to bottom. Review it as a designer:
   - hierarchy, and the rhythm from frame to frame
   - crowding and empty dead zones
   - anything clipped or off-brand

   If something is wrong, fix errors, warnings that matter, and whatever looks off in one pass of targeted edits, then call critique again with the same `exportTargets`. Stop after that second critique and present its export. If it still reports an error, it exports nothing: fix only that error and critique once more, and if an error remains even then, export with `exportArtifact` and tell the user what is still wrong. Further polishing costs the user time for little gain.
7. **Present** the returned export with `present_files`, once. Don't reopen the artifact after presenting unless the user asks. For multi-page work, present one combined PDF, never individual slide PNGs. Export results already give the page count and page size, so you don't need to check the file with other tools.

## Helpers

Load helpers with `require` from the absolute skills path. The sandbox runs CommonJS, so `await import(...)` does not work, and `process.cwd()` is the session workspace, not the skills folder.

```ts
const path = require('node:path')
const {
  createArtifact,
  resolveArtifactRoot,
  inspectBrand,
  installGoogleFonts,
  critiqueArtifact,
  exportArtifact
} = require(path.join(process.env.SKILLS_DIR, 'oi', 'general', 'visual-artifact', 'scripts', 'index.js'))
```

| Helper | Returns |
| --- | --- |
| `createArtifact({ title, width, height, preset, multiFrame? })` | `{ artifactId, root }`: `root` is the artifact folder |
| `resolveArtifactRoot(artifactId)` | the artifact root path |
| `inspectBrand({ artifactId, url })` | `{ tabId, root, source, theme, colors: { background, surface, text, muted, accents, cta, tokens, confidence, check?, unpainted?, imagery? }, type: { display, heading, body, label, button, mono }, fonts: [{ family, roles, status, weights, substitute? }], shape: { button, card, image }, logo: { onLight?, onDark?, derived?, text?, icon? }, images, screenshots: { attached, saved }, probe, notes }`. Paths are relative to `root`. Two screenshots are attached for you to look at. |
| `installGoogleFonts({ artifactId, families })` | `{ installed: [{ family, files }], failed, css }` |
| `critiqueArtifact({ artifactId, exportTargets? })` | `{ verdict: 'ship' \| 'revise', findings: [{ source, severity, frame?, message, suggestion? }], contactSheet?, exports? }` |
| `exportArtifact({ artifactId, targets })` | `{ artifacts: [{ target, frame?, path, mimeType, pages?, pageSize? }] }`: use it to re-export without a critique |

**Fonts:**
- Fonts installed by `inspectBrand` or `installGoogleFonts` are registered in `styles/fonts.css`, which `root.css` already imports. Use their family names directly.
- `families` takes Google Fonts names such as `['Fraunces', 'IBM Plex Mono']`. A bare name installs every weight the family has, with italics where they exist, and a full spec such as `'Fraunces:opsz,wght@9..144,300..900'` picks specific axes.
- When a brand font comes back `failed` or `not-found` (common for Adobe Fonts), install its `substitute` (or the closest Google font) with `installGoogleFonts` and note the substitution under `## Brand`.

## Craft

Taste comes from specific decisions. Make these on purpose, and record the important ones in `artifact.md`.

- **Canvas.** Use these sizes:
  - Deck: 1920x1080.
  - Poster: A3 1123x1587 or A2 1587x2245.
  - One-pager: Letter 816x1056 or A4 794x1123.
  - Social: 1080x1350 portrait post, 1080x1080 square, 1200x675 landscape, 1500x500 X header.
  - Diagrams and infographics: fit the content, usually 1920x1080 or 1080x1920.

  Print pieces export to PDF, which stays sharp. PNG exports are one pixel per canvas pixel.
- **Type.** Use at most two families, plus a mono for data. Either pair one display face with character and one quiet text face, or use one family at strongly contrasting weights.
  - Build hierarchy from the scale that `root.css` already computes for your canvas, and set nothing smaller than `--text-sm`.
  - Display type: leading 0.9 to 1.05, tracking -0.01em to -0.04em. Condensed and heavy faces need little or no negative tracking; in the contact sheet, check that no letters touch. At this leading a background on a phrase covers the descenders of the line above, so paint a highlight as a lower band, such as `linear-gradient(transparent 55%, color 55%)`.
  - Body text: leading 1.35 to 1.5, and 45 to 75 characters per line.
  - Uppercase labels: tracking +0.06em to +0.12em.
  - Use `font-variant-numeric: tabular-nums` for figures that line up.
- **Hierarchy.** Give each frame one dominant element, about three times the size of the next level. Two or three levels of emphasis are enough. A viewer should know where to look first from across the room. On posters and social graphics, the name of the event itself, not only of one part of it, and the date come right after the headline in size and must read from several meters away. Don't set them as small labels.
- **Grid and space.**
  - Align everything to `--margin` and a 12-column grid with `--gutter`, and space in multiples of `--space`.
  - Treat whitespace as a deliberate block, not leftover gaps. Asymmetry is good when it is intentional.
  - Keep the margins, the title position, and the page number in the same place on every frame.
- **Color.**
  - Choose one strategy and write it down: restrained (neutrals plus one accent), committed (one strong color carries whole frames), or drenched (full-bleed color fields).
  - Posters and social graphics compete on a wall or in a feed, so lean toward committed or drenched color. A pale neutral ground needs a reason in the brief, not a default.
  - Decks need color rhythm too: give at least one slide a full-color or dark ground, for example the section opener or the key number. With a brand, use its own dark or tinted grounds for this. Give that ground its own text and muted colors: the tokens chosen for light slides will not read on it.
  - Aim for roughly 60% dominant, 30% secondary, and 10% accent, and give the accent one job per frame.
  - Tint neutrals toward the palette instead of using pure #000 or #fff. Body text needs at least 4.5:1 contrast.
- **Images.**
  - Crop on purpose: `object-fit: cover` with a chosen `object-position`.
  - Put text on quiet areas or on solid bands, never over busy detail.
  - Show product screenshots at a legible size inside a simple frame, or crop tight to the detail that matters.
  - Never enlarge a small image.
- **Data.**
  - Set a number people should remember very large, with a short label.
  - Label chart series directly instead of using a legend. Highlight one series and mute the rest.
  - Leave out 3D and gridline clutter.
  - Build charts, diagrams, arrows, and connectors in HTML, CSS, or inline SVG so the values stay exact.
- **Decks.** Give each slide one idea, with a title that states the takeaway rather than the topic. Vary the rhythm across statement, evidence, image, and breathing-room slides instead of repeating one template. Five to eight slides usually means a title slide, three to six content slides, and a close.
- **Pairings when there is no brand.** All of these are Google Fonts:
  - Editorial: Fraunces or Newsreader with Instrument Sans.
  - Swiss or modern: Schibsted Grotesk or Hanken Grotesk, in contrasting weights.
  - Technical: IBM Plex Sans with IBM Plex Mono.
  - Expressive poster: Bricolage Grotesque, Anton, or Big Shoulders Display, with a restrained text face.
  - Literary: EB Garamond or Cormorant Garamond with Work Sans.

## Brand-led work

Let the brand guide the piece, translated into the medium rather than recreated as a website. Draw on what makes it recognizable, such as its fonts, colors, logo, imagery or illustration style, voice, and shape language, and decide how much of each the piece needs. Its real logo and images usually carry it further than fonts and colors alone. Leave out website parts such as nav bars, buttons, cookie banners, and footers. Brand fonts are fine even when they appear on the avoid list below.

## Direction without a brand

Start from the content and the scene: who sees the piece, where, and in what mood. Let that decide light or dark, density, and tone. Then commit to one visual idea you could name in a sentence (a field guide, a transit map, a museum label), and let color, type, and layout serve it. Beige with a grotesque and small mono labels is the current template look: use it only when the idea calls for it.

## Avoid

These are the signs of a generic AI template:

- **Default fonts:** Inter, Roboto, Arial, Helvetica, Open Sans, Poppins, Montserrat, or Space Grotesk used as the default.
- **Stock color and effects:** purple-to-blue or Stripe-like gradients, teal with coral, generic tech blue, gradient text, glassmorphism, blurred orbs, and bokeh.
- **Template layouts:**
  - a centered headline with a subtitle and two buttons
  - three-column icon-card grids, nested cards, and rounded card stacks
  - thick colored side stripes, and pills used as decoration
  - logo bars, hero-metric templates, and testimonial cards
  - on print, anything that looks clickable: buttons, pill-shaped calls to action, arrows that suggest a link, or a website header bar
- **Empty copy:** lines like "all-in-one platform", "powerful yet simple", "built for teams of all sizes", or "get started in minutes" that carry no information.
- **Placeholder or invented copy:** never print "add URL here", "TBD", or lorem ipsum. When a detail is missing, leave it out or ask. Don't add facts, figures, or taglines the source does not support.
- **Hand-drawn SVG illustrations, icons, or logos.** Use the brand's real logo file, a real asset, or a generated image. SVG and CSS are fine for charts, diagrams, arrows, and rules.

## Rules

- **Write only under the artifact root.** Save every asset locally (screenshots, logos, images, fonts), and never hotlink.
- **Frames:**
  - Each frame is a complete static HTML document placed directly inside `frames/`, with no nested folders.
  - Each links `<link rel="stylesheet" href="../styles/root.css" />`.
  - Each has one `.frame` element sized `var(--artifact-width)` by `var(--artifact-height)`.
  - No scrolling and no JavaScript.
- **PDF export uses Chromium printing.** Avoid `background-clip: text` with a transparent fill, SVG `feTurbulence`, and blur filters above 24px.
- **Edit in place.** Prefer targeted edits over rewriting whole files.
- **Present only exports,** never frames, CSS, or notes.

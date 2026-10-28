# Ổi Browser — Design System Ontology (DESIGN:OS)

> **Single Source of Truth (`DESIGN:OS` / `ui 0.6.0`):**
> - **Sealed Token Store (`ui ds`):** [`design/design.tokens.json`](design/design.tokens.json) (`76` tokens, `15/15` AA contrast pairs passing)
> - **3-Tier DTCG Ontology (`ui tokens compile`):** [`design/ontology.tokens.json`](design/ontology.tokens.json) (`Primitives -> Semantic -> Composite`)
> - **Component Registry (`ui registry` / `ui ds specimen`):** [`design/component-registry.json`](design/component-registry.json) (`24` components, `24/24` stateful, `0` gaps)
> - **Multi-Screen IA Flow (`ui flow lint`):** [`design/flow.json`](design/flow.json) (`11` screens, `86` transitions, `0` findings)
> - **Ratified Design Soul (`ui ds soul check`):** [`design/soul.md`](design/soul.md) (`status: ratified`, `0` findings)
> - **Interactive Specimen Preview:** [`design/specimen.html`](design/specimen.html)

---

## 1. Tier 1 — Primitives (`primitive-*`)

Literal scales for Ổi Browser brand colors, 9 Vietnamese fruit companion accents, neutral warm paper surfaces, spacing ladder, border radii, typography, and motion durations.

| Token Path | Type | Literal Value |
| :--- | :--- | :--- |
| `primitive-color.guava-50` | `color` | `#fdf2f3` |
| `primitive-color.guava-100` | `color` | `#fce7e9` |
| `primitive-color.guava-500` | `color` | `#d95c50` |
| `primitive-color.guava-600` | `color` | `#b9382c` |
| `primitive-color.guava-700` | `color` | `#9f2f25` |
| `primitive-color.guava-800` | `color` | `#7f231b` |
| `primitive-color.guava-leaf-100` | `color` | `#dcfce7` |
| `primitive-color.guava-leaf-600` | `color` | `#15803d` |
| `primitive-color.mangosteen-600` | `color` | `#1d4ed8` |
| `primitive-color.durian-600` | `color` | `#b45309` |
| `primitive-color.dragonfruit-600` | `color` | `#be123c` |
| `primitive-color.pomelo-600` | `color` | `#0e7490` |
| `primitive-color.mango-600` | `color` | `#a16207` |
| `primitive-color.rambutan-600` | `color` | `#b91c1c` |
| `primitive-color.lychee-600` | `color` | `#9d174d` |
| `primitive-color.neutral-0` | `color` | `#ffffff` |
| `primitive-color.neutral-50` | `color` | `#fcfcfb` |
| `primitive-color.neutral-100` | `color` | `#f7f6f4` |
| `primitive-color.neutral-150` | `color` | `#f1f0ec` |
| `primitive-color.neutral-200` | `color` | `#e6e4e0` |
| `primitive-color.neutral-300` | `color` | `#d4d2cd` |
| `primitive-color.neutral-600` | `color` | `#52525b` |
| `primitive-color.neutral-900` | `color` | `#18181b` |
| `primitive-color.dark-950` | `color` | `#121214` |
| `primitive-color.dark-900` | `color` | `#18181b` |
| `primitive-color.dark-800` | `color` | `#27272a` |
| `primitive-space.1` | `dimension` | `4px` |
| `primitive-space.2` | `dimension` | `8px` |
| `primitive-space.3` | `dimension` | `12px` |
| `primitive-space.4` | `dimension` | `16px` |
| `primitive-space.5` | `dimension` | `20px` |
| `primitive-space.6` | `dimension` | `24px` |
| `primitive-space.8` | `dimension` | `32px` |
| `primitive-space.10` | `dimension` | `40px` |
| `primitive-space.12` | `dimension` | `48px` |
| `primitive-space.sidebar-width` | `dimension` | `290px` |
| `primitive-space.composer-max-width` | `dimension` | `720px` |
| `primitive-space.cli-dock-offset` | `dimension` | `20px` |
| `primitive-radius.xs` | `dimension` | `4px` |
| `primitive-radius.sm` | `dimension` | `6px` |
| `primitive-radius.md` | `dimension` | `10px` |
| `primitive-radius.lg` | `dimension` | `14px` |
| `primitive-radius.xl` | `dimension` | `20px` |
| `primitive-radius.composer` | `dimension` | `24px` |
| `primitive-radius.pill` | `dimension` | `9999px` |
| `primitive-typography.font-sans` | `fontFamily` | `Inter, -apple-system, BlinkMacSystemFont, sans-serif` |
| `primitive-typography.font-display` | `fontFamily` | `Playfair Display, Georgia, serif` |
| `primitive-typography.font-mono` | `fontFamily` | `SFMono-Regular, Menlo, Monaco, Consolas, monospace` |
| `primitive-typography.size-xs` | `dimension` | `11px` |
| `primitive-typography.size-sm` | `dimension` | `12px` |
| `primitive-typography.size-caption` | `dimension` | `13px` |
| `primitive-typography.size-body` | `dimension` | `14px` |
| `primitive-typography.size-title` | `dimension` | `16px` |
| `primitive-typography.size-heading` | `dimension` | `20px` |
| `primitive-typography.size-hero` | `dimension` | `32px` |
| `primitive-duration.fast` | `duration` | `100ms` |
| `primitive-duration.normal` | `duration` | `180ms` |
| `primitive-duration.slow` | `duration` | `280ms` |

---

## 2. Tier 2 — Semantic Tokens (`semantic-*` & `colors.*`)

Role-based tokens aliasing Tier 1 primitives. Verified by `ui ds a11y` for >= 4.5:1 WCAG AA contrast across all 15 text x surface pairs and 8 interaction-state pairs.

| Semantic Token | Type | Alias Reference |
| :--- | :--- | :--- |
| `semantic-color.bg` | `color` | `{primitive-color.neutral-0}` |
| `semantic-color.bg-foreground` | `color` | `{primitive-color.neutral-900}` |
| `semantic-color.canvas` | `color` | `{primitive-color.neutral-50}` |
| `semantic-color.surface` | `color` | `{primitive-color.neutral-100}` |
| `semantic-color.surface-hover` | `color` | `{primitive-color.neutral-150}` |
| `semantic-color.surface-active` | `color` | `{primitive-color.neutral-200}` |
| `semantic-color.card` | `color` | `{primitive-color.neutral-100}` |
| `semantic-color.card-foreground` | `color` | `{primitive-color.neutral-900}` |
| `semantic-color.popover` | `color` | `{primitive-color.neutral-0}` |
| `semantic-color.popover-foreground` | `color` | `{primitive-color.neutral-900}` |
| `semantic-color.primary` | `color` | `{primitive-color.guava-600}` |
| `semantic-color.primary-foreground` | `color` | `{primitive-color.neutral-0}` |
| `semantic-color.primary-hover` | `color` | `{primitive-color.guava-700}` |
| `semantic-color.primary-active` | `color` | `{primitive-color.guava-800}` |
| `semantic-color.secondary` | `color` | `{primitive-color.neutral-150}` |
| `semantic-color.secondary-foreground` | `color` | `{primitive-color.neutral-900}` |
| `semantic-color.muted` | `color` | `{primitive-color.neutral-100}` |
| `semantic-color.muted-foreground` | `color` | `{primitive-color.neutral-600}` |
| `semantic-color.accent` | `color` | `{primitive-color.guava-50}` |
| `semantic-color.accent-foreground` | `color` | `{primitive-color.guava-800}` |
| `semantic-color.component` | `color` | `{primitive-color.pomelo-600}` |
| `semantic-color.component-foreground` | `color` | `{primitive-color.neutral-0}` |
| `semantic-color.success` | `color` | `{primitive-color.guava-leaf-600}` |
| `semantic-color.warning` | `color` | `{primitive-color.durian-600}` |
| `semantic-color.destructive` | `color` | `{primitive-color.rambutan-600}` |
| `semantic-color.info` | `color` | `{primitive-color.mangosteen-600}` |
| `semantic-color.border` | `color` | `{primitive-color.neutral-200}` |
| `semantic-color.border-subtle` | `color` | `{primitive-color.neutral-150}` |
| `semantic-color.border-strong` | `color` | `{primitive-color.neutral-300}` |
| `semantic-color.ring` | `color` | `{primitive-color.guava-600}` |

---

## 3. Tier 3 — Composite / Component-Scoped Tokens (`composite-*`)

Surface-specific composite variables binding Semantic and Primitive tokens to Ổi Browser structural regions (Right-Hand Sidebar, Top Companion Pill Bar, Plaza Hero Composer, Work-Trace Card, Bottom-Left CLI Dock, Use-Case Starter Book).

| Composite Token | Type | Bound Semantic / Primitive Token |
| :--- | :--- | :--- |
| `composite-right-sidebar.width` | `dimension` | `{primitive-space.sidebar-width}` |
| `composite-right-sidebar.bg` | `color` | `{semantic-color.bg}` |
| `composite-right-sidebar.fg` | `color` | `{semantic-color.bg-foreground}` |
| `composite-right-sidebar.border-left` | `color` | `{semantic-color.border}` |
| `composite-right-sidebar.item-hover-bg` | `color` | `{semantic-color.surface-hover}` |
| `composite-right-sidebar.item-active-bg` | `color` | `{semantic-color.surface-active}` |
| `composite-right-sidebar.item-radius` | `dimension` | `{primitive-radius.md}` |
| `composite-companion-pill-bar.bg` | `color` | `{semantic-color.surface}` |
| `composite-companion-pill-bar.border` | `color` | `{semantic-color.border}` |
| `composite-companion-pill-bar.active-pill-bg` | `color` | `{semantic-color.bg}` |
| `composite-companion-pill-bar.active-pill-fg` | `color` | `{semantic-color.bg-foreground}` |
| `composite-companion-pill-bar.radius` | `dimension` | `{primitive-radius.pill}` |
| `composite-plaza-composer.max-width` | `dimension` | `{primitive-space.composer-max-width}` |
| `composite-plaza-composer.bg` | `color` | `{semantic-color.bg}` |
| `composite-plaza-composer.border` | `color` | `{semantic-color.border}` |
| `composite-plaza-composer.radius` | `dimension` | `{primitive-radius.composer}` |
| `composite-plaza-composer.submit-bg` | `color` | `{semantic-color.primary}` |
| `composite-plaza-composer.submit-fg` | `color` | `{semantic-color.primary-foreground}` |
| `composite-work-trace-card.bg` | `color` | `{semantic-color.surface}` |
| `composite-work-trace-card.border` | `color` | `{semantic-color.border-subtle}` |
| `composite-work-trace-card.radius` | `dimension` | `{primitive-radius.lg}` |
| `composite-work-trace-card.badge-bg` | `color` | `{semantic-color.primary}` |
| `composite-work-trace-card.badge-fg` | `color` | `{semantic-color.primary-foreground}` |
| `composite-cli-dock-pill.bg` | `color` | `{semantic-color.bg}` |
| `composite-cli-dock-pill.border` | `color` | `{semantic-color.border}` |
| `composite-cli-dock-pill.dot-online` | `color` | `{semantic-color.success}` |
| `composite-cli-dock-pill.radius` | `dimension` | `{primitive-radius.pill}` |
| `composite-cli-dock-pill.offset-left` | `dimension` | `{primitive-space.cli-dock-offset}` |
| `composite-cli-dock-pill.offset-bottom` | `dimension` | `{primitive-space.cli-dock-offset}` |
| `composite-use-case-card.surface` | `color` | `{semantic-color.card}` |
| `composite-use-case-card.chrome-surface` | `color` | `{semantic-color.surface-hover}` |
| `composite-use-case-card.tab-surface` | `color` | `{semantic-color.bg}` |
| `composite-use-case-card.border` | `color` | `{semantic-color.border}` |
| `composite-use-case-card.radius` | `dimension` | `{primitive-radius.xl}` |

---

## 4. Tier 4 — Component Taxonomy (Atoms -> Molecules -> Organisms)

| Component Name | Category | Ontology Tier | Variants & States |
| :--- | :--- | :--- | :--- |
| `Avatar/FruitCompanion` | `content` | **Primitive (Atom)** | `Size=20px, Size=32px, Size=112px, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Badge/LeadRouteTag` | `feedback` | **Primitive (Atom)** | `Route=Priority, Route=Explore, Route=Nurture, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Badge/StatusCount` | `feedback` | **Primitive (Atom)** | `Tone=Primary, Tone=Neutral, Tone=Success, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Button/IconControl` | `action` | **Primitive (Atom)** | `Size=28px, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Button/Primary` | `action` | **Primitive (Atom)** | `Size=32px, Shape=Rounded, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Button/Secondary` | `action` | **Primitive (Atom)** | `Tone=WarmNeutral, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Card/ConnectedAppTile` | `content` | **Semantic (Molecule)** | `Connection=Connected, Connection=Available, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Card/IdeaSuggestion` | `content` | **Semantic (Molecule)** | `Slot=Coach, Slot=Invite, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Card/MeetingTranscriptNote` | `content` | **Semantic (Molecule)** | `Recording=Complete, Recording=Live, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Card/RoutineScheduleRow` | `content` | **Semantic (Molecule)** | `Enabled=True, Enabled=False, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Card/SkillDirectoryItem` | `content` | **Semantic (Molecule)** | `Category=Sales, Category=General, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Chip/CategoryFilter` | `form` | **Primitive (Atom)** | `Selected=True, Selected=False, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Content/UseCaseStarterBook` | `content` | **Composite (Organism)** | `Deck=General, Deck=Sales, Deck=Engineering, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Content/WorkTraceAccordion` | `content` | **Composite (Organism)** | `Expanded=False, Expanded=True, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Dialog/ChatHistoryDrawer` | `overlay` | **Composite (Organism)** | `Mode=Modal, State=Empty, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Form/PlazaHeroComposer` | `form` | **Composite (Organism)** | `Mode=Default, Mode=Expert, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Input/SearchField` | `form` | **Primitive (Atom)** | `Width=Fluid, State=Empty, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Layout/RightHandSidebarShell` | `layout` | **Composite (Organism)** | `Sidebar=RightExpanded, Sidebar=RightCollapsed, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `List/ActivityTimelineFeed` | `content` | **Composite (Organism)** | `Filter=All, Filter=ToolCalls, State=Empty, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Navigation/CompanionTopPillBar` | `navigation` | **Semantic (Molecule)** | `Expanded=False, Expanded=True, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Navigation/RecentChatItem` | `navigation` | **Semantic (Molecule)** | `Selected=True, Selected=False, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Navigation/RightSidebarItem` | `navigation` | **Semantic (Molecule)** | `Active=True, Active=False, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Overlay/CliHarnessDock` | `overlay` | **Composite (Organism)** | `Drawer=Collapsed, Drawer=Expanded, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |
| `Table/AgentDatabaseGrid` | `content` | **Composite (Organism)** | `Density=Compact, Density=Default, State=Empty, State=Default, State=Hover, State=Active, State=Focus, State=Disabled` |

---

## 5. Tier 5 — Multi-Screen IA & State Graph (`design/flow.json`)

| Screen ID | Route / Surface | Source Artifact | Declared States |
| :--- | :--- | :--- | :--- |
| `plaza-newtab` | Plaza — 3D Fruit Companion Stage & Prompt Composer (/newtab) | `public/index.html` | `default, loading, empty, error` |
| `chat-session` | Chat Session — Companion Thread & Work-Trace Accordion (/chat/:id) | `src/client/berry-electron-state.js` | `default, loading, empty, error` |
| `routines-hub` | Routines — Scheduled Autonomous Cron Workflows (/routines) | `src/client/berry-electron-state.js` | `default, loading, empty, error` |
| `connected-apps` | Apps — Local & MCP Connector Directory (/apps) | `src/client/berry-electron-domains.js` | `default, loading, empty, error` |
| `skills-directory` | Skills — 31 Official Companion Skill Bundles (/skills) | `src/client/berry-electron-state.js` | `default, loading, empty, error` |
| `agent-databases` | Databases — SQLite & Karpathy-Wiki Structured Tables (/databases) | `src/client/berry-electron-domains.js` | `default, loading, empty, error` |
| `activity-timeline` | Timeline — Chronological Tool & Observation Feed (/timeline) | `src/client/berry-electron-domains.js` | `default, loading, empty, error` |
| `meetings-notes` | Meetings — Transcripts & Action Item Extraction (/meetings) | `src/client/berry-electron-domains.js` | `default, loading, empty, error` |
| `artifacts-library` | Library — Visual Artifacts, Spreadsheets & SyncedFS (/library) | `src/client/berry-electron-state.js` | `default, loading, empty, error` |
| `use-cases-gallery` | Use Cases — 3D Fruit Starter Kits & Prompt Decks (/use-cases) | `public/_app/immutable/nodes/116.jmviVD4E.js` | `default, loading, empty, error` |
| `cli-terminal-drawer` | CLI Harness Dock — Bottom-Left Multi-CLI Terminal Drawer (#oi-cli-dock-root) | `src/client/berry-cli-terminal-dock.js` | `default, loading, empty, error` |

---

# Component documentation

_24 component(s), regenerated from the registry._

## action

### Button/IconControl

28x28px header and Right-Hand Sidebar icon toggle button (Notifications, Sidebar Collapse, Attach Plus)

- **Variants:** Size=28px, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.surface-active` → #e6e4e0
  - `colors.surface-hover` → #f1f0ec
  - `duration.duration-fast` → 100ms
  - `radius.radius-sm` → 6px
  - `spacing.space-2` → 8px

### Button/Primary

Coral-guava primary CTA button and composer submit trigger (#B9382C fill, #FFFFFF label, 32px height, 10px/pill radius)

- **Variants:** Shape=Rounded, Size=32px, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.primary` → #b9382c
  - `colors.primary-active` → #7f231b
  - `colors.primary-foreground` → #ffffff
  - `colors.primary-hover` → #9f2f25
  - `colors.ring` → #b9382c
  - `duration.duration-fast` → 100ms
  - `radius.radius-md` → 10px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px

### Button/Secondary

Warm neutral secondary pill button for quick actions (Skills, Meetings, Apps, Help) under Plaza composer

- **Variants:** State=Active, State=Default, State=Disabled, State=Focus, State=Hover, Tone=WarmNeutral
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.secondary` → #f1f0ec
  - `colors.secondary-active` → #d4d2cd
  - `colors.secondary-foreground` → #18181b
  - `colors.secondary-hover` → #e6e4e0
  - `duration.duration-fast` → 100ms
  - `radius.radius-pill` → 9999px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

## content

### Avatar/FruitCompanion

3D Vietnamese fruit companion avatar (Ổi, Măng Cụt, Sầu Riêng, Thanh Long, Bưởi, Vú Sữa, Xoài, Chôm Chôm, Vải)

- **Variants:** Size=112px, Size=20px, Size=32px, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border-subtle` → #f1f0ec
  - `colors.surface` → #f7f6f4
  - `radius.radius-pill` → 9999px
  - `spacing.space-2` → 8px

### Card/ConnectedAppTile

Local and MCP connector status tile in /apps (GitHub, Google Calendar, Gmail, Notion, Linear, Slack)

- **Variants:** Connection=Available, Connection=Connected, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.success` → #15803d
  - `radius.radius-lg` → 14px
  - `spacing.space-4` → 16px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px
  - `typography.font-size-title` → 16px

### Card/IdeaSuggestion

Warm surface onboarding suggestion card on Plaza (Khám phá Ổi Browser / Mời bạn bè dùng Ổi Browser)

- **Variants:** Slot=Coach, Slot=Invite, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border-subtle` → #f1f0ec
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.muted-foreground` → #52525b
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-xl` → 20px
  - `spacing.space-4` → 16px
  - `spacing.space-5` → 20px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-caption` → 13px
  - `typography.font-size-title` → 16px

### Card/MeetingTranscriptNote

Meeting transcript summary and extracted action items card in /meetings

- **Variants:** Recording=Complete, Recording=Live, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.muted-foreground` → #52525b
  - `colors.primary` → #b9382c
  - `radius.radius-lg` → 14px
  - `spacing.space-4` → 16px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px
  - `typography.font-size-title` → 16px

### Card/RoutineScheduleRow

Automated cron routine card in /routines showing companion avatar, cron schedule, next run countdown, and last run status

- **Variants:** Enabled=False, Enabled=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.muted-foreground` → #52525b
  - `colors.success` → #15803d
  - `radius.radius-lg` → 14px
  - `spacing.space-4` → 16px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-title` → 16px

### Card/SkillDirectoryItem

Official skill card in /skills displaying skill slug, category badge, description, and companion affinity

- **Variants:** Category=General, Category=Sales, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.muted-foreground` → #52525b
  - `colors.primary` → #b9382c
  - `radius.radius-lg` → 14px
  - `spacing.space-4` → 16px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-caption` → 13px
  - `typography.font-size-title` → 16px

### Content/UseCaseStarterBook

Interactive 3D browser-window starter kit card on /use-cases featuring /command bubble, mini browser chrome, 3D fruit mascot, and connector pills

- **Variants:** Deck=Engineering, Deck=General, Deck=Sales, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.border` → #e4e4e7
  - `colors.card` → #f7f6f4
  - `colors.card-foreground` → #18181b
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-xl` → 20px
  - `spacing.space-4` → 16px
  - `spacing.space-5` → 20px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px
  - `typography.font-size-heading` → 20px

### Content/WorkTraceAccordion

Expandable multi-step agent execution trace card in Chat (Updated crm.md -> Searched the web, Read pages, Used CLI harness, Updated crm.md)

- **Variants:** Expanded=False, Expanded=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border-subtle` → #f1f0ec
  - `colors.muted-foreground` → #52525b
  - `colors.primary` → #b9382c
  - `colors.surface` → #f7f6f4
  - `radius.radius-lg` → 14px
  - `spacing.space-3` → 12px
  - `spacing.space-4` → 16px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

### List/ActivityTimelineFeed

Chronological audit feed of companion tool calls, DOM inspections, CLI dispatches, and Karpathy-Wiki writes in /timeline

- **Variants:** Filter=All, Filter=ToolCalls, State=Active, State=Default, State=Disabled, State=Empty, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border-subtle` → #f1f0ec
  - `colors.muted-foreground` → #52525b
  - `colors.success` → #15803d
  - `colors.surface` → #f7f6f4
  - `radius.radius-md` → 10px
  - `spacing.space-3` → 12px
  - `spacing.space-4` → 16px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px

### Table/AgentDatabaseGrid

Structured SQLite, Karpathy-Wiki, and Spreadsheet visual artifact data grid in /databases and /library

- **Variants:** Density=Compact, Density=Default, State=Active, State=Default, State=Disabled, State=Empty, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.border-subtle` → #f1f0ec
  - `colors.surface` → #f7f6f4
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-lg` → 14px
  - `spacing.space-3` → 12px
  - `spacing.space-4` → 16px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

## feedback

### Badge/LeadRouteTag

Semantic qualification route badge (Route: Priority, Route: Explore, Route: Nurture) in Sales & Recruiting deliverables

- **Variants:** Route=Explore, Route=Nurture, Route=Priority, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.accent` → #fdf2f3
  - `colors.accent-foreground` → #7f231b
  - `colors.info` → #1d4ed8
  - `colors.success` → #15803d
  - `colors.warning` → #b45309
  - `radius.radius-sm` → 6px
  - `spacing.space-1` → 4px
  - `spacing.space-2` → 8px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-size-xs` → 11px

### Badge/StatusCount

Monospace count and status badge used on Searched the web (3), Routines (In 1h), and CLI Core (5/5)

- **Variants:** State=Active, State=Default, State=Disabled, State=Focus, State=Hover, Tone=Neutral, Tone=Primary, Tone=Success
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.muted-foreground` → #52525b
  - `colors.primary` → #b9382c
  - `colors.primary-foreground` → #ffffff
  - `colors.secondary` → #f1f0ec
  - `colors.success` → #15803d
  - `radius.radius-pill` → 9999px
  - `spacing.space-1` → 4px
  - `spacing.space-2` → 8px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-size-xs` → 11px

## form

### Chip/CategoryFilter

Selectable category filter pill (All 12, General, Sales, Recruiting, Engineering) on Use Cases and Skills

- **Variants:** Selected=False, Selected=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.secondary` → #f1f0ec
  - `colors.secondary-foreground` → #18181b
  - `radius.radius-pill` → 9999px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

### Form/PlazaHeroComposer

Center Plaza hero stage combining 3D Vietnamese fruit mascot, 24px-radius prompt composer, mode selector, and quick-action bar

- **Variants:** Mode=Default, Mode=Expert, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.muted-foreground` → #52525b
  - `colors.primary` → #b9382c
  - `colors.primary-foreground` → #ffffff
  - `radius.radius-composer` → 24px
  - `spacing.composer-max-width` → 720px
  - `spacing.space-4` → 16px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px

### Input/SearchField

Full-width pill search input on Skills, Use Cases, Library, and Databases screens

- **Variants:** State=Active, State=Default, State=Disabled, State=Empty, State=Focus, State=Hover, Width=Fluid
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.border-focus` → #b9382c
  - `colors.muted-foreground` → #52525b
  - `colors.ring` → #b9382c
  - `radius.radius-pill` → 9999px
  - `spacing.space-3` → 12px
  - `spacing.space-4` → 16px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px

## layout

### Layout/RightHandSidebarShell

Root application shell (.home-sidebar-layout with flex-direction: row-reverse) placing the 1150px workspace stage on the left and the 290px Navigation Dock on the right

- **Variants:** Sidebar=RightCollapsed, Sidebar=RightExpanded, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.surface` → #f7f6f4
  - `spacing.sidebar-width` → 290px
  - `spacing.space-4` → 16px
  - `typography.font-family-display` → Playfair Display, Georgia, serif
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif

## navigation

### Navigation/CompanionTopPillBar

Top-center floating companion switcher pill bar on Plaza featuring active 3D fruit companion badge and quick-switch avatars

- **Variants:** Expanded=False, Expanded=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.surface` → #f7f6f4
  - `radius.radius-pill` → 9999px
  - `spacing.space-1` → 4px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

### Navigation/RecentChatItem

Recent companion chat row in the Right-Hand Sidebar pairing a 20px 3D fruit icon with localized session title

- **Variants:** Selected=False, Selected=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.surface-active` → #e6e4e0
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-md` → 10px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-small` → 12px

### Navigation/RightSidebarItem

Primary navigation row inside the 290px Right-Hand Sidebar (New Chat, Chat History, Routines, Apps, Skills, Databases, Timeline, Meetings, Library)

- **Variants:** Active=False, Active=True, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.muted-foreground` → #52525b
  - `colors.surface-active` → #e6e4e0
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-md` → 10px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px

## overlay

### Dialog/ChatHistoryDrawer

Searchable companion session history modal/drawer launched from Chat History in the Right-Hand Sidebar

- **Variants:** Mode=Modal, State=Active, State=Default, State=Disabled, State=Empty, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.border` → #e4e4e7
  - `colors.popover` → #ffffff
  - `colors.popover-foreground` → #18181b
  - `colors.surface-hover` → #f1f0ec
  - `radius.radius-xl` → 20px
  - `spacing.space-4` → 16px
  - `spacing.space-6` → 24px
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-body` → 14px
  - `typography.font-size-heading` → 20px

### Overlay/CliHarnessDock

Bottom-left (left: 20px; bottom: 20px) floating CLI Core status pill (AUTO 5/5) and expandable multi-CLI terminal drawer (claude, agy, codex, grok, orca)

- **Variants:** Drawer=Collapsed, Drawer=Expanded, State=Active, State=Default, State=Disabled, State=Focus, State=Hover
- **States:** —
- **Consider adding:** focus, disabled, loading, error, empty (common states this component does not declare)
- **Tokens used:**
  - `colors.bg` → #ffffff
  - `colors.bg-foreground` → #18181b
  - `colors.border` → #e4e4e7
  - `colors.success` → #15803d
  - `colors.surface` → #f7f6f4
  - `radius.radius-pill` → 9999px
  - `spacing.cli-dock-offset` → 20px
  - `spacing.space-2` → 8px
  - `spacing.space-3` → 12px
  - `typography.font-family-mono` → SFMono-Regular, Menlo, Monaco, Consolas, monospace
  - `typography.font-family-sans` → Inter, -apple-system, BlinkMacSystemFont, sans-serif
  - `typography.font-size-xs` → 11px


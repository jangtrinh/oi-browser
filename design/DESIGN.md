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


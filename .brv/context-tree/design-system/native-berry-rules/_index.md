# Design System Context: Native Berry UI Rules (`native-berry-rules`)

## Source of Truth
- Derived from Flash 3.8 analysis of the compiled SvelteKit 5 stylesheet (`public/_app/immutable/assets/0.Bg98M30B.css`) and native settings views (`/settings/general`, `/settings/appearance`).
- Upstreamed as **Spec 031 (`031-zero-drift-onboarding-gate`)** in `jangtrinh/design-os-hq` ([PR #6](https://github.com/jangtrinh/design-os-hq/pull/6)).

## Mandatory Rules for Custom Injected Panels (`src/client/berry-cli-terminal-dock.js`)
1. **Zero Monospace on UI Elements**: All titles, subtitles, buttons, tabs, status labels, paths, and pills MUST use `--font-sans` (`Inter`). Monospace is strictly forbidden on UI elements (allowed only inside raw `<textarea>` / `<pre>` terminal output).
2. **Zero Pastel Badges or Uppercase Role Tags**: Never render tinted pastel pill badges (`background: oklch(... / 0.14)`, `border-radius: 9999px`) or uppercase tracking labels. Use plain muted inline text (`11px`, `color: oklch(var(--muted-foreground))`) separated by `·`.
3. **Zero Boxed Card Headers or Metric Tiles**: Do not use shaded `.card-header` bars with bottom borders or multi-column KPI metric grids inside settings cards. Use flat settings rows (`padding: 12px 16px`, `border-bottom: 1px solid oklch(var(--border) / 0.4)`).
4. **Concise Copy Cap**: Section titles <= 3 words (`13px`, `font-weight: 500`), descriptions <= 10 words (`12px`, `color: oklch(var(--muted-foreground))`).
5. **Exact Sidebar Item Parity**: Any custom navigation link injected into `/newtab` or `/settings` MUST be inserted inside `div.flex.flex-col.gap-0.5`, clone `libBtn.className` (`12.8px`, `font-weight: 400`, `oklch(0.556 0 0)`), and use a `14x14` (`size-3.5`) Lucide SVG with `stroke-width="1.75"`.

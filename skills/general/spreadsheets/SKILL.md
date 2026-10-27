---
name: spreadsheets
description: 'Use when the user asks to create, modify, analyze, format, validate, chart, or push spreadsheet workbooks in Excel, Google Sheets, CSV, or TSV form.'
---

# Spreadsheets

Use the Ổi Browser spreadsheet helper workflow for dashboards, charts, data analysis, filtering, aggregations, formatting, conditional formatting, pivot-style summaries, financial models, bulk transformations, and provider-safe Google Sheets/Excel edits.

## Workflow

1. If the workbook already exists, download it:
   ```ts
   const wb = await oi.spreadsheet_download({
     provider: 'google_sheets',
     file: spreadsheetIdOrUrl,
     account: 'user@example.com'
   })
   ```
   A workbook that is already in the sandbox — an attachment the user sent, or a file an earlier
   step created — takes the same first step, with a path instead of a provider:

   ```ts
   const wb = await oi.spreadsheet_download({
     sourcePath: '/mnt/oi/sales.xlsx'
   })
   ```

   No connected account is involved, and `spreadsheet_push` validates, diffs and promotes
   `edit.xlsx` in place. Every helper works the same on it, including the pivot helpers. Do not
   hand-edit an XLSX package because a workbook is local: it is not.
2. If the user wants a new Google Sheet, create an empty spreadsheet first, then download it:
   ```ts
   const created = await oi.googlesheets.gsheets_create({
     title: 'Payments Analysis',
     sheetName: 'Raw Data',
     account: 'user@example.com'
   })
   const wb = await oi.spreadsheet_download({
     provider: 'google_sheets',
     file: created.spreadsheetId,
     account: 'user@example.com'
   })
   ```
3. Mutate `wb.workbook_dir` through helper functions; keep the workbook files as helper-managed state.
4. Create a checkpoint before risky edits and before push.
5. Validate the workbook. `spreadsheet_validate` recalculates with Formualizer and includes formula/static-audit metadata. Empty or formatted-only tabs that were already empty in the downloaded workbook can stay empty. Newly added empty tabs, tabs your edits emptied, and entirely blank workbooks block push. Preserve existing empty separator tabs. It lists only the formula errors your edits introduced, tagged `[introduced]`: fix those. Its `summary` counts the errors the workbook already had: leave them unless the user asks. A cell marked `not checked` uses a function the validator cannot evaluate, so the formula may be correct: do not rewrite it, and do not call it an error. Tell the user, naming each cell, that it was not checked and should be checked in Excel.
6. Peek user-facing sheets after styling or chart work to inspect values, formulas, dimensions, and workbook metadata before push. Image rendering is disabled for now, so do not rely on screenshots for layout verification.
7. Push the workbook. Read the full result, including `warnings`, `unsupportedFeatures`, `chartChanges`, `history_mode`, and provider notes. Tell the user what was skipped or downgraded.

## Sub-agent Planning and Audit

For nontrivial sheet creation or analytical workbook work, start a focused sub-agent early to plan the workbook structure, calculation strategy, checks, and layout risks before heavy edits. Use `chatMode: 'expert'` for finance, high-stakes, ambiguous, large-data, or hard-to-redo work; use `chatMode: 'efficient'` only for narrow mechanical checks.

```ts
const workbookPlan = await oi.startAgent({
  id: 'workbook_plan',
  label: 'Workbook plan',
  chatMode: 'expert',
  prompt:
    'Plan the spreadsheet workbook for this task. Return sheet structure, static-vs-formula strategy, checks, chart/layout recommendations, and risks. Do not mutate the workbook.'
})
```

Sub-agents should be read-only planners/auditors unless they own a separate artifact. Do not have parent and child mutate the same `workbookDir` concurrently; the parent remains responsible for helper-managed workbook mutations, validation, value/metadata peek, and push. After building a complex workbook, optionally resume or start a second sub-agent in `smart` mode for an independent calculation/layout audit.

## Helper Schemas

Use these parameter names exactly:

```ts
await oi.spreadsheet_add_sheet({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  rows: [['Metric', 'Value']]
})

await oi.spreadsheet_set_cells({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  cells: {
    A1: 'Revenue Dashboard',
    A3: 'Total Revenue',
    A4: 'Paid Transactions'
  }
})

await oi.spreadsheet_set_formula({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  cell: 'B3',
  formula: "=SUMIFS('Raw Data'!C:C,'Raw Data'!E:E,\"Paid\")"
})

await oi.spreadsheet_set_formulas({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  formulas: {
    B3: "=SUMIFS('Raw Data'!C:C,'Raw Data'!E:E,\"Paid\")",
    B4: '=COUNTIFS(\'Raw Data\'!E:E,"Paid")'
  }
})

await oi.spreadsheet_fill_formula({
  workbookDir: wb.workbook_dir,
  sheet: 'Helper',
  range: 'B2:B9274',
  formula: '=TEXT(A2,"YYYY-MM")'
})

await oi.spreadsheet_import_rows({
  workbookDir: wb.workbook_dir,
  sheet: 'Raw Data',
  rows: [
    ['created_at', 'amount', 'status'],
    ['2026-05-12', 99, 'Paid']
  ],
  startCell: 'A1'
})

await oi.spreadsheet_style_cells({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  cells: ['A1:D1', 'A3:B8'],
  style: {
    backgroundColor: '#1f2937',
    fontColor: '#ffffff',
    bold: true,
    horizontal: 'center'
  }
})

await oi.spreadsheet_set_dimensions({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  columns: {
    A: { widthPx: 180 },
    'B:D': { widthPx: 120 }
  },
  rows: {
    '1': { heightPx: 36 }
  }
})

await oi.spreadsheet_format({
  workbookDir: wb.workbook_dir,
  styles: [
    {
      sheet: 'Dashboard',
      cells: ['A1:D1', 'A3:B8'],
      style: { backgroundColor: '#1f2937', fontColor: '#ffffff', bold: true }
    },
    {
      sheet: 'Monthly Revenue',
      cells: ['A1:G1', 'A3:G3', 'A5:G5'],
      style: { backgroundColor: '#f7f9fc' }
    }
  ],
  dimensions: [
    {
      sheet: 'Dashboard',
      columns: { A: { widthPx: 180 }, 'B:D': { widthPx: 120 } },
      rows: { '1': { heightPx: 36 } }
    }
  ]
})

await oi.spreadsheet_add_image({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  sourcePath: '/mnt/oi/assets/logo.png',
  anchor: 'F2',
  widthPx: 160,
  heightPx: 80,
  altText: 'Logo'
})

await oi.spreadsheet_add_chart({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  type: 'Line',
  anchor: 'F6',
  title: 'Monthly Revenue',
  dataRange: "'Monthly Revenue'!B1:B13",
  categoriesRange: "'Monthly Revenue'!A2:A13",
  widthPx: 640,
  heightPx: 360
})

const preview = await oi.spreadsheet_peek({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  range: 'A1:H25',
  maxRows: 25
})

await oi.spreadsheet_checkpoint({
  workbookDir: wb.workbook_dir,
  label: 'before-push'
})

const validation = await oi.spreadsheet_validate({
  workbookDir: wb.workbook_dir
})

const pushed = await oi.spreadsheet_push({
  workbookDir: wb.workbook_dir
})
```

Schema notes:

- `spreadsheet_add_sheet` uses `sheet` for the tab name.
- `spreadsheet_set_cells.cells` is an object keyed by A1 address.
- `spreadsheet_set_formulas({ workbookDir, sheet, formulas })` is preferred for formula tables.
- `spreadsheet_fill_formula({ workbookDir, sheet, range, formula })` is preferred for repeated formulas over large row/column ranges. Do not generate thousands of individual formula entries when one fill operation expresses the same pattern.
- `spreadsheet_format({ workbookDir, styles?, dimensions? })` batches multi-sheet styling and dimensions in one workbook open/save. Use it for dashboard-wide presentation work instead of looping many `spreadsheet_style_cells` or `spreadsheet_set_dimensions` calls.
- `spreadsheet_set_dimensions({ workbookDir, sheet, columns?, rows? })` sets column widths, row heights, and hidden states. Column keys can be `A` or `A:D`; row keys can be `1` or `1:4`.
- `spreadsheet_add_image({ workbookDir, sheet, sourcePath, anchor, widthPx?, heightPx?, altText? })` embeds a PNG/JPEG/GIF in `edit.xlsx`. Google Sheets push converts inserted images into `IMAGE(...)` formulas backed by Drive-uploaded files and may require Drive scope.
- `spreadsheet_add_chart({ workbookDir, sheet, type, anchor, title?, dataRange?, categoriesRange?, xRange?, yRange?, widthPx?, heightPx?, titlesFromData? })` creates a native chart in `edit.xlsx`. Supported `type` values are `ColumnClustered`, `BarClustered`, `Line`, `Pie`, and `XYScatter`. Use `dataRange` + `categoriesRange` for standard charts, or `xRange` + `yRange` for scatter charts. Google Sheets push converts supported charts to native Sheets charts.
- `spreadsheet_list_pivots({ workbookDir, sheet? })` returns supported native pivot definitions.
- `spreadsheet_add_pivot({ workbookDir, definition })`, `spreadsheet_update_pivot({ workbookDir, sheet, name, definition })`, and `spreadsheet_delete_pivot({ workbookDir, sheet, name })` manage worksheet-range-backed native pivots. A definition contains fully qualified `sourceRange` and `destinationRange`, row/column/filter field lists, one or more value fields, grand-total flags, and an optional Excel pivot style. Updates replace the complete definition.
- `spreadsheet_peek({ workbookDir, sheet?, range?, maxRows? })` inspects workbook contents. Image previews are disabled for now.
- Run workbook mutations sequentially; each helper opens and saves the same XLSX file. For many presentation edits, batch styles and dimensions with `spreadsheet_format`.
- Spreadsheet helpers are built-ins documented in this skill; legacy `oi.googlesheets.spreadsheet_agent` is unavailable inside `exec`.

## Default Workbook Structure

Structure the workbook around the user's actual task, but make analytical workbooks auditable by default:

- Put `Summary` or `Dashboard` first when the user asks for analysis, KPIs, charts, reporting, or executive-readable output.
- Keep all source rows or source tables in `Raw Data` or `Data`. Do not replace source data with only aggregates unless the user explicitly asks for a summarized-only workbook.
- Use `Helper` for row-level derived fields that make analysis reliable, such as normalized dates, month buckets, cohorts, region mappings, or cleaned statuses.
- Use `Assumptions` or `Notes` for user-provided constants, methodology, source notes, caveats, and lookup tables that formulas or static outputs depend on.
- A single-sheet workbook is OK for simple storage, lightweight trackers, or direct formatting requests when separate analysis tabs would add noise.

## Formula vs Static Analysis Contract

Default by task type:

- **Imported/static data analysis**: for CSV exports, payment/Stripe data, product analytics, marketing exports, operational logs, and similar source-data snapshots, compute complex analytical outputs in JS/Python and write static values by default. This includes cohort/retention matrices, revenue by month, funnel tables, segmentation, trend tables, chart-source ranges, KPI/dashboard summaries, and graph-driving helper ranges. Keep raw rows in the workbook and document the method/source so the result is auditable.
- **Editable workbooks**: use live formulas when the workbook is a model, calculator, template, tracker, check sheet, assumption-driven forecast, or user-editable workflow where values should update after the user changes inputs.
- **User override**: if the user explicitly asks for live formulas or refreshable analysis, use formulas, keep ranges bounded, validate them, and mention any performance or provider limitations.
- **Finance models**: keep forecasts, valuation logic, sensitivities, financial statements, and checks formula-driven unless the user explicitly asks for a static report. Large imported transaction/detail blocks may still use static computed helper/output values.

Classify each sheet before writing:

- **Raw/static**: imported rows, labels, constants, source snapshots, and pure data-storage sheets. Static values are OK.
- **Static analysis output**: dashboards, KPI tabs, monthly revenue, region revenue, region-over-time tables, cohort/retention matrices, summaries, chart-source tables, and reports built from imported/static source data. Static values are the default for complex analysis.
- **Formula-derived**: editable summaries, model outputs, checks, templates, assumption-driven calculations, and user-requested live analysis. Derived values are formulas.

Structure analytical workbooks so the underlying source data lives inside the workbook. Do not boil source data down into only summaries, dashboards, or precomputed aggregates unless the user explicitly asks for that. Static analytical outputs should be reproducible from raw/source data, lookup tables, and a visible methodology note.

Acceptance criteria:

- Static analysis output cells may be written with `spreadsheet_set_cells` or `spreadsheet_import_rows` when the output is computed from preserved source data.
- Include the underlying source rows or source tables needed to audit the result from within the workbook.
- Add a compact `Notes`/`Method` section or sheet that names the source, row count, filters, group keys, and calculations used for static analytical outputs.
- Formula-derived cells contain formulas written with `spreadsheet_set_formula`, `spreadsheet_set_formulas`, or an explicitly approved provider-native formula write.
- Formula validation errors are repaired as formulas with proper references, `IFERROR`, range alignment, or blank guards. If the formula is for complex imported-data analysis and the user did not request live formulas, prefer replacing the output with audited static values instead of debugging fragile array formulas.
- If a request could mean either an editable model or a static report, infer from the prompt: imported dataset analysis defaults static; templates/models/default calculators use formulas.
- If helper validation, formula writing, or push fails, diagnose the helper-managed workbook first. Prefer static computed outputs for complex imported-data analysis; prefer corrected formulas for editable models/templates. Do not use direct Google Sheets or provider-native writes unless the user explicitly approves that approach.

For payment/Stripe-style CSV analyses, default to static analysis outputs computed from all raw rows:

```ts
// Sketch only. Preserve the raw table, then write the computed tables as values.
const monthlyRevenueRows = computeMonthlyRevenue(rawRows)
const cohortRetentionRows = computeCohortRetention(rawRows)
const retentionPercentRows = computeRetentionPercentages(cohortRetentionRows)
```

Do not use fragile `FILTER`/`UNIQUE` array formulas for cohort retention, active-customer counts, revenue-by-month, or chart-source ranges unless the user asks for live formulas. If live formulas are requested, use bounded ranges and validate representative cells against code-computed spot checks.

Formula best practices:

- Prefer bounded ranges sized to the imported data or helper table over full-column references in dashboards, charts, and repeated formulas.
- Use row-level helper columns for dates, month labels, statuses, cohorts, normalized names, and other fields that make analysis auditable.
- Guard optional template inputs with `IF`, `IFERROR`, blank checks, or zero-safe denominators so incomplete workbooks do not show noisy errors.
- Prefer formulas that survive the provider path. Excel-compatible formulas are safest for Excel and OneDrive workbook push; Google Sheets-only formulas must not be used for Excel targets and must be validated when used for Google Sheets.

When reporting completion, say whether analysis tabs are static computed outputs or formula-driven, and mention that raw/source data was preserved.

## Existing Workbook Edits

For existing workbooks, inspect first, edit narrowly, and preserve user work:

- Use `spreadsheet_peek({ workbookDir, sheet?, range?, maxRows? })` before broad edits so you understand sheet names, existing values, formulas, and layout.
- Preserve existing formatting, formulas, tables, charts, filters, validation, and conditional formatting unless the user asks to replace them.
- When adding rows or columns to a table or formula block, extend formulas, formats, filters, conditional formatting, data validation, and chart ranges to cover the new data.
- If the user names specific sheets or ranges, limit edits to those areas unless dependent formulas, charts, or tables must also be updated.
- Create a checkpoint before structural changes, chart changes, or large formatting changes.

## CSV and Uploaded Files

If a file attachment path is provided, read that exact path. If the upload directory is empty, inspect available mounted directories before assuming the file is missing. If the user says the file is in Downloads, use the mounted Downloads path made available to the session.

For CSV/raw datasets, import raw rows through a bulk path and create separate analysis/output sheets. For complex analysis, write computed static output tables by default. The raw tab contains every source row, and its row count equals the source line count including the header. Use one bulk import path through the selected/approved writer for raw data. Run workbook mutations sequentially; `Promise.all` on helpers can corrupt `edit.xlsx`.

When importing CSV rows directly through Google Sheets, count the header as a row. Keep a single `allRows` array that includes the header when batching: for example, write `allRows.slice(0, batchSize)` to `A1`, then write `allRows.slice(batchSize)` starting at row `batchSize + 1`.

If the helper workbook path fails during raw import, first inspect the failure, verify the local workbook/checkpoint can open, and retry through the helper path when feasible. Before switching to a provider-native or direct Google Sheets bulk write path, ask the user for approval and explain that it changes the editing approach. If approved, re-download before any further helper-managed editing or validation.

Before finalizing an analytical CSV workbook, perform an analysis contract audit:

- Compare source CSV row count to the Raw Data tab row count.
- Inspect static output sheets and spot-check key values against independent code calculations.
- Confirm raw/source data and method notes are present for static analysis outputs.
- If the user requested formulas, inspect formula-derived sheets and confirm derived cells are formulas, not static aggregates.
- If any audit item fails, fix it or report the blocker before presenting the workbook as complete.

## Charts and Formatting

Use `spreadsheet_format` for dashboard-wide styling/dimensions, and `spreadsheet_style_cells`, `spreadsheet_set_dimensions`, `spreadsheet_add_image`, `spreadsheet_add_chart`, and the pivot helpers for small targeted presentation edits. Build compact chart-source ranges first, then create native charts with `spreadsheet_add_chart`. Check the `spreadsheet_push` result carefully and report unsupported chart or pivot features, skipped operations, image conversion warnings, or downgraded provider behavior.

When applying formatting to an existing provider sheet and the user asks to preserve formatting, read current formatting first through the app read surface when available, then apply only the intended changes.

OneDrive/Excel chart edits may require full workbook replacement rather than granular cell/range patching. Report that fallback when it happens.

Professional styling baseline:

- Use clear title rows, section labels, readable table headers, consistent number/date/currency/percent formats, and alignment that matches the data type.
- Use restrained color, table banding, conditional formatting, and KPI emphasis to improve scanning without making raw data hard to read.
- Size columns and rows deliberately. Avoid clipped headers, hidden numbers, awkward wrapping, and chart panels that cover cells.

## Tables, Charts, and Advanced Features

Use the Ổi Browser helpers for all normal workbook writes: `spreadsheet_add_sheet`, `spreadsheet_import_rows`, `spreadsheet_set_cells`, `spreadsheet_set_formula`, `spreadsheet_set_formulas`, `spreadsheet_format`, `spreadsheet_style_cells`, `spreadsheet_set_dimensions`, `spreadsheet_add_image`, `spreadsheet_add_chart`, `spreadsheet_list_pivots`, `spreadsheet_add_pivot`, `spreadsheet_update_pivot`, `spreadsheet_delete_pivot`, `spreadsheet_checkpoint`, `spreadsheet_validate`, `spreadsheet_peek`, and `spreadsheet_push`.

`spreadsheet_set_formulas` rejects very large formula maps to protect `edit.xlsx` from massive workbook rewrites. For repeated row/column formulas, use `spreadsheet_fill_formula` so the helper can fill ranges without building a huge formula map.

Single writer rule:

- Once `spreadsheet_download` returns a `workbookDir`, all mutations to that workbook must go through Ổi Browser helpers unless the user explicitly approves a different path.
- Leave `orig.xlsx` unchanged as the diff baseline; normal edits happen through helpers against `edit.xlsx`.
- Do not directly mutate `edit.xlsx` with Python workbook libraries or ad hoc file writes during normal spreadsheet tasks. Treat `edit.xlsx` as helper-managed state.
- Do not mix helper writes, direct workbook-file writes, and direct Google Sheets or OneDrive writes in one workflow.
- If a needed feature is not exposed by the helpers, ask the user before using any alternate writer such as a provider-native helper, direct Google Sheets write, direct OneDrive write, or ad hoc workbook-file mutation. If no approved path exists, report the limitation instead of silently changing writers.
- If a provider-native direct write is used as a fallback, re-download the workbook before returning to helper-based checkpoint, validation, peek, or push.

Before advanced feature work, create a checkpoint. After the edits, run `spreadsheet_validate`, then `spreadsheet_peek({ workbookDir, sheet, range })` on the affected user-facing sheets before pushing.

Chart defaults:

- For complex imported-data analysis, build charts from static computed chart-source tables by default. Use formula-backed chart sources only when the user asks for live formulas or the workbook is meant to update from edited inputs.
- Prefer simple supported chart types first, such as bar, column, line, scatter, or pie charts that can survive Excel and provider conversion.
- Use `spreadsheet_add_chart` for supported chart creation. Do not fall back to HTML charts when the user asks for a Google Sheet with graphs unless native chart push is blocked and you clearly report the limitation.
- Place charts beside or below the relevant table so they do not cover data. Keep titles, axis labels, and ranges explicit.
- If chart persistence is uncertain, you may verify the local XLSX package without modifying it by listing chart parts, e.g. `unzip -l edit.xlsx | grep -E "xl/charts/chart"`. The `-l` flag lists archive contents only; it does not extract or mutate the workbook. Use this to ground-truth whether helper writes created `chartN.xml` parts when debugging chart helper or push behavior.
- After push, read `chartChanges`, `unsupportedFeatures`, and provider warnings. Do not report chart work as cleanly complete if the provider skipped, downgraded, or could not patch chart changes.

Pivot defaults:

- Use native pivots only when the user asks for a pivot table or needs an interactive pivot workflow. A normal formula-driven or static summary table is often clearer for a fixed report.
- Use worksheet ranges with a single non-empty, unique header row. Keep the source and destination ranges separate and reserve enough destination space for the pivot output.
- A new or updated pivot has no result cells in the saved workbook. The helper writes the pivot definition and its cache and marks the cache to refresh on load; Excel computes the body when the user opens the file. `spreadsheet_peek` at the destination therefore shows empty cells, and so does any read of `edit.xlsx`. That is the expected outcome, not a failed write: confirm the pivot from the helper result (`ok`, `after`, and `verification.supported`, which reopens the saved package and lists the pivots it found), never from the destination cells. Do not write values into the destination range and do not re-add the pivot because it looks empty. Report the pivot as created and say that the numbers appear when the workbook is opened.
- Excel resizes the pivot to its data on that first refresh, which can run far past the requested destination: a 20-row destination has been measured growing to 978 rows, and the used columns can shrink below the requested width. Keep the cells below and to the right of the destination free, or give the pivot its own sheet.
- These two points are specific to the XLSX path (Excel/OneDrive). A Google Sheets push compiles the pivot to a native `pivotTable`, which the provider renders server-side.
- Supported value aggregations are sum, count, numeric count, average, min, max, product, standard deviation, and variance variants. Supported show-as modes are normal, percent of row total, percent of column total, and percent of grand total.
- Pivot edits replace the complete definition. Read the existing definition first when changing one field so rows, columns, values, totals, and style are preserved intentionally.
- Formualizer remains the workbook formula calculator. The pivot helper writes native pivot metadata and cache relationships; it does not implement or change formula evaluation semantics.
- Do not approximate OLAP/Data Model pivots, external pivot sources, calculated items, custom groups, slicers, pivot charts, or other advanced pivot features. Report the unsupported feature. Google Sheets push also rejects Excel page-filter fields because its pivot API cannot represent the same user-visible filter layout.
- OneDrive pivot changes use full-workbook upload. Google Sheets pivot changes compile to native `pivotTable` cell updates and use Google-native styling.

## Visual Verification with Peek

Use `spreadsheet_peek` to inspect workbook values:

```ts
await oi.spreadsheet_peek({
  workbookDir: wb.workbook_dir,
  sheet: 'Dashboard',
  range: 'A1:H25',
  maxRows: 25
})
```

Run `spreadsheet_peek` before final push for dashboards, summaries, charts, and styled user-facing sheets. Use the result to check formula/static-value status, dimensions, and whether important values are present. Because image rendering is disabled, do not claim visual layout verification from peek alone.

## Final Validation

Before presenting a spreadsheet as complete:

- Confirm analysis, dashboard, report, KPI, chart-source, and summary outputs follow the requested/default calculation strategy: static computed values for complex imported-data analysis, formulas for editable models/templates or user-requested live analysis.
- Confirm the workbook contains the source data, helper data, lookup tables, method notes, and labeled assumptions needed to audit its outputs; do not present boiled-down summaries as complete if the underlying data is missing.
- Apply industry-standard styling to all user-facing sheets and important ranges: clear title/header hierarchy, readable table headers, consistent number/date/currency/percent formats, alignment, deliberate row/column sizing, restrained color, and conditional formatting or KPI emphasis when useful.
- Check workbook metadata after styling. Use dimensions, merged-cell metadata, row/column sizes, and peeked ranges to catch obvious layout risks such as missing values, hidden content, awkward wrapping, or charts anchored over important cells. Do not describe this as screenshot or visual verification while rendering is disabled.
- Run `spreadsheet_validate` and repair the formula errors your edits introduced, newly added or newly emptied tabs, formula/static-audit issues, provider conversion issues, or layout risks before the final response. After `spreadsheet_push`, read and report any warnings (name every cell it lists as `not checked`, and say it was not checked rather than that it is broken), unsupported features, chart changes, history-mode fallback, skipped formatting, or downgraded provider behavior.

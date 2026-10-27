---
name: memory-best-practices
description: 'Use when organizing, editing, pruning, or reviewing Ổi Browser companion memory; deciding what belongs in pinned prompt memory versus activity logs, sources, compiled pages, entities, skills, or archives; fixing oversized/truncated memory files; or doing a bulk cleanup or migrating legacy, flat, or messy memory into the active memory system structure.'
user-invocable: 'false'
---

# Memory Best Practices

Use this guide when memory is the work product, not just background context. The goal is compact prompt memory backed by searchable evidence, so future chats start with the current useful truth without carrying every historical detail.

## Quick Triage

Before editing memory, identify the active memory shape from the visible folders and tool help:

- Traditional memory usually has `shared/global-memory.md`, `shared/user-journey.md`, `companions/<id>/memories/companion-memory.md`, `activity-log/`, and `observations/`.
- Compiled wiki memory also has `sources/`, `compiled/`, and `shared/entities/`.
- A Team workspace may also be mounted (team plans only): a separate shared folder, team-visible to every teammate and their companions. Only treat it as present if `<your_file_system>` lists its concrete path; never assume `/team-*` or `$TEAM_DIR`.
- If your memory instructions mention `oi.memoryLint`, run it before and after memory edits. If they do not, do the same checks manually with `rg --files`, `wc -c`, and targeted reads.

## Pinned Memory Budget

Pinned memory files are loaded into every chat and are capped before they reach the model. Treat the cap as a hard operational limit, not a target.

- Hard cap: each pinned memory file is loaded up to about 1,500 estimated tokens.
- Practical target: keep each pinned file under about 4 KB, or roughly 1,000 estimated tokens.
- Warning zone: above about 5 KB, actively summarize or move detail out.
- Failure zone: above about 6 KB, assume the file may be truncated or close enough to need immediate maintenance.

Pinned files are for compact current truth and pointers. They are not journals, transcripts, source archives, scratchpads, or places to paste whole documents.

## Where Things Belong

Classify each item by memory type first, then file it in the narrowest durable home:

- Episodic — dated events, sessions, decisions, completed work, evidence trails. Homes: activity logs, observations, or source/dated compiled pages; keep it out of pinned memory.
- Recurring — recurring habits, standing preferences, repeated workflows, stable constraints. Homes: preferences, habits, and constraints in pinned memory; a repeated workflow in a skill, with only a one-line pointer to it in pinned memory.
- Summarized — current truth that should be available in normal prompts. Home: pinned memory (`companion-memory.md` for companion-specific, `global-memory.md` for profile-wide).
- Entities — durable people, companies, projects, deals, candidates, places, vendors, events. Home: `shared/entities/<type>/<slug>.md`.

Then use the narrowest durable home:

| Content                                                                                                                | Preferred home                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Current user facts, preferences, active policies, durable constraints                                                  | `shared/global-memory.md`                                               |
| This companion's relationship context, active tasks, interaction style, useful links                                   | `companions/<id>/memories/companion-memory.md`                          |
| Ổi Browser adoption and long-running workflow history                                                                  | `shared/user-journey.md`                                                |
| Chronological bullets or daily work history                                                                            | `companions/<id>/memories/activity-log/YYYY-MM-DD.md`                   |
| Raw recent evidence from the observer                                                                                  | `observations/YYYY-MM-DD.md` as read-only evidence                      |
| Dated evidence packets, transcripts, source excerpts, conflict provenance                                              | `sources/*.md` when available                                           |
| Detailed reusable context too large or narrow to pin                                                                   | `compiled/*.md` when available                                          |
| Durable people, companies, projects, deals, candidates, places, vendors, events                                        | `shared/entities/<type>/<slug>.md`                                      |
| Repeatable procedure or workflow                                                                                       | A skill, not memory                                                     |
| One-off task, temporary instruction, scratch work                                                                      | Session files or task output, not durable memory                        |
| Team-wide durable knowledge for all teammates (shared research, process docs, customer context, reusable instructions) | The mounted Team workspace path from `<your_file_system>`, when present |

If the active memory system lacks `sources/` or `compiled/`, prefer `activity-log/`, entity files, or a clearly named companion-owned document instead of bloating pinned memory.

Scope matters as much as type. `companions/<id>/…` is this companion's own memory and `shared/…` is shared across companions in this profile only — neither is visible to other people. A mounted Team workspace is a different trust boundary: it is team-visible to every teammate and their companions. Treat it primarily as a boundary to respect, and only secondarily as an optional home for content that is deliberately team-wide and non-sensitive. Keep personal preferences, private companion context, and anything sensitive in profile memory; never store secrets in any location. It also is not a home for pinned memory or the profile memory tree. Use the concrete Team workspace path shown in `<your_file_system>`; never invent `/team-*` or `$TEAM_DIR`, and never move, rename, or delete the Team workspace root.

## Pinned File Style

Write pinned memory as a curated index of current facts:

- Use stable headings and short bullets.
- Keep old resolved tasks out unless they explain a current preference, policy, relationship, or project state.
- Prefer links to detailed files over copied detail.
- Include dates only when recency or conflict resolution matters.
- Replace stale claims with the current version; do not append contradictory versions and leave future agents to guess.
- Do not store secrets, tokens, credentials, or unnecessary sensitive details.

Good pinned entries are short and actionable:

```text
- Prefers outbound sales drafts to be concise, direct, and lightly personal. Avoid hype.
- Active: Nordic B2B SaaS ICP. Details: compiled/sales-icp.md.
```

Avoid pinned entries that are really evidence trails:

```text
- On 2026-03-01 we discussed...
- On 2026-03-08 the user said...
- Full transcript pasted below...
```

## Maintenance Workflow

When asked to clean, organize, or review memory:

1. Inventory the memory root with file listing and `rg --files -g '*.md'`.
2. Check pinned file sizes with `wc -c` or `wc -m`; treat large pinned files as priority work.
3. Read the pinned files first, then search activity logs, observations, sources, compiled pages, entities, and sessions only as needed.
4. Decide whether each useful detail is current truth, source evidence, a compiled detail page, an entity fact, a skill, or disposable history.
5. Edit surgically. Preserve meaning; move detail before deleting it when provenance could matter.
6. Update indexes and links so moved detail remains discoverable.
7. Re-check sizes and run `oi.memoryLint` if available.

## Bulk Cleanup And Large Restructures

Use this section only for large reorganizations: migrating legacy, flat, or messy memory into the active memory system's structure, or restructuring a whole memory tree. For a single file or a small edit, stay with the surgical Maintenance Workflow above.

Consent gate. A bulk restructure moves and rewrites many files, so treat it as a large action, not routine maintenance:

- Do not start a bulk restructure just because memory looks messy, legacy-shaped, or worth improving.
- Start only after the user asks to reorganize or migrate memory, or clearly consents to it.
- If the user asked a general memory question or to edit one file, do not broaden it into a restructure without asking first.
- Before moving or rewriting files in bulk, restate the scope briefly and confirm, unless the user's latest instruction already clearly authorizes it.

Non-destructive rule. Preserve meaning first, improve structure second; never destroy memory just because it is messy:

- Do not delete, discard, or overwrite useful memory. Move it to the right home and keep a source copy or link when provenance matters.
- Cutting, merging, summarizing, normalizing headings, and rewriting prose are allowed only when the meaning stays the same.
- When two memories conflict, keep both pieces of evidence in a source page, then write the current best interpretation in the summarized home with dates or provenance.
- When unsure whether a detail matters, keep it in a source or compiled page instead of dropping it.
- Never relocate personal, profile, or companion memory into a mounted Team workspace during cleanup or migration. Team scope is team-visible, so moving private memory there is a disclosure. Restructure within profile memory unless the user explicitly asks to publish specific content to the team.

Method. Reorganize into the shapes of the memory system detected in Quick Triage — rich wiki homes (`sources/`, `compiled/`, `shared/entities/`) when that system is active, and activity logs, entity files, or clearly named companion documents otherwise:

1. Inventory before editing (see Maintenance Workflow) and sort each item by memory type into the narrowest home in Where Things Belong.
2. Create or refresh index files early so other agents can retrieve the new structure while the restructure is still in progress.
3. Migrate the layout; do not preserve the old one. When a file does not fit where it currently lives, move it to the matching home and keep its content, links, and meaning intact.
4. Move detail out of pinned memory as you go (see Moving Detail Out Of Pinned Memory): replace pasted history with concise summaries plus links to detailed pages.
5. In `shared/`, move entity-like files into `shared/entities/<type>/<slug>.md` rather than leaving them loose at the shared root.
6. Preserve provenance: when summarizing long unstructured notes, keep a dated source or link explaining where the fact came from.
7. Work in batches and lint per batch. If `oi.memoryLint` is available, run it with a focused path for each touched area (for example `{ path: "global/entities" }`, `{ path: "global/compiled" }`, or `{ path: "companion/compiled" }`), fix the reported issues, then rerun that focused lint. Run a final root lint (`{ scope: "all", path: "." }`) once the restructure is done.
8. Update indexes after every meaningful batch: `shared/entities/index.md` for entity pages, plus local index files in compiled/source directories that hold several pages. Good indexes list the important pages, say what each is for, and link related entity, source, and compiled pages; prefer short descriptive bullets over a raw filename dump.

## Moving Detail Out Of Pinned Memory

When a pinned file is too large:

1. Keep the current conclusion in the pinned file.
2. Move dated evidence, examples, and long context into `sources/`, `compiled/`, entity pages, or activity logs.
3. Leave a concise link from pinned memory to the new home.
4. Remove duplicate, stale, and low-signal bullets.
5. Re-read the pinned file after editing to make sure it still works as prompt context on its own.

Use source pages for evidence:

```markdown
---
source: observations
created_at: 2026-07-13
---

# Sales ICP Evidence 2026-07-13

Source: companions/<id>/memories/observations/2026-07-13.md

...
```

Use compiled pages for durable detail:

```markdown
# Sales ICP

Current summary, details, examples, open questions, and links to source pages.
```

## Entity Pages And Indexes

For durable nouns, prefer entity pages over repeated pinned bullets:

- Path shape: `shared/entities/<type>/<slug>.md`.
- Use kebab-case for both type and slug.
- Maintain `shared/entities/index.md` with concise links to important entity pages.
- Cross-link related people, companies, projects, deals, and source pages.
- Before leaving a pinned memory link to an entity, verify the target file exists.

## Archive Policy

Archive means "retrievable outside prompt memory", not "hidden forever".

Archive or move content when:

- It is older resolved work with no current implication.
- It is a dated trail whose only value is provenance.
- It is a long example, transcript, list, report, or raw source.
- It is a detailed project note that only matters for one future workflow.

Delete only when content is duplicate, wrong, unsafe to retain, or clearly no longer useful. If unsure, move it to a source or compiled page and link it.

## Health Checks

Use these checks before finishing memory work:

- Pinned files are comfortably below the practical target or have a clear reason not to be.
- Current facts are in pinned memory; evidence and detail are outside it.
- Every important moved page is linked from pinned memory, an index, or a related entity.
- Entity files have an index entry when they matter.
- Source files identify where the evidence came from.
- Contradictions are resolved in pinned memory, with provenance retained where useful.
- No secrets or unnecessary sensitive data were added.
- No personal or private profile memory was written into a team-visible Team workspace.

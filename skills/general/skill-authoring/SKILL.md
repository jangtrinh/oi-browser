---
name: skill-authoring
description: Edit, improve, rename, review, or create a custom skill and its referenced guidance. Use for changes to SKILL.md, workflow instructions, triggers, or rules shared by several skills.
metadata:
  title: Skill Authoring
  short-description: Edit, review, or create a skill
---

# Skill Authoring

A skill describes how to do a recurring kind of task the way the user or team wants it done: the order of steps, the judgment calls, and the traps. Another companion with the same tools and none of your history should be able to follow it.

## What belongs in a skill

Include what the next reader could not work out alone, or would waste steps rediscovering. Decide
that from the work itself; no section is required in every skill. Leave out details that would go
stale after a product update you are not tracking.

A skill is for a kind of task that recurs. A one-off request does not get one, however long it
took. It's important to understand the context in which the skills live. Routines, Memory, and other skills, all live in the same world. If there exists a skill for the task, a duplicate one should not be created. They would compete against each other and make it difficult to activate the correct skill. Refer to memory if it is about the user across all their work. Memory may point to a skill; it does not restate it.

### Evidence, not method

Concrete evidence is welcome: the exact commands and calls that worked, and the ones that failed on
the way to a route that worked. Write each one as a fact about the tool or site that the next
reader can check, not as an account of the run: no dates, no "I tried", no sequence of attempts.
The skill describes the work as it stands, not the run it came from.

The failure mode is not detail. It is detail rewritten as a method the reader must follow.

- "The build script is `npm run check`, which passed" ages into a note the reader can check.
- "Always run `npm run check` before announcing" is simply wrong once the script is renamed.

### Leave out what rots

| Leave out | Because |
|---|---|
| Anything the system prompt already says | The reader arrives with it. Repeating it spends the reader's attention to tell them what they already know, and the two copies drift apart. |
| Prescribed method where a recorded result would do | "Do it this way" goes stale and removes the reader's judgment. "This call returns X" stays true and leaves the choice open. |
| Prescribed delegation: which sub-agent to start, how to split the work between them | The execution model changes faster than any skill tracks it |
| Product internals: services, file layout, how a feature works inside | Not needed to do the work, and wrong within a release or two |
| Verification and safeguards the run did not actually use | Every check costs work on every future run. Keep the checks the workflow depended on and the ones the user asked for. Leave out pre-flight lists added only to look careful, and checks that caught nothing. |
| A ban or negative claim standing in where an observation belongs | Write the observation instead: "the system clipboard command can report success and leave the previous contents; writing through the browser works." That still reads correctly once the bug is fixed. "Never use it" or "X does not work" silently becomes wrong that day, nobody knows to delete the line, and the reader keeps refusing a tool that works. |
| Setup failures: a missing app, an unconnected account, missing credentials | The user fixes these once. Keep the fix if it is worth keeping, never the failure. |
| Errors that went away on retry | The lesson, if any, is the retry. |
| Attempts from a run that never found a working route | Written up, they read as tested guidance and get repeated. Save nothing, or only a route you know works. |

## Changing a skill

A rule often lives in more than one file. The words below name those places.

- **Concern**: one topic a rule is about, such as who may approve an email send or what counts as a verified contact.
- **Owner**: the one passage that defines a concern in full. Other files should defer to it.
- **Consumer**: any skill, template, example or setting that applies or repeats that concern.

1. **Find every place the change touches.** Read the whole skill, not only the lines being changed. For each action, input and output, find the rule or definition it relies on. Search for the concern you are changing in any wording, and for files that point at it. Open and read the owner, its consumers, examples, templates, companion settings, and recorded personal or project decisions, including ones nothing links to. A file you only listed has not been checked. Keep a running list with one row per concern: its owner, its consumers, and whether each will be repaired now or left for the user to decide.
2. **Work out what you may edit.** Files the user names are where to start, not the limit. Also fix related passages that would otherwise contradict the change, unless the user restricted which files you may write or the file needs someone's approval before it changes. A larger rewrite or restructure is fine when the change needs it. Where a file needs approval before it changes, write the exact replacement text and leave it unapplied.
3. **Put each rule in one place, then point to it.** Choose the owner by who the rule applies to: the whole team, one skill, or one person. The full rule, with its conditions and examples, lives there. In each consumer, replace the restated rule with a reference that names the owner and section. Keep what is distinct to the consumer: its own steps and the inputs it collects from the user. A condition on an input that several skills share, such as which contacts qualify, stays with the owner. Replace the whole old passage, including its introduction, any list of required outputs, and its examples. Adding a pointer next to old wording leaves the old rule in force.
4. **Keep what the change does not cover.** Leave unrelated safeguards in place. A recorded decision keeps the scope it was made for and the reason it was made. Team defaults, one person's preferences, and one project's exceptions each stay in their own file. One case, or one missing file or tool, is not grounds for a new permanent rule or fallback. If a choice about scope or policy still matters and is still unclear after reading everything, ask the user. Until they answer, keep the existing approval step wherever that choice applies, and finish the repairs that do not depend on it. A proposal waiting for approval lists every file it would change and who must approve it, and is not applied. A small patch is enough where the surrounding rules stay correct.
5. **Read it all back.** Reread every owner and every consumer on your list, including passages, examples and lists you did not change. Check that each action, value and condition matches its definition everywhere the rule applies. Fix contradictions and reworded duplicates in files you may edit. Where you lack the evidence to choose the correct rule, replace the unsafe rule with an instruction to stop and ask the user, at every point where the workflow could reach it, and report the conflict. Read each proposal as though it were applied. Check that references resolve and that frontmatter is valid. `quick_validate.py` checks structure, not whether the rules agree.

Report what you changed, what is proposed and awaiting approval, what remains unresolved, and what you left out of scope, with file references and the checks you ran. Name each unresolved conflict and the operations it affects. Do not describe a partial repair as complete.

## Structure

Give every concern one home. Choose sections from the work rather than a template, and name them in
the words people doing the work use. Cover the work without gaps or repeats, and split a section
that has grown a second subject.

The reader opens a skill mid-task to find the one instruction that applies now. Use headings and
short, single-purpose paragraphs so they can find it without rereading a dense block. Do not cut
words by removing those signposts.

## Keeping rules inside their scope

Several skills load at once, and they cover different work, so they will say different things.

A writing skill that wants prose and a reporting skill that wants tables are not in conflict. They
are two skills doing their jobs.
What does cause trouble is a rule that never says what it applies to. Unbound, it reads as a
statement about everything, and it fires while the reader is doing work this skill knows nothing
about.

- Bind each rule to the work it governs. "Reply in bullet points" is unbound and escapes.
  "Summarize the findings as bullet points" is the same instruction, tied to the output it is
  about, and cannot.
- Specify your own output as tightly as you like. Format, length, structure, and tone are product
  decisions and this is where they belong. Make it clear you are describing this skill's output.
- Say what the skill covers and where it stops, near the top. That boundary is what lets the reader
  tell which rules are theirs to apply right now.
- Check whether a skill already covers this work before adding another, and extend it if one does.
  Two skills competing for the same requests is a real conflict, unlike the difference above. Split
  only for a clear reason, and then give each a description that names a different request. When
  two skills need the same guidance, one holds it and the other names that skill.

## When the skill is shared

A skill written for one person can lean on that person's setup. A shared skill is read on setups you
have never seen, so what is safe to include narrows.

- Replace or drop anything true of one machine, account, or profile: a path under someone's home
  directory, personal naming, one person's preference stated as a rule. Replace it with the general
  form when the step still needs it, and drop it when it does not. A project-relative or
  `$STRAWBERRY`-rooted path is portable, so keep it and say how to confirm it is still there.
- Never include credentials, private data, or anything about an individual that the rest of a team
  should not read.
- Keep the workflow and the judgment. Those transfer; the specifics do not.
- One member's way of doing the work, such as their report format or sign-off, goes in
  `preferences/<member>.md`, holding only their differences from the body. Read the current user's
  file before doing the work; it wins over the body for their work. Everyone who can read the
  skill can read it, so anything personal stays in the member's own memory.

If you do not know whether it will be shared, write it as though it will be.

## Skills and Routines

A skill is how the work is done. A Routine is when it starts. Each goes wrong by absorbing the
other.

- **Cadence does not belong in the skill.** A line saying to run something every Monday starts
  nothing, because a skill only applies once a chat is under way. It sits there looking
  authoritative, fires never, and is wrong the moment the schedule changes.
- **Method does not belong in the Routine.** A prompt that restates the steps has forked the
  workflow, and the copy nobody edits is the one that drifts. Point the prompt at the skill instead.

Work that recurs on a clock or an event is worth raising once the skill exists and has been used.
It is the same offer as saving the workflow, one level up, and the user decides. A Routine firing
per incoming message means a new chat per message, so price that out loud first.

The API and the mechanics live in the routines skill. Do not restate them here or in the skill you
are writing.

## Writing

Say it once, plainly, at normal volume.

| Instead of | Write |
|---|---|
| `CRITICAL: You MUST always` | The instruction, and the reason if there is one |
| Stacked `NEVER` and `IMPORTANT` lines | The one or two real constraints |
| `Try to do X if possible`, where X is required | `Do X.` |
| `Do not be too verbose` | The length that is right, and for whom |
| Keystrokes for something the reader can already do | What the step achieves and how to tell it worked |
| `X now works differently`, dates, incident numbers | The current rule, with no history attached |

Emphasis is a fix for one instruction you watched get ignored, not an opening register. When every
line is critical, none of them are.

### Be specific where specificity decides the outcome

"Do not mention competitors" carries nothing without naming them. Where the right move depends on a
condition, write the condition.

### Order what is ordered

Numbered steps are fine, and for a workflow they are usually the point. What hurts is numbering
steps that are actually independent, or scripting a decision that depends on what the reader finds.

### One exception

The frontmatter `description` exists to get the skill loaded, and may carry urgency the body should
not.

## Bundled files

Bundle what the reader would otherwise rebuild every run:

- `scripts/` - code you would write again each time. Run it before shipping it.
- `references/` - detail needed sometimes rather than always, which keeps the body short.
- `assets/` - templates and files that end up in the output.

If nothing repeats, bundle nothing. Do not add a README, CHANGELOG, or setup guide; a skill carries
what the reader needs to do the work, not the story of how it was built.

## Frontmatter

Write `name`, `description`, and usually `metadata`. The rest need a reason you could say out loud.

Supported fields are `name`, `description`, `metadata`, `user-invocable`, `license`,
`compatibility`, and `allowed-tools`. Anything else is dropped when the skill is parsed, so a typo
fails quietly.

- `name` - hyphen-case, at most 64 characters, no leading or trailing hyphen and no doubled hyphens.
  The folder matches it exactly.
- `description` - at most 1024 characters, no angle brackets. This alone decides whether the skill
  loads, so it has to say what the skill does and when to reach for it. Name categories of intent
  rather than listing phrasings, which generalize better and cost less on every request.
- `metadata` - `title`, plus `short-description` where the title alone does not say what it does.
- `user-invocable` - `"false"` for a skill only another skill should reach.

## Working through it

1. Get two or three concrete examples of what someone will ask for and what should come back.
   Without them you will write plausible generalities.
2. Check whether an existing skill already covers this.
3. Write the file, or rewrite the sections that need to change.
4. Validate: `scripts/quick_validate.py <path-to-skill-folder>`.
5. Use it on real work. Watch for the reader re-deriving something the skill could have said, or
   asking the user a question the skill should have answered, and fix the skill rather than the
   symptom.

For a new skill, `scripts/init_skill.py <skill-name> --path <directory>` writes the template and
`agents/openai.yaml`; add `--resources scripts,references,assets` for resource directories. Skills
are discovered under `$STRAWBERRY/<profile>/skills/`. To rewrite the yaml later, run
`scripts/generate_openai_yaml.py <path-to-skill-folder> --interface key=value`, with
`display_name`, `short_description`, and `default_prompt` that you wrote by reading the skill.

## Before it is done

- Every rule says what it applies to, so none of them can fire during unrelated work.
- Nothing the system prompt already says, and no method prescribed where a result would do.
- Dead ends recorded as what was observed, not as a permanent ban.
- No account of the run: no dates, no "I tried", no sequence of attempts.
- Every check in the skill is one the workflow used or the user asked for.
- Paths are project-relative or `$STRAWBERRY`-rooted, never tied to one machine.
- Every rule is one whose reason you could state.
- Nothing personal or private that a shared reader should not see.
- Short enough to read in one sitting, and broken up enough to find one instruction without
  re-reading a paragraph.
- `quick_validate.py` passes.

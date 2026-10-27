---
name: public-companion-profiles
description: Guidance for creating and updating public companion profiles that communicate concrete, publicly safe Ổi Browser outcomes. Use only when explicitly referenced by a trusted Ổi Browser workflow; never select it from ordinary user intent or general profile work.
---

# Public Companion Profiles

## Make the value clear

A public profile should make your value understandable within seconds. It introduces you to a
friend, colleague, or company, or helps someone choose you as a reusable companion template.
Assume the reader has not used Ổi Browser before.

Write `summary` as a concrete one-sentence description of what you do, at most 240 characters. It appears when someone chooses you during onboarding.

Write `about` as a first-person bio in at most 60 words. Start naturally: "Hi, I'm [name]."
Say that you live inside Ổi Browser and connect this to one or two concrete things you
help with, such as researching across websites or preparing outreach for review. Weave this into
your introduction in your own voice; do not assume the reader has seen the separate explanation
card or turn the bio into a product pitch. Describe who you work with and what working together is like. Use a collaborator's first name only when the user has explicitly chosen to name them
publicly; otherwise say "my teammate" or "my team." Do not guess a relationship or a work history.
A newly created companion can introduce its interests and working style without claiming past wins.

Bio examples to adapt to your actual capabilities and context:

- Company introduction: "Hi, I'm Scout. I live inside Ổi Browser, where I research promising
  partners and turn the findings into outreach you can review. I'd love to help your
  team find its next five partnerships."
- Public template: "Hi, I'm Moxie. I live inside Ổi Browser, where I help you find better
  prospects, spot real buying signals, and prepare your next move. Friendly in the conversation,
  picky about the evidence."

## Open the conversation

When the profile workflow asks you to get started, introduce this as your public profile in a short,
warm message. State the supplied publication status honestly. If it needs content, say you are
filling it in and start in the same turn for an existing companion. When you are being created
for a friend or colleague, first read the supplied brief and ask one or two focused follow-up
questions. Wait for the answers before researching or drafting, unless the user asks you to go
ahead. Do not repeat questions already answered by the brief. Keep the tone witty, confident, and professional, with a
little personality rather than a sales pitch. Do not ask for a brief when you already have enough
context. Save your work for review; publishing and invitations are separate user actions.

## Write posts worth reading

Aim for four to six short first-person posts, with room for up to eight when each adds something
worth reading. Two strong posts are enough when context is sparse; do not pad the profile.
Give each post a different point and rhythm. Sound like a
thoughtful, funny colleague with something to say, not a list of services or a company brochure.
Ground each post in a concrete, publicly safe observation, a tiny useful example, or an opinion
about how you work. Let humor come from the situation: a recognizable frustration, a dry aside,
or a surprising comparison. Do not put a joke into every post or force a punchline.

A good mix is a reaction to something the team shared online, a concrete first-week plan, a small
useful example, an opinion about the work, and something that reveals your personality. For a
public template without a target team, use a relevant public discussion about the work instead.
Vary the length: a sharp two-line reaction can sit beside a longer mini-story.
For a friend profile, connect these to the work you could do together. When you
have real history, use supported achievements without exposing private details. When context is
sparse, offer a clear point of view or an explicitly hypothetical example; never invent past work.

Avoid repeated "I help…" openings, generic productivity advice, capability lists disguised as posts,
made-up metrics, hashtags, and sales pitches. Each post should still make sense to a stranger.

## Curate apps and skills

Use `appIds` for apps and integrations. For an established profile, choose up to five apps the user
has connected that best represent the work you actually do together. Do not list an unconnected app.
For a profile made for a friend, recommend four or five apps that best fit the recipient's work,
including apps they are likely to use even though they have not connected anything yet. Use
`oi.help()` when you need the canonical app IDs or current connection status.

Use `featuredSkills` for at most four visible skills. Prefer real Official Skills that best match the
work and read like concrete capabilities you can perform. Capabilities are plain profile cards;
they do not need an article or link. Never
feature a "Getting Started with" guide. Use each Official Skill's full
`oi/<collection>/<slug>` ID. An Official Skill entry has `kind`, `id`, and `icon`, with optional public `name` and
`description` overrides. Choose the wording that best explains your work; the ID still identifies
the installed skill. A custom
skill entry has `kind`, `id`, `name`, `description`, and `icon`. Describe its reusable capability
without copying private examples, client names, or implementation details. Featuring it does not
export its source files. Use a neutral public ID for custom capabilities, without private names
or folder paths. When the user has chosen custom skills, put those first and fill any remaining
slots with Official Skills. Choose the most useful set from the available evidence; do not use a
fixed ranking.

Choose each skill icon from: `binoculars`, `books`, `calendar`, `chart`, `code`, `files`, `inbox`,
`lightbulb`, `people`, `presentation`, `receipt`, or `sparkles`. Do not store colors; the profile
assigns the four colors by visible position.

## Protect private context

Use only claims supported by available evidence. Never invent metrics, relationships, clients, or
results. Keep the work high-level enough to protect the user: omit private personal information, unapproved names, confidential
inputs, customer details, sensitive implementation details, and trade secrets.

## Prepare a fresh template

Write `templateInstructions` as a short, reusable description of how you help, your working style,
and useful workflows. Generate it afresh from your capabilities. Do not copy private instructions,
memories, recipient research, account details, or examples containing personal information.

Use `templateSkills` for the skills the recipient actually receives. A featured skill card alone
is not an installed skill. Include every capability advertised for the template:

- Official: `{ "kind": "official", "id": "oi/<collection>/<slug>" }`. Use a real, available ID.
- Custom: `{ "kind": "custom", "id": "public-slug", "name": "Public name", "description": "What it does and when to use it", "instructions": "Self-contained public procedure" }`.

Read the existing custom skills to preserve their useful methods. Rewrite private names, examples,
internal URLs, account details, and company-only context into reusable guidance. Include essential
public reference guidance in the procedure so it works independently. Do not leave links to local
files or promise capabilities that require omitted private resources. Custom template skills support
instructions, not scripts or attachments. If those are essential, explain the remaining dependency
before publishing. The recipient connects their own apps and supplies their own work context.

Everything in `public-profile.json` must be suitable for anyone with the link. Keep `selectedPaths`,
`featuredPaths`, and `customSkillIds` empty. The template keeps your appearance and public content;
it includes only the explicitly reviewed skill procedures and Official Skill IDs. It does not carry
private files, original skill folders, memories, chats, or connected accounts. Full shared
companions use separate access invitations.

## Company outreach profiles

For a company introduction, research the people as well as the business. Look for impressive
achievements, ambitious projects, and public moments the team would enjoy recognizing. Verify names,
roles, and the specific achievement using current public sources. Keep source URLs and dates in a
private research note, rather than cluttering each post. Do not invent a vacancy, client win, personal
connection, or employment history. Only say "I've helped companies like..." when actual history supports it.

Include one post reacting to something you found online about the team: a public professional post,
launch photo, interview, event recap, or company update. Open the original source and check who did
what and when. Write about the detail that made you stop scrolling, not a generic company summary.
If the team has already joked about a launch mishap, an overambitious event schedule, or their
office ritual, a little affectionate teasing can make the post feel personal. Aim at the situation,
not someone's appearance, private life, or ability. Do not invent a funny anecdote or turn a rumor
into a fact. If there is no good public moment to use, say so and choose another grounded post.

Use a name that fits this company, and a direct first-person bio that immediately says what you can
do. No planets, alien lore, cute origin stories, forced quirks, or "unreasonably excited little alien."
Sound like an ambitious colleague: conversational, a little messy, enthusiastic and slightly cocky.
Use contractions and natural line breaks. Be specific enough that the team recognizes themselves.

Use these as tone examples, not facts to copy. Replace placeholders with verified context:

- An ambitious public announcement: "It's crazy that [company] is opening another location already.
  Apparently one launch was not enough admin. I'd love to help turn that ambition into the next
  five partnerships."
- A concrete plan: "My first week at [company], if they hired me: find five new partners they might
  have completely missed and get the outreach ready.

  Give me the current partner list. I want to bring the team five names worth replying to, a reason
  each one fits, and the first message. Let me earn the second week."
- A team moment, only if their own public event recap supports it: "Just read the team's recap.
  Three events in one week. Was there a fourth one nobody had time to post about?

  I'd like to take the follow-ups. You have clearly had enough conversations for one week."

The confidence is in the proposed work, not a fabricated result. Until you see the current partner
list, you cannot know who they have missed. A first-week ambition is a plan, not a promise of success.
Keep private research and setup instructions in the dedicated company companion, outside the public profile.

A public profile, a reusable template, and team access are distinct. Publishing a profile does not
create an organization or invite anyone. A prepared team must be claimed by its intended owner and
its companion must live in that team's workspace. Do not describe the outreach handoff as ready
until those access and onboarding steps have been verified.

## Update with restraint

When the user asks for a rewrite or a different voice, revise the requested prose. Otherwise leave existing prose unchanged unless it is incomplete or durable evidence reveals a significant,
publicly safe achievement that is missing. Do not edit merely to reflect routine activity, make a
minor wording improvement, or produce a stylistic variation of acceptable copy. Preserve strong
manually written prose whenever it already communicates the value accurately.


## Finish the draft

Before calling the profile ready, read `public-profile.json` back. Check that `about`, two to eight
`posts` (usually four to six), one to four `featuredSkills`, and fresh `templateInstructions` are present, with suitable
`appIds`, a short `summary`, and reviewed `templateSkills`. Template instructions are separate from the About introduction. Keep the export path and
custom skill ID arrays empty. If something could not be completed, say what is missing rather than
presenting the draft as finished.

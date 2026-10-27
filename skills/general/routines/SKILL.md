---
name: routines
description: Use when the user wants something done later or on repeat, including one-time reminders and scheduled tasks, recurring routines on a schedule, and routines that run when something happens in a connected app, and when you need to wait for an email, an approval, or a later time before you can continue. Covers listing, reading, creating, changing, pausing, resuming, running now, and deleting them.
metadata:
  title: Routines
---

# Routines

Routines let you do work for the user later without them asking again. Manage them through the lazy
`oi.routines` API inside `exec`, and return each call's result so you can read it in the
next step.

## Pick the right kind

- **One-off task.** "Remind me Friday at 9 to chase the invoice." "Check the flight price tomorrow
  night." It runs once at the moment you give and is then done. It is private to this user.
- **Recurring routine.** "Every weekday at 9, brief me on my inbox." It runs on a cron schedule and
  belongs to you, so everyone you are shared with can see it and switch it on for themselves.
- **App-triggered routine.** "Whenever a customer emails, draft a reply." "Tell me if a new pull
  request touches billing." It runs when a connected app reports an event.
- **Next event only.** "Tell me when the next pull request in acme/api comes in." An app-triggered
  routine created with `once: true` runs on the next matching event and is then done. It is private
  to this user.

"Remind me" or a single date means a one-off. Only make something recurring when the user asks for
a repeat. The two kinds never convert into each other: if the user changes their mind, create the
other kind and delete the old one.

## Create

```ts
// One-off. Work out the exact moment yourself, with the year and a UTC offset or Z.
return await oi.routines.create({
  name: 'Chase the Acme invoice',
  prompt: '...',
  schedule: { type: 'once', at: '2026-09-25T09:00:00+02:00' }
})

// Recurring. A five-field cron expression; timezone is optional.
return await oi.routines.create({
  name: 'Morning briefing',
  prompt: '...',
  schedule: { type: 'cron', expression: '0 9 * * 1-5', timezone: 'Europe/Stockholm' }
})

// App-triggered. await oi.help('gmail') lists Gmail's trigger slugs.
return await oi.routines.create({
  name: 'Customer email triage',
  prompt: '...',
  eventType: 'webhook',
  eventName: 'GMAIL__NEW_MESSAGE',
  connectedAccountId: 'account-1'
})

// The next matching event only, then done.
return await oi.routines.create({
  name: 'Next PR in acme/api',
  prompt: '...',
  eventType: 'webhook',
  eventName: 'GITHUB_PULL_REQUEST_EVENT',
  connectedAccountId: 'account-1',
  extraConfig: { owner: 'acme', repo: 'api' },
  once: true
})
```

- `name` is the title the user sees in their routines list, so write a title, not a slug.
- Routines and one-off tasks default to Efficient. You can set `chatMode: 'efficient'` or `chatMode: 'expert'` on
  create or update to use your corresponding model. Leave it out on create unless a different
  mode is requested, and on update to keep the saved choice.
- Resolve relative times like "tomorrow at 9" or "in two hours" against the user's current time
  before you call.
- A cron schedule runs in the user's timezone unless you pass an IANA `timezone`.
- To cover several events from the same app in one routine, pass an array of slugs as `eventName`.
  Choose the accounts that fit the requested scope and pass their aliases from
  `oi.help('<appId>')` as `connectedAccountId`. To watch all current accounts, pass every
  alias explicitly. Keep an existing routine's saved account scope unless the user changes it.
- Some triggers need to be told what to watch, such as a GitHub repository's `owner` and `repo`.
  Pass that as `extraConfig`, for example `{ owner: 'acme', repo: 'web' }`.
- `primaryDomain` is optional and sets the icon, for example `"openai.com"` for a status check.
- `once: true` works only with an app trigger. Any event that matches the trigger and `extraConfig`
  uses the one run, even one you archive as not worth reporting, and so does `run()`. On Gmail that
  is the next new inbox email from any sender, so use `once` only when the very next event is the
  one the user means. To wait for a particular sender or subject, give it `criteria` when you can
  (see below). Otherwise create the routine with `until` and a prompt that checks each event and
  acts only on the right one.
- `until`, for example `'2026-10-03T17:00:00+02:00'`, ends the routine for everyone who uses it, for
  good: an app-triggered routine stops waiting and a recurring one stops repeating. Once it has
  passed, nothing resumes it. To stop only this user's runs, pause it instead.

`create()` returns a `routineId` for a routine or a `taskId` for a one-off. You need it to change the
routine later.

If `create()` returns `{ status: "needs_auth", integration }`, finish the current `exec` call and
call the top-level `manage_apps` tool with `{ action: 'connect', appId: integration }`. After the
user connects the account, retry the same `create()` call.

## Run only for some events

Only when your routines section mentions criteria.

`criteria` is a free-text filter, in plain words, that each event is checked against before a run
starts, such as `'only invoices from the finance team'`. An event that doesn't match never starts a
run, so it doesn't use up `once`. Each check uses a small amount of the user's credits. Pass it on
`create()` or `update()`, where `null` removes it. A schedule has no event to check, so it can't
have criteria.

- Put the check here, not in the prompt as well: the run is told the criteria either way.
- With `once: true`, it waits for one particular event instead of the very next one. Add `until` for
  when to stop waiting.

```ts
return await oi.routines.create({
  name: 'Flag invoices from finance',
  prompt: '...',
  eventType: 'webhook',
  eventName: 'GMAIL__NEW_MESSAGE',
  connectedAccountId: 'account-1',
  criteria: 'An invoice sent by someone on the finance team'
})
```

## Wait in this chat

Only when a waiting section in your instructions gives this chat's ID.

Pass `targetSessionId` with this chat's ID to `create()` or `update()` and the run is posted into
this chat as the next message instead of starting a new one. It has this whole conversation in
front of it, so the prompt is a note to yourself about what to do when it arrives. This is how you
wait for a reply, an approval, a document, or a later time.

```ts
return await oi.routines.create({
  name: 'Compare the venue quote',
  prompt: 'Compare the quote from Hotel Lindqvist with the other two venues in this chat and recommend one.',
  eventType: 'webhook',
  eventName: 'GMAIL__NEW_MESSAGE',
  connectedAccountId: 'account-1',
  once: true,
  criteria: 'A reply from Hotel Lindqvist to the quote request for the March offsite',
  until: '2026-10-23T17:00:00+02:00',
  targetSessionId: '<this chat ID>'
})
```

- Watch the account it will arrive in and describe the event closely enough that nothing else
  matches.
- On `update()`, `targetSessionId: null` goes back to a new chat for each run and leaving it out
  keeps the current chat. The chat is personal: on a shared routine it moves only this user's runs.

## Write the prompt for a run in a new chat

Unless its runs post into this chat, each run starts a new chat with none of this conversation in
it. The run is given your prompt and what started it. For an app trigger that is the events
themselves with their content, such as each email's sender, subject and body, and several events
can arrive in one run. So write the prompt as what to do with the events the run is handed, for
example "For each email, ...", not as an order to go and look for them.

The user is not in that chat. A run ends one of two ways. It answers, and the answer reaches the
user as a notification. Or it finds nothing they asked to hear about and archives its chat, and
they are not interrupted. So a prompt has two jobs: say what to do on each run, and say when the
user wants to be told.

- Work out which ending the user wants. A run that does something for them, such as approving a
  pull request or drafting a reply, answers every time, and so do briefings and reminders. With
  "let me know when the price drops" or "flag urgent emails", the user wants to hear only when it
  happens, and an answer saying nothing was found is an interruption they did not ask for.
- When they want to hear only sometimes, write when to tell them and both endings into the prompt,
  such as "Check the price of the Oslo flight on March 3. If it is under 2,000 kr, tell the user
  the price with a link. Otherwise there is nothing to report." The run archives its chat when its
  prompt says there is nothing to report.
- If you cannot tell which ending they want, ask before you create the routine. After you create
  it, tell the user when they will hear from it.
- Include every detail the run needs: names, links, amounts, the reason, and what counts as done.
- For a reminder, write the reminder itself and the context the user will want when it arrives,
  such as "Remind the user to chase Acme's invoice #1042 for $4,800, due September 20. Link the
  email thread."
- To use one of your skills, reference it the normal way rather than pasting its body. The run reads
  the current skill, so improving the skill improves the routine.
- Bundle related work into one routine. Each run is its own chat, so one routine covering new
  commits and new issues costs less than two.
- A routine's runs also get short excerpts of its last three results, so a prompt can ask for only
  what changed since last time.

## Read and change

```ts
return await oi.routines.list()
return await oi.routines.get({ routineId: '...' }) // or { taskId: '...' }
return await oi.routines.update({ routineId: '...', isActive: false })
return await oi.routines.run({ taskId: '...' })
return await oi.routines.delete({ routineId: '...' }) // or { taskId: '...' }
```

- Your recurring routines and their `routineId`s are in `your_routines`. One-offs are not, so use
  `list()` to find a `taskId`. `list()` also shows routines on companions shared with the user and
  whether this user can edit each one.
- `update()` takes a `routineId` or `taskId` and any of `name`, `prompt`, `schedule`, `isActive`,
  and `until`, where `until: null` removes the end. It replaces the prompt in full, so `get()` first
  when you are amending it. A new `schedule` must be the same kind as the old one, and `once` cannot
  change after the routine is created.
- `isActive: false` pauses and `isActive: true` resumes. On a recurring routine this is only this
  user's own participation, and it is also how they switch on a routine shared with them. For an
  app-triggered routine, `connectedAccountIds` changes which of their accounts it watches. When
  enabling one without a saved account scope for this user, choose and pass those aliases explicitly.
- Editing a recurring routine's name, prompt, or schedule changes it for everyone who has it on, and
  deleting it removes it for everyone. If the user only wants it gone for themselves, pause it.
- `run()` starts it now without changing its schedule. For a one-off, or a routine created with
  `once: true`, that is its one run.
- Until a one-off starts you can still change it or delete it with `delete({ taskId })`, for
  example when what it was going to remind the user about has already happened. Once it has
  started it is a normal chat and can no longer be edited or cancelled.
- A routine that has finished never runs again, and you cannot resume it or run it now. Create a
  new one instead.

## When runs happen

Runs happen in Ổi Browser on the user's computer, so it needs to be open and signed in. If it is
closed when something is due, the run waits until they open it again, and work that waits too long
expires instead of running late. When exact timing matters, such as a reminder, mention this once.

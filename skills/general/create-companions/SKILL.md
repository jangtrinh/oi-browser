---
name: create-companions
description: Design and create a separate Ổi Browser companion for the user, a friend, or a colleague directly in chat. Use only when the user explicitly asks to create or design a new companion, or explicitly asks whether a distinct specialized companion would be appropriate. Do not use merely because a workflow could become a skill, a task could be delegated to a sub-agent, or another companion might help.
metadata:
  title: Create Companions
  short-description: Design a separate specialized companion
---

# Create Companions

Creating a companion adds a personal AI teammate with its own identity and context. Do not create
one for a temporary task or reusable procedure.

## Choose the right boundary

- Use a **skill** when the same companion should repeat a workflow with the same working context.
- Use a **sub-agent** for bounded or parallel work that does not need a new durable identity.
- Create a **companion** when the user wants a distinct teammate with its own role, memories, skills,
  files, or model settings.

Do not propose or create a companion unless the user has explicitly raised creating or designing one.

## Design together

For a companion intended for someone else, call the `recipient` overload below; the tool checks
staff-admin access. Do not substitute the personal `name`/`character` overload: it does not create
the recipient brief or friend profile. If access is denied, explain that limit without creating
a personal replacement. Complete the flow here without sending the user to a form.

Agree on:

- A short, distinct name.
- A one-sentence description of its specialty.
- One concise Character paragraph written directly to the companion in `You are...` form. Summarize its role, personality, expertise, working style, and important boundaries without exceeding one paragraph. This becomes its editable Instructions.

Explain any meaningful tradeoff between a new companion and a skill or sub-agent. Do not create anything while the user is still brainstorming. Before creation, summarize the design and ask for confirmation unless the user has already clearly approved that exact design.

## Create for the current user

Create the companion through Ổi Browser's managed API:

```typescript
const companion = await oi.createCompanion({
  name: 'Pipeline Partner',
  description: 'A CRM specialist for pipeline hygiene and sales operations.',
  character:
    'You are Pipeline Partner, a careful CRM specialist who keeps pipeline data accurate, explains important changes clearly, and avoids destructive bulk updates.'
})
```

Do not create or edit a sibling companion folder directly. The managed API registers the companion, writes its manifest, stores the approved guidance as its Instructions, and updates the UI.

After creation, tell the user its name and provide `companion.settingsUrl`. Do not change which companion the user is chatting with unless they ask.

If the user wants the new companion to handle something immediately, delegate with its returned id:

```typescript
await oi.startAgent({
  companionId: companion.companionId,
  id: 'pipeline_help',
  label: 'Pipeline help',
  prompt: '...'
})
```

`startAgent` waits for the bounded execution's result by default. Explicitly background the enclosing
exec only when that work should continue independently.

## Create for a friend or colleague

The recipient option below is available only to Ổi Browser staff admins.

Use the person's name and the context the user has already supplied. Ask one or two useful questions
in this conversation only if you need more context. Do not repeat questions already answered or
require the user to decide a name, role category, or character description first.

```typescript
const companion = await oi.createCompanion({
  recipient: {
    fullName: 'Alex Example',
    company: 'Example Studio',
    description: 'Alex leads partnerships and wants help finding relevant prospects and preparing introductions.'
  }
})
```

This uses the same creation flow as the friend form: a separate companion and a private recipient
brief, with an empty public profile. It does not publish anything or send an invitation. The current
chat keeps its original companion.

Research and write the profile using the new companion's own context:

```typescript
await oi.startAgent({
  companionId: companion.companionId,
  id: 'friend_profile',
  label: 'Prepare companion profile',
  prompt: 'Read your profile-builder.json and the companion profile guidance in Ổi Browser docs. Use the agreed brief to research the recipient and write your public-profile.json, including public starter instructions and skills. Keep private research in profile-builder.json. Use only the recipient’s first name in public content. Choose a fitting companion name. Ask only if a material detail is missing; the brief already contains the user’s answers. Do not publish or send an invitation.'
})
```

Check the child result before saying the profile is ready. Give the user `companion.profileUrl` to
review it, or open that URL with `oi.openTab({ url: companion.profileUrl, controlled_by: 'user' })`.
This is a private editor link inside Ổi Browser, not a public recipient link. The user can publish
from the profile and copy the recipient link once the content is ready.

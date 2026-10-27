---
name: linkedin
description: Use before any LinkedIn work, such as finding or checking people, sourcing, sorting invitations or connections, reading post engagement, messaging, or connecting, to keep the user's account safe and your results trustworthy.
user-invocable: 'false'
---

# Work on LinkedIn

LinkedIn work runs on the user's own account. A restriction or ban harms them directly and can't be undone, so account safety comes before speed.

## Keep the account safe

- Research ordinary LinkedIn profiles with `oi.extract`, which reads the signed-in UI.
- Use the LinkedIn tools available in app help when they fit the task. Their descriptions explain the enabled actions and how to reuse their results.
- Never call LinkedIn APIs, including the internal Voyager API or any `linkedin.com` endpoint from code. Never replay captured requests.
- Use one agent on LinkedIn at a time, at a human pace. Parallel work is fine off LinkedIn, such as web research or enrichment providers like Apollo, Lusha, Hunter, or People Data Labs.
- If you encounter a CAPTCHA, security check, restriction, or warning page on LinkedIn, stop and tell the user.
- Before a user's first LinkedIn task or a larger batch, mention that you'll work at a measured pace and that using LinkedIn elsewhere at the same time, in another tab or on their phone, makes the account look automated.

## Plan around the activity tracker

Ổi Browser's existing per-site queue spaces LinkedIn page loads automatically. Its **Usage notices** are advisory: a high observed count does not block navigation or require a pause by itself. These are Ổi Browser operating defaults, not LinkedIn's quotas or remaining allowance. The tracker does not count the user's own browsing or actions like invitations and messages, so it cannot prove the account is safe to use.

| Page type                    | Notices from | Guideline | Window                 |
| ---------------------------- | ------------ | --------- | ---------------------- |
| All LinkedIn page loads       | 30 / 60 / 120 | Advisory  | 10 minutes             |
| General activity on ordinary LinkedIn | 120 | 150       | 24 hours               |
| Member-profile visits        | 60           | 80        | 24 hours               |
| People searches              | 200          | 250       | Pacific calendar month |

Specialized profile/lead/search counts deduplicate repeat visits within 10 minutes. General page-load counts include repeat navigations. If a notice disagrees with this table, trust the runtime notice. Research tools describe their separate activity guidance in app help.

- Before a large task, estimate the pages it needs and start by screening search rows before opening profiles.
- After a notice, reuse collected evidence and avoid unnecessary loads. Continue authorized research through the pacing queue when appropriate; do not schedule a continuation or report a permission block solely because of an advisory count. An actual CAPTCHA, checkpoint, restriction or warning page still requires stopping and telling the user.
- On free accounts, people searches count toward LinkedIn's monthly commercial-use limit. Narrow with filters instead of running many broad searches.
- LinkedIn also limits connection invitations per week (often around 100) and InMail by plan. Keep your own count of what you send.

## Get the person right

- Confirm a match with several signals: photo, current role and company, past companies, school, location, and mutual connections. With a common name or conflicting signals, show the uncertainty instead of picking the first result.
- Never guess profile URLs. Use the real `/in/` URL from the page and cite it so the user can check.

## Reach out

- Ask before sending anything, including invitations, messages, InMail, comments, and posts, unless the user approved the exact action and recipients. If you're unsure about the recipient, don't send.
- Send connection requests without a note by default. Add one only when the user asks.
- Check whether email, a warm intro through a mutual connection, or a call would work better than LinkedIn.
- People who reacted to or commented on the user's own posts are warm leads.

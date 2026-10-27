# Recruiter Lite research

- For Recruiter Lite, load search and candidate schemas together with `oi.help('integration:linkedin', { actions: ['recruiter_lite_search', 'recruiter_lite_candidate'] })`; add `recruiter_lite_filters` when configuring filters. Reuse the open pool and returned `tabId`. Save raw search/profile JSON in code or files, screen before opening candidates, and read selected candidates. Recruiter Lite navigation is paced by Ổi Browser's shared limiter, including batched or parallel tool calls. Return decisions, exact supporting quotes, dates and unresolved gaps; avoid repeating employer metadata or unrelated roles. Use `detail: 'full'` for all positions and long descriptions from the rich page-loaded JSON. `history.allLoadedPositionsReturned` confirms all roles in that response were returned. Build timelines from those saved roles without expanding Experience or rereading the same history. Missing or truncated evidence is unresolved, not a rejection; check `descriptionTruncated` and `summaryTruncated`. Inspect Experience only for a concrete missing-data problem or an explicitly requested visible-end check. Check candidate-specific activity when prior contact matters, and reuse that evidence instead of opening more contact views once it answers the question.

- For longer Recruiter runs, keep progress by observed candidate ID, with the saved source, decision, exact evidence, unresolved gaps and existing history/activity findings, including unknowns. Resolve concrete history gaps or required contact checks. Resume pending IDs rather than reopening completed profiles. Keep employer identity evidence by observed company ID for reuse. Return only the current batch’s decisions and gaps; assemble the final report from saved evidence.

## Activity guidance

| Activity | Warning | Reference | Window |
| --- | ---: | ---: | --- |
| Recruiter candidate visits (Lite / unverified seat) | 1800 | 2000 | 24 hours |
| Recruiter search-page loads (Lite / unverified seat) | 72 | 80 | 24 hours |

The ordinary aggregate daily guideline does not apply to Recruiter pages. Pagination and filter reloads count as search-page loads. These notices are advisory; they do not require a pause by themselves. Trust runtime notices if they differ, and reuse collected evidence. Actual LinkedIn restrictions, CAPTCHA or verification challenges still require stopping.

Recruiter references follow [LinkedIn's published Lite allowance](https://www.linkedin.com/help/recruiter/answer/a497998) of 2,000 unique candidates per UTC day, with a warning at 90%. The search-page reference is derived assuming 25 new candidates per full page; it is not a separate LinkedIn quota. Profile and search references are not two budgets to add together. Ổi Browser counts rolling 24-hour navigations, not unique people, so it cannot measure the remaining UTC-day allowance, repeated candidates, exclusions or activity elsewhere. Unknown Recruiter seats use the Lite reference without inferring a full Recruiter entitlement.

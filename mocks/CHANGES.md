# Mock change log

Every change Jazz asked for, which mock it belongs to, and whether it's in. Newest requests at the bottom of each section. Decisions and reasons are in `hackwestern-coffee-prefs/docs/decisions.md`; the sponsor calendar spec is `hackwestern-coffee-prefs/docs/specs/sponsor-chat-calendar.md`.

Status: **Done** = in the mock and checked. **Building** = a subagent is adding it now. **Not yet** = asked for, not in any mock.

## Default style for every mock (Jazz, 2026-11-19)
Use the look of `sponsor-portal-flow-hacker-v1/index.html#today` (the hacker /live site style; its README lists every source file:line) for ALL mocks, unless Jazz explicitly names another look for that mock. Current exception: `organizer-coffee-autofill-v6a/b/c` build on autofill-v5's look because Jazz asked for that explicitly.

## Final mocks
- **Sponsor portal (final):** `sponsor-portal-flow-hacker-v3` (hacker-v2's look + everything below)
- **Organizer coffee chats (final candidates):** `organizer-coffee-autofill-v6a`, `-v6b`, `-v6c` (autofill-v5's look; three ways to show sponsor info on the same page)

## Sponsor portal: `sponsor-portal-flow-hacker-v3`
| # | Change | Status |
|---|---|---|
| 1 | Look: hacker /live site (hacker-v2), not the refined or app look | Building |
| 2 | 4 nav tabs + one Help button; content starts at the top on phones (portal review) | Building |
| 3 | Judging is its own nav tab (Today, Chats, Schedule, Judging, Map), from Lucas's flow on main + Nov 18 rules; only for prize-track sponsors | Building |
| 4 | Schedule in the organizer Run of show style (hacker-v2) | Building |
| 5 | Schedule "Show hackathon events" shows ALL 35 events from the RUN OF SHOW sheet | Building |
| 6 | Map: remove "find a room"; show Julian's Level 1 / Level 2 maps from the live site; Sponsor Bay with their spot; Ivey line | Building |
| 7 | Help: "Your name" and "Phone we can call back" required, prefilled from main contact, editable | Building |
| 8 | Chats setup = 4 steps: Your team, Calendar, Shortlist, Confirm; "Submit by Fri Nov 20, 11:59 PM" | Building |
| 9 | Your team starts EMPTY; add reps with name, phone, email; main contact name + phone required | Building |
| 10 | Calendar view kept; drag to create/resize/move (from calendar-v1); tap on phones | Building |
| 11 | Columns are rooms ("Room 1, Room 2"); a shared room shows as ONE block with both reps | Building |
| 12 | "Organizers assign real rooms after you confirm"; sponsors never pick rooms | Building |
| 13 | 25 min chat + 5 min break for 30-min chats; room limit 6 = reps + hackers; over-hours allowed in amber | Building |
| 14 | Flexibility question: Not flexible / Within 1 hour / Anytime 10–5 | Building |
| 15 | Live busy-times strip (all sponsors, drafts included, updates every few seconds) | Building |
| 16 | Their own schedule on the calendar: own workshop and meals | Building |
| 17 | NO chats within 15 min of their OWN workshop (before or after, setup included); lunch and dinner shown as dotted outlines, allowed | Building (asked 2026-11-19, late) |
| 18 | After submit: Shortlist + "Met at Hacker Fair" lists | Building |
| 19 | Scan: "Which rep wants to talk to them?", then the offer (time, rep, building) | Building |
| 20 | Assigned rooms show building + walk: "Ivey, Rm 1352 · 15 min walk · leave by 9:45"; Ivey offers expire 35 min before | Building |
| 21 | Editing after invites: allowed with a strong warning; hackers reconfirm | Building |

## Organizer coffee chats: `organizer-coffee-autofill-v6a/b/c`
| # | Change | Status |
|---|---|---|
| 1 | Build on autofill-v5's styling (Jazz's favourite) | Building |
| 2 | Coffee chats start at 10:00 AM; nothing before 10 | Building |
| 3 | No "Nudge on Slack". "Contact" button: the sponsor's reps + main contact + HW lead, each with phone, Copy, Message (drafted, editable text) and Call | Building |
| 4 | Rooms first, sponsor info on the SAME page. No side drawer/popup | Building |
| 5 | Three versions of where sponsor info goes: v6a detail below the grid, v6b every sponsor listed below as expandable rows, v6c a sponsor timeline under the rooms on the same time axis | Building |
| 6 | Clicking a sponsor shows everything the sponsor gave in hacker-v3: team with phones, main contact, their planned blocks, flexibility answer, slots (seats, booked, waiting), schedule overlaps, shortlist, Met at Hacker Fair | Building |
| 7 | Organizer bookings = ad hoc room bookings only (e.g. a sponsor wants a room last minute); no schedule events, no separate tab | Building |
| 8 | Send and lock per sponsor; four status words: Needs shortlist, Ready to send, Sent, Confirmed | Building |
| 9 | 8 rooms: 2241–2243 near, Ivey 1348–1358 (15 min walk); organizers decide rooms and clashes | Building |
| 10 | "Couldn't be placed" as a clickable warning | Building |

## Organizer sponsors home: `organizer-sponsors-home-v1`
| # | Change | Status |
|---|---|---|
| 1 | Keep the current dashboard look (Lucas's) | Done |
| 2 | Remove "Left" status | Done |
| 3 | Columns: Sponsor, HW lead, Where now, Needs attention + day columns; drawer for the rest; "Not on site" group | Done |

## Older mocks (kept for comparison, not final)
- `sponsor-chat-setup-modal-a/b/c-v1`: modal versions (Jazz preferred B's look, then dropped modals)
- `sponsor-chat-setup-steps-v1`: in-page numbered steps (replaced by the calendar)
- `sponsor-chat-calendar-v1`, `-v2`: calendar experiments; v1's drag and v2's team/rooms/strip go into hacker-v3. v2 wrongly prefilled reps.
- `sponsor-portal-flow-app-v1`, `-refined-v1`, `-hacker-v1`, `-hacker-v2`: the three looks; hacker won
- `organizer-coffee-autofill-v4`, `-v5`, `organizer-coffee-cards-grid-v1`, `-v2`: organizer board experiments; v5's look won; cards-grid-v2 has the Contact panel to reuse

## Not in any mock yet
- Organizer home table bug: `/internal/sponsors` is blank below the filter pills at phone width (live app; fix in the build)
- Sun Life's booth spot must match `src/lib/sponsor-bay-layout.ts` everywhere (hacker-v3 is fixing)

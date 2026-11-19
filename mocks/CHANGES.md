# Mock change log

Every change Jazz asked for, which mock it belongs to, and whether it's in. Newest requests at the bottom of each section. Decisions and reasons are in `hackwestern-coffee-prefs/docs/decisions.md`; the sponsor calendar spec is `hackwestern-coffee-prefs/docs/specs/sponsor-chat-calendar.md`.

Status: **Done** = in the mock and checked. **Building** = a subagent is adding it now. **Not yet** = asked for, not in any mock.

## Default style for every mock (Jazz, 2026-11-19)
Use the look of `sponsor-portal-flow-hacker-v1/index.html#today` (the hacker /live site style; its README lists every source file:line) for ALL mocks, unless Jazz explicitly names another look for that mock. Current exception: `organizer-coffee-autofill-v6a/b/c` build on autofill-v5's look because Jazz asked for that explicitly.

## Sponsor portal v4: `sponsor-portal-flow-hacker-v4` (latest final)
| # | Change | Status |
|---|---|---|
| 1 | Remove "Main contact" fields; one rep is marked Primary contact (crown) | Building |
| 2 | Rep phone required | Building |
| 3 | Shortlist cards show steps-v1 step-6 info (school, program, year, role, skills, résumé) + interests + avatar (pixel avatar / team-finder photo) + LinkedIn link; no LinkedIn scraping | Building |
| 4 | Scan → "Add a hacker" (scan QR or enter hacker ID), disabled until Sat 10:00 AM | Building |
| 5 | Remove lunch and dinner from the calendar (keep own-workshop zone) | Building |
| 6 | Remove "Copy to another rep" | Building |
| 7 | Rep timeline: reps as rows, time across; rows above for workshop, hacker demand/room availability, "Counts as hours"; group block spans its reps' rows; no rooms, no date | Building |
| 8 | Edit on the block: expand in place for reps, 15/30 toggle, − / + hackers per chat, live chats line; drag edges for start/end | Building |
| 9 | Step label "Give us your chatting preferences" | Building |
| 10 | One deadline Fri 9:30 PM (invites out by 10 PM) for team + preferences + optional shortlist; auto-submit at the deadline; scanned hackers are first choice; all invites sent Friday night; Saturday scans only fill open seats | Building |
| 11 | Map works exactly like the hacker live site map (pinch / ⌘-Ctrl + scroll zoom, drag to move, same buttons and text) | Building |

## Final mocks
- **Sponsor portal (final):** `sponsor-portal-flow-hacker-v3` (hacker-v2's look + everything below)
- **Organizer coffee chats (final candidates):** `organizer-coffee-autofill-v6a`, `-v6b`, `-v6c` (autofill-v5's look; three ways to show sponsor info on the same page)

## Sponsor portal: `sponsor-portal-flow-hacker-v3`
| # | Change | Status |
|---|---|---|
| 1 | Look: hacker /live site (hacker-v2), not the refined or app look | Done |
| 2 | 4 nav tabs + one Help button; content starts at the top on phones (portal review) | Done |
| 3 | Judging is its own nav tab (Today, Chats, Schedule, Judging, Map), from Lucas's flow on main + Nov 18 rules; only for prize-track sponsors | Done |
| 4 | Schedule in the organizer Run of show style (hacker-v2) | Done |
| 5 | Schedule "Show hackathon events" shows ALL 35 events from the RUN OF SHOW sheet | Done |
| 6 | Map: remove "find a room"; show Julian's Level 1 / Level 2 maps from the live site; Sponsor Bay with their spot; Ivey line | Done |
| 7 | Help: "Your name" and "Phone we can call back" required, prefilled from main contact, editable | Done |
| 8 | Chats setup = 4 steps: Your team, Calendar, Shortlist, Confirm; "Submit by Fri Nov 20, 11:59 PM" | Done |
| 9 | Your team starts EMPTY; add reps with name, phone, email; main contact name + phone required | Done |
| 10 | Calendar view kept; drag to create/resize/move (from calendar-v1); tap on phones | Done |
| 11 | Columns are rooms ("Room 1, Room 2"); a shared room shows as ONE block with both reps | Done |
| 12 | "Organizers assign real rooms after you confirm"; sponsors never pick rooms | Done |
| 13 | 25 min chat + 5 min break for 30-min chats; room limit 6 = reps + hackers; over-hours allowed in amber | Done |
| 14 | Flexibility question: Not flexible / Within 1 hour / Anytime 10–5 | Done |
| 15 | Live busy-times strip (all sponsors, drafts included, updates every few seconds) | Done |
| 16 | Their own schedule on the calendar: own workshop and meals | Done |
| 17 | NO chats within 15 min of their OWN workshop (before or after, setup included); lunch and dinner shown as dotted outlines, allowed | Done |
| 18 | After submit: Shortlist + "Met at Hacker Fair" lists | Done |
| 19 | Scan: "Which rep wants to talk to them?", then the offer (time, rep, building) | Done |
| 20 | Assigned rooms show building + walk: "Ivey, Rm 1352 · 15 min walk · leave by 9:45"; Ivey offers expire 35 min before | Done |
| 21 | Editing after invites: allowed with a strong warning; hackers reconfirm | Done |

Hacker-v3 finished 2026-11-19 (41/41 browser checks). Its choices to confirm: lunch uses the sheet's 12–1:30; Sponsor Bay shown as Rm 1235 (sheet says SM Atrium); Priya + Leo moved to 12:30–1:30 to clear the workshop zone; stage times and Sun Life's judging room (Rm 2240) are placeholders.

## Organizer coffee chats: `organizer-coffee-autofill-v6a/b/c`
| # | Change | Status |
|---|---|---|
| 1 | Build on autofill-v5's styling (Jazz's favourite) | Done |
| 2 | Coffee chats start at 10:00 AM; nothing before 10 | Done |
| 3 | No "Nudge on Slack". "Contact" button: the sponsor's reps + main contact + HW lead, each with phone, Copy, Message (drafted, editable text) and Call | Done |
| 4 | Rooms first, sponsor info on the SAME page. No side drawer/popup | Done |
| 5 | Three versions of where sponsor info goes: v6a detail below the grid, v6b every sponsor listed below as expandable rows, v6c a sponsor timeline under the rooms on the same time axis | Done |
| 6 | Clicking a sponsor shows everything the sponsor gave in hacker-v3: team with phones, main contact, their planned blocks, flexibility answer, slots (seats, booked, waiting), schedule overlaps, shortlist, Met at Hacker Fair | Done |
| 7 | Organizer bookings = ad hoc room bookings only (e.g. a sponsor wants a room last minute); no schedule events, no separate tab | Done |
| 8 | Send and lock per sponsor; four status words: Needs shortlist, Ready to send, Sent, Confirmed | Done |
| 9 | 8 rooms: 2241–2243 near, Ivey 1348–1358 (15 min walk); organizers decide rooms and clashes | Done |
| 10 | "Couldn't be placed" as a clickable warning | Done |

## Organizer dashboard restyle: `organizer-dashboard-restyle-v1` (replaces nav-a/b/c as the direction)
| # | Change | Status |
|---|---|---|
| 1 | Jazz disliked the new layouts (nav-a/b/c). Keep the ORIGINAL live dashboard layout, section by section | Done |
| 2 | Restyle each component in the hacker-v1 look | Done |
| 3 | Keep nav-a-v1's sidebar (desktop) / bottom tabs (phone) | Done |
| 4 | Coffee chats and Sponsor judging: current layout, marked WIP | Done |
| 5 | Keep decided content: no "Left" status; overdue task "Text <owner>" + "Mark done"; no Slack nudges for sponsors | Done |

## Organizer dashboard redesign (all sections, phone first): `organizer-dashboard-nav-a/b/c-v1`
| # | Change | Status |
|---|---|---|
| 1 | Redesign the whole organizer dashboard end to end, keeping the real data: Sponsors, Run of show, Coffee chats, Sponsor judging, Task pings | Done |
| 2 | Coffee chats and Sponsor judging are "WIP" placeholders for now | Done |
| 3 | Mainly viewed on phones: find the best way to switch sections; 3 versions: A bottom tab bar, B swipeable top tabs, C home hub + header switcher | Done |
| 4 | Hacker-v1 look (default style) | Done |
| 5 | Sponsors uses the approved organizer-sponsors-home-v1 content (cards on phones, detail on its own screen, no drawer, "Left" removed) | Done |
| 6 | Run of show uses the real sheet (35 events, 55 tasks, team availability) from `_data/run-of-show-snapshot.json` | Done |
| 7 | Task pings: Up next + Ping log; no sponsor help queue (help goes to Slack) | Done |

## Sponsor judging redesign: `sponsor-judging-redesign-a/b/c-v1`
| # | Change | Status |
|---|---|---|
| 1 | Three versions of sponsor judging with dummy Devpost data (`_data/devpost-projects.json`): A swipe card stack, B scorecard list with rubric, C demo-fair route + board | Done |
| 2 | Flow: locked → round 1 score + shortlist 5–10 → send → presentations → round 2 rank 1st–5th → review (team IDs) → sent | Done |
| 3 | Hacker-v1 look, phone first | Done |
| 4 | Sheet: "Sponsor Judging" tab with team IDs and 1st–5th place columns | Done (tab created; app code to fill it is in the build) |

## Sponsor judging D: `sponsor-judging-redesign-d-v1`
| # | Change | Status |
|---|---|---|
| 1 | Score is a scrollable 1–10 in 0.5 steps, like Holia's judging UX | Building |
| 2 | "Rubric" button opens Holia's (latest) rubric as a modal | Building |
| 3 | Three ways through the Devposts: one at a time, 5 at a time, quick pass (swipe Yes/Maybe/No) | Building |
| 4 | Several reps on one account: "Who's judging?", list split between reps, scores show who gave them, disagreement flag, live updates | Building |

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
- Judging (sponsor + organizer): show every team as team ID + Devpost link; digital top 5 entered by pasting Devpost links (app matches to team, shows name + ID to confirm) (decision 2026-11-19). Sponsor judging redesigns A/B/C show IDs only.
- Organizer Sponsor judging: a "Digital sponsors" section where the spon team enters a digital sponsor's 1st–5th place (PCBWay today), filling the Sponsor Judging tab (decision 2026-11-19). Organizer redesigns A/B/C show judging as WIP, so this goes into the judging build.
- Organizer Sponsors: digital sponsors grouped and greyed, no portal link (sheet already done)
- Sponsor Help (hacker-v3 → needs a v4): "Text <lead> (your contact)" as the main action with a drafted text + Call; if the lead is off shift (from the Spon Team schedule), "Leave a message" → Slack post @mentioning whoever's on call; "Send to the whole sponsor team" as a small backup link; one line "Help desk: by the stairs outside the Grand Hall" (decision 2026-11-19)
- Organizer Pings: "Text" button on overdue tasks (opens Messages with a drafted reminder); automatic pings stay on Slack
- Organizer home table bug: `/internal/sponsors` is blank below the filter pills at phone width (live app; fix in the build)
- Sun Life's booth spot must match `src/lib/sponsor-bay-layout.ts` everywhere (hacker-v3 is fixing)

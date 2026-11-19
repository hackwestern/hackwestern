# Mock change log

Every change Jazz asked for, which mock it belongs to, and whether it's in. Newest requests at the bottom of each section. Decisions and reasons are in `hackwestern-coffee-prefs/docs/decisions.md`; the sponsor calendar spec is `hackwestern-coffee-prefs/docs/specs/sponsor-chat-calendar.md`.

Status: **Done** = in the mock and checked. **Building** = a subagent is adding it now. **Not yet** = asked for, not in any mock.

## Default style for every mock (Jazz, 2026-11-19)
Use the look of `sponsor-portal-flow-hacker-v1/index.html#today` (the hacker /live site style; its README lists every source file:line) for ALL mocks, but with Figtree for all text and NO Pix32 pixel font (Jazz dislikes it, 2026-11-19), unless Jazz explicitly names another look for that mock. Current exception: `organizer-coffee-autofill-v6a/b/c` build on autofill-v5's look because Jazz asked for that explicitly.

## Sponsor portal v6: `sponsor-portal-flow-hacker-v6` (latest final, building)
| # | Change | Status |
|---|---|---|
| 1 | No rep emails; "Add each rep from Sun Life."; name + phone required; company names never wrap | Building |
| 2 | Per-rep "How many chats?" stepper with time shown, replaces hours per rep | Building |
| 3 | Help is a modal; confirmation "Sent. We'll contact you at 555-0142."; no Slack text; close returns to the same page | Building |
| 4 | Shortlist one at a time + "Who's shortlisting?"; one shared team shortlist labelled by who picked, live | Building |
| 5 | "Your chats" calendar view (reps × sessions, room + building), toggle by rep | Building |

## Sponsor portal v5: `sponsor-portal-flow-hacker-v5` 
| # | Change | Status |
|---|---|---|
| 1 | Copy of v4 with every v4 change | Done |
| 11 | Chatting preferences = Daniel's fixed-session model (`docs/specs/coffee-chat-sessions.md`): Q1 hackers per chat 1–5 (+ longer 1-on-1s), Q2 toggle grid of reps × sessions 10–11 … 4–5 (no 12–1), own workshop blocks cells, Q3 hours per rep 1/2/3/4+; "Up to N chats · up to N hackers"; Review & submit preferences; Confirmed schedule state; "Message organizers" link. Reconciled with Jazz's choices (crown primary, reps only in Your team, workshop only, two flows, no hours totals, Figtree) | Done |
| 8 | Two separate flows, each with its own Review & submit, made obviously different: (1) Chatting preferences (required): Your team → Preferences → Review & submit preferences; (2) Shortlist (optional): Shortlist → Review & submit shortlist. Two entry cards on Chats; separate step rails; shortlist locked until preferences are submitted (seat cap comes from them) | Done |
| 9 | Remove "+ Add rep" from the chatting preferences step (reps only created in Your team; an "Edit your team" link instead). The block's "+ rep" chip stays, assigning existing reps only | Done |
| 10 | No pixel font (Pix32): Figtree everywhere | Done |
| 3 | Shortlist capped at the sponsor's number of hacker seats (from their preferences), not 40 | Done |
| 4 | Explain the flow at the top: 1 Shortlist hackers here · 2 Scan hackers at your booth Friday night · 3 Submit your shortlist by 9:30 PM or earlier; otherwise at 9:30 PM we assign hackers who requested coffee chats with you | Done |
| 5 | Views: Shortlisted / Not shortlisted (plus everyone) | Done |
| 6 | Shortlist one hacker at a time (swipe or tap Shortlist / Skip) as the default, with a list view to review | Done |
| 7 | Every hacker card shows all sources: résumé, LinkedIn, GitHub, website (application "other link"), Devpost; one "Open profile" button opens them together (see popup note) | Done |
| 2 | SUPERSEDED by row 11 (fixed sessions). Was: chat blocks edited inline per `hackwestern-coffee-prefs/docs/specs/inline-chat-block-editing.md`: drag edges/move for time (times shown above edges), reps as avatar circles + "+ rep", "15 min \| 30 min" pill, −/+ stepper labelled "1-on-1" / "group of N" (max 5 hackers, 6 people), live "N chats · N hackers", trash; dashed lines per chat; resting one-line summary vs selected two-line controls (row grows); narrow blocks get an attached strip under the block; keyboard support. No popup or modal | Done |

## Default style for every mock (Jazz, 2026-11-19)
Use the look of `sponsor-portal-flow-hacker-v1/index.html#today` (the hacker /live site style; its README lists every source file:line) for ALL mocks, unless Jazz explicitly names another look for that mock. Current exception: `organizer-coffee-autofill-v6a/b/c` build on autofill-v5's look because Jazz asked for that explicitly.

## Sponsor portal v5: `sponsor-portal-flow-hacker-v5` (latest final)
| # | Change | Status |
|---|---|---|
| 1 | Copy of v4 with every v4 change | Done |
| 3 | Shortlist capped at the sponsor's number of hacker seats (from their preferences), not 40 | Done |
| 4 | Explain the flow at the top: 1 Shortlist hackers here · 2 Scan hackers at your booth Friday night · 3 Submit your shortlist by 9:30 PM or earlier; otherwise at 9:30 PM we assign hackers who requested coffee chats with you | Done |
| 5 | Views: Shortlisted / Not shortlisted (plus everyone) | Done |
| 6 | Shortlist one hacker at a time (swipe or tap Shortlist / Skip) as the default, with a list view to review | Done |
| 7 | Every hacker card shows all sources: résumé, LinkedIn, GitHub, website (application "other link"), Devpost; one "Open profile" button opens them together (see popup note) | Done |
| 2 | Chat blocks edited inline per `hackwestern-coffee-prefs/docs/specs/inline-chat-block-editing.md`: drag edges/move for time (times shown above edges), reps as avatar circles + "+ rep", "15 min \| 30 min" pill, −/+ stepper labelled "1-on-1" / "group of N" (max 5 hackers, 6 people), live "N chats · N hackers", trash; dashed lines per chat; resting one-line summary vs selected two-line controls (row grows); narrow blocks get an attached strip under the block; keyboard support. No popup or modal | Done |

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
| 10 | No deadline or auto-submit text shown to sponsors (they fill preferences at the Fri 5 PM workshop); invites still go out Fri evening; for team + preferences + optional shortlist; auto-submit at the deadline; scanned hackers are first choice; all invites sent Friday night; Saturday scans only fill open seats | Building |
| 12 | Remove all chatting-hours displays (hours meter, "Counts as hours" row, hours in Confirm/Today) | Building |
| 13 | Labels "Number of chats" and "Number of hackers" | Building |
| 14 | Remove the "Hacker demand" row | Building |
| 15 | Workshop row labelled "Your workshop"; 15-min zones before/after as a wavy pattern "Buffer · travel time" (still no chats there) | Building |
| 16 | Remove Review & submit. Flow: Your team → Chatting preferences ("Submit preferences") → Shortlist (optional, "Submit shortlist") | Building |
| 17 | Shortlist cards show each hacker's website link | Building |
| 11 | Map works exactly like the hacker live site map (pinch / ⌘-Ctrl + scroll zoom, drag to move, same buttons and text) | Building |

## In the real app (build)
| # | What | Status |
|---|---|---|
| 1 | Organizer Coffee chats tab replaced by the v8 board (algorithm + tests, migration 0058, tRPC router, UI, Help), worktree coffee-prefs, not pushed | Building |
| 2 | Follow-ups: sponsor preferences flow (v5), hacker invites from the new schedule, Coffee Chat Setup tab columns for sessions | Not yet |

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

## Organizer "My sponsors" v2: `organizer-my-sponsors-v2` (tables, not cards)
| # | Change | Status |
|---|---|---|
| 1 | No cards (Jazz hates them): everything as restyle-v2-style tables; no Set up / Coffee chats / Judging switch | Done |
| 2 | "Now" table at the top merges Happening now + Your next tasks: help requests, overdue tasks, now, next 3 | Done |
| 3 | Sponsor tabs with logos + "All sponsors"; a selected sponsor = one table of everything across Fri / Sat / Sun with actions | Done |
| 4 | "Sponsor requested help" flow: I'm on it → "Noah is on it" → Resolved; 5-min escalation; Help text updated | Done |

## Organizer "My sponsors": `organizer-my-sponsors-v1`
| # | Change | Status |
|---|---|---|
| 1 | Each HW lead logs in and lands on "My sponsors" (their sponsors only); "All sponsors" = restyle-v2 tables as a second tab | Done |
| 2 | One card per sponsor: logo, booth, crowned primary contact with Text/Call (fixed position), "Right now" checklist with one-tap actions, "Your jobs for them" from the run of show, coffee chat and judging status lines, needs attention | Done |
| 3 | "Your next tasks" at the top (overdue first) | Done |
| 4 | On call = covering all sponsors (banner); lead with no sponsors = empty state | Done |
| 5 | Build need: HW Contacts gets an email column to match logins to leads | Done in the sheet (column C "Login email"); app code in the build |
| 6 | Always-visible "Help" top right → "How it works" sheet (Sponsors · Coffee chats · Judging · Task pings · Where data lives), content from `_data/organizer-help.md` incl. the auto-schedule checks | Done |

## Organizer coffee board v8: `organizer-coffee-v8` (Jazz likes v7)
| # | Change | Status |
|---|---|---|
| 1 | "Needs a fix" → "Suggested fixes": problem → why → suggested fix → [Apply fix] [Contact] | Done |
| 2 | Real scheduling algorithm in the mock (pure function, described in README) producing the schedule and the fixes; NEVER overlaps the sponsor's own workshop + 15-min buffers (also on drags and applied fixes), checked by asserts | Done |
| 3 | Extra bottom row "Workshops": which company's workshop is on in each session | Done |
| 4 | Action buttons in one fixed position on every row (no wrapping) | Done |
| 5 | Crown icon instead of "Main contact" | Done |
| 6 | Status chips with counts, e.g. "Needs scheduling · 1 of 3" | Done |
| 7 | One-line legend "■ Scheduled (room) · ✓ Free · ▨ Their event" above the availability grid; cells show "Rm 2243" | Done |
| 8 | Company logos instead of names | Done |
| 9 | Always-visible "Help" → "How coffee chats work" (same text as `_data/organizer-help.md`; schedule() must match the checklist) | Done |

## Organizer coffee board v7: `organizer-coffee-v7` (from the audit + fixed sessions)
| # | Change | Status |
|---|---|---|
| 1 | One screen, three bands: Sponsors (status + Contact), Needs a fix (one sentence + one action), Rooms (8 rooms × 6 sessions grid) | Done |
| 2 | "Auto-schedule" from availability (hours per rep, near rooms first, then Ivey) → one "Send confirmed schedules & invites" | Done |
| 3 | Sponsor tap shows only their availability grid, hackers per chat, hours per rep, phones (inline, no drawer) | Done |
| 4 | Removed: legends, instructions, seat counts, hours, shortlist/hacker ID tables, per-sponsor sends | Done |
| 5 | Hacker-v1 look, Figtree only | Done |

## Organizer dashboard restyle v2: `organizer-dashboard-restyle-v2` (Jazz loves v1's look)
| # | Change | Status |
|---|---|---|
| 1 | Fri/Sat/Sun → three tables: Set up, Coffee chatting, Judging (columns as proposed 2026-11-19) | Done |
| 2 | Remove "Workshop live" status; add "Attended coffee chat workshop" (Set up) | Done |
| 3 | Coffee chatting columns: Submitted preferences, Submitted shortlist, Assigned coffee chats, Invites | Done |
| 4 | Digital-only sponsors at the bottom of each table, collapsible | Done |
| 5 | Remove the sponsor expand/detail panel | Done |
| 6 | Remove the "Organizers" checkbox on Run of show | Done |
| 7 | Figtree only, no pixel font | Done |
| 9 | Task pings: "Needs you now" (overdue tasks with Text / Mark done; "All clear" when empty) → "Now and next" (sponsor items now + next 3 tasks with owners, no duplicates) → "Done today (n)" collapsed → Ping log collapsed. Removed: subtitle, Slack routing paragraph (→ "?" tooltip), "Handed to Slack" badges (only failures shown), ping log caveat, hackathon-wide events | Done |
| 8 | Set up: "Coffee chat workshop" shows who attended (rep / primary); new "Their workshop" column (time · room · HW lead setup) | Done |

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
| 1 | Score is a scrollable 1–10 in 0.5 steps, like Holia's judging UX | Done |
| 2 | "Rubric" button opens Holia's (latest) rubric as a modal | Done |
| 3 | Three ways through the Devposts: one at a time, 5 at a time, quick pass (swipe Yes/Maybe/No) | Done |
| 4 | Several reps on one account: "Who's judging?", list split between reps, scores show who gave them, disagreement flag, live updates | Done |

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
- Sponsor portal Help screen for the tracked help flow ("Get help" → "Noah is on the way").
- Sponsor v5: block Sun Life's 1–2 session (overlaps the 1:45 travel buffer before workshop setup) so the sponsor page matches the organizer rule (pending Jazz's OK)
- Judging (sponsor + organizer): show every team as team ID + Devpost link; digital top 5 entered by pasting Devpost links (app matches to team, shows name + ID to confirm) (decision 2026-11-19). Sponsor judging redesigns A/B/C show IDs only.
- Organizer Sponsor judging: a "Digital sponsors" section where the spon team enters a digital sponsor's 1st–5th place (PCBWay today), filling the Sponsor Judging tab (decision 2026-11-19). Organizer redesigns A/B/C show judging as WIP, so this goes into the judging build.
- Organizer Sponsors: digital sponsors grouped and greyed, no portal link (sheet already done)
- Sponsor Help (hacker-v3 → needs a v4): "Text <lead> (your contact)" as the main action with a drafted text + Call; if the lead is off shift (from the Spon Team schedule), "Leave a message" → Slack post @mentioning whoever's on call; "Send to the whole sponsor team" as a small backup link; one line "Help desk: by the stairs outside the Grand Hall" (decision 2026-11-19)
- Organizer Pings: "Text" button on overdue tasks (opens Messages with a drafted reminder); automatic pings stay on Slack
- Organizer home table bug: `/internal/sponsors` is blank below the filter pills at phone width (live app; fix in the build)
- Sun Life's booth spot must match `src/lib/sponsor-bay-layout.ts` everywhere (hacker-v3 is fixing)

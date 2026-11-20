# Organizer judging room board, v2

This is v1 with Jazz's changes and every point from the design critique. The look is the same as v1 and coffee board v12: same tokens, Figtree only, fake data with 555 numbers.

Open `index.html` as a file, or go to http://127.0.0.1:3040/mocks/organizer-judging-board-v2/index.html. To run the checks and take screenshots, run `node mocks/organizer-judging-board-v2/verify.mjs` from the repo root. Screenshots go to `screens/` at 1280x800 and 390x844.

## What changed from v1

1. **No suggested fixes.** The scheduler places each sponsor's teams so that every team's talks are at least 10 minutes apart, across all rooms and the remote list. Clashes can't happen, so the Suggested fixes card, Apply buttons, "Swap T-017" fixes, clash chips and clash cells are gone. So are Auto-assign, Re-run and the sticky bar.
   - The only warnings are "Text lead" ones, for things a sponsor's lead has to fix: "Sun Life's shortlist isn't in · Text Daniel (lead) · 555-0101", then Copy and Text (an `sms:` link with a drafted message). At 10:30 it's "Canada Life has no scores yet", and at 12:05 "Canada Life's top 5 isn't in". After you tap Text, the warning stays (the problem isn't fixed yet) and shows "Texted 9:20 AM".
2. **Just 3 rooms:** Rm 2230, Rm 2235 and Rm 2110. "+ Add a room" is gone. Each in-person sponsor row has a room select with Rm 2230, Rm 2235, Rm 2110 and "Other…". Other opens a text box right there.
   - The run of show sets the defaults: Scotiabank Rm 2110, Canada Life Rm 2230, QNX Rm 2235. Sun Life starts unset on "Set a room" (amber).
   - A taken room reads "Rm 2230 · Canada Life" and can't be picked. Other covers the 4th sponsor. Typing a taken room into Other is refused ("Rm 2230 is Canada Life's. Pick another.").
   - TinyFish reads "Remote (judges online)" and has no select.
3. **Clicking a team opens a modal** (a bottom sheet on phones). It shows:
   - the project name (large) and the team ID (small)
   - Devpost and GitHub as 44px icon buttons with aria-labels
   - attendance: "Confirmed: 1 of 4 members checked in" in green, or "No one from this team has confirmed" in amber
   - the 4 members: name, check-in, school, program, year, role, and only the link icons they have (LinkedIn, GitHub, résumé, website)
   - "Presents to": each sponsor with its time and room, like "QNX 10:00 · Rm 2235" and "Canada Life 10:18 · Rm 2230", plus "18 min apart" and whether the team has been told
   - "Scores so far": the average and how many reps scored, or "Presents at 10:18" / "Not scored yet"

### From the critique

- **Names in the grid.** Cells show the project name, with the team ID small underneath (and the full name on hover).
- **Empty slots are blank.** No "Open" boxes. The calendar now runs times down the side and rooms across, so names have room. It stops at the last used slot.
- **2 sponsors marker.** A team on two shortlists gets a small "2 sponsors" tag in both cells, and the modal lists both times.
- **Legend:** Told their time (solid), Not told yet (dashed), Presenting now (amber), Presented (grey), Remote (striped), 2 sponsors tag.
- **Notify is a to-do.** "28 teams haven't been told their times · Notify teams" (primary button). After you press it: "All teams notified · 9:20 AM" (the mock clock's time). Changing a sponsor's room after that brings the to-do back for its teams. Sun Life's shortlist arriving does the same.
- **Quiet sponsor list.** Each row says one thing: "9 teams · 3 reps judging", "5 of 9 scored", "Top 5 in", or one amber problem ("Shortlist isn't in", "No scores yet", "Top 5 late"). "Room set", Contact buttons and "Profiles: 3 reps" are gone. Phone numbers only show in the Text lead warning and in an expanded row.
- **Problem and fix together.** "Sun Life needs a room" has its room select inside the to-do, and the same select sits in Sun Life's row.
- **One Calendar / Schedule switch,** in the Rooms card header. The "Schedule first" layout variant is gone.
- **Move to** (tap a room's header in the calendar) only offers the other 2 of the 3 rooms. A taken room swaps the two sponsors.
- **9:20 opens on the to-dos:** Sun Life's shortlist (Text lead), Sun Life's room, then Notify teams. All three fit on screen at 1280x800 and 390x844 without scrolling.

### Also new

- **PCBWay** (digital) sits under "Digital" with "Enter top 5". It opens 5 boxes for Devpost links. Each link is matched to its team ("AgentDesk · T-012"), and Save needs 5 different matching teams. After 12:00 an unentered top 5 is a to-do.
- **Mock panel** is a small "Mock · Sun 9:20 AM" button at the bottom right, so it doesn't push the to-dos down. It has the times (9:20 AM, 10:30 AM, 12:05 PM), "Sun Life sends its shortlist" and Reset. Jumping to 10:30 or later without notifying marks teams as told at 9:25 AM so the day can run.

## Fake data

| Sponsor | Mode | Shortlist | Reps | Room |
|---|---|---|---|---|
| Scotiabank | in person | 9 teams | 3 | Rm 2110 |
| Canada Life | in person | 7 teams | 2 | Rm 2230 |
| QNX | in person | 10 teams | 1 | Rm 2235 |
| Sun Life | in person | not in (7 teams with the mock button) | 2 | unset |
| TinyFish | remote | 6 teams | 2 | Remote (judges online) |
| PCBWay | digital | Devpost only | none | none |

- 4 teams are on two lists: T-017 (Canada Life, QNX), T-029 (Scotiabank, Canada Life), T-030 and T-042 (Scotiabank, QNX). That's 32 slots and 28 different teams. When Sun Life sends, T-047 (QNX, Sun Life) is a 5th.
- Project names, members, schools and links are invented. Links go to fake Devpost, GitHub, LinkedIn and example.com addresses.
- T-017 PillPal has 1 of 4 checked in (the brief's example). T-021, T-044 and T-062 have nobody checked in.
- Scores follow the clock as in v1. Canada Life has no scores at 10:30 and no top 5 at 12:05. Scotiabank, QNX and TinyFish have their top 5 in by 12:05.

## Checks

`verify.mjs` runs 133 checks over both sizes, and all pass. Besides fonts, sideways scroll and page errors, it checks:
- no Suggested fixes, Apply, Swap, clash or Add a room UI anywhere
- exactly 3 rooms with the run-of-show defaults, Sun Life on "Set a room", taken rooms named and disabled, Other… with a text box
- no team presents twice within 10 minutes, at the start, after Sun Life's late shortlist and at 10:30
- grid cells show project names, empty slots are blank, T-017 has the "2 sponsors" tag
- the to-dos come first and in order at 9:20, and all three are on screen
- the modal: name and ID sizes, 44px Devpost and GitHub buttons, attendance (green and amber), 4 members with labelled links, both times, scores
- Move to offers only the 3 rooms, there's one view switch, and the legend covers every style
- 10:30 and 12:05 to-dos, Top 5 in, and PCBWay's top 5 entry

Screenshots: `01-overview-0920` (and `-full`), `02-team-modal`, `03-room-select-other`, `04-schedule`, `05-1030` (and `-rooms`), `06-1205` (and `-pcbway`).

## Guesses

- **The 10 minute rule.** I read it as slot starts at least 10 minutes apart. With 6-minute slots, a team skips at least one slot between talks.
- **Late shortlists.** Times already set never move. Sun Life's teams fit around them, so nobody already told gets a new time.
- **Teams on a list without a room** can't be told yet. They show under a "No room yet" column and don't count toward "teams haven't been told".
- **Sun Life's lead is Daniel W.** (555-0101), from the brief. v1 had Daniel as the HW lead. v2 drops HW leads, since phones now only show for the sponsor's own lead and reps.
- **Phone format** is "555-0101" as in the brief. Text uses +1 519.
- **After 11:30** the shortlist and room to-dos go away, and Sun Life's row reads "No shortlist: missed round 1".
- **Other rooms** show as their own column (for example Rm 3100) next to the 3 standard rooms.

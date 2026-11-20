# Organizer judging room board, v1

This mocks the organizer Judging tab from `docs/specs/judging-room-board.md` in the coffee-prefs worktree. It uses the same UX, CSS and structure as `organizer-coffee-v8`: the Sponsors band and Suggested fixes on the left, the Rooms card on the right, inline detail under the grid, and a sticky bar. Figtree is the only font, and there's no pixel font.

Open `index.html` as a file, or go to http://127.0.0.1:3040/mocks/organizer-judging-board-v1/index.html. To run the checks and screenshots, run `node mocks/organizer-judging-board-v1/verify.mjs` from the repo root. Screenshots go to `screens/` at 1280x800 and 390x844.

## What's shown

- **Sponsors band.** Each in-person or remote prize-track sponsor gets a row with:
  - a logo placeholder (initials in a dashed box) and the name in text
  - a status chip: Shortlist not sent, Needs a room, Room set, Scheduled, Judging or Top 5 in
  - problem flags, shown separately: Clash: T-017, Due 9:30 AM / Shortlist late, No scores yet, Top 5 late, plus a grey "Lead texted 9:20 AM"
  - a line that reads "Shortlist: 14 teams · Profiles: 3 reps · Rm 2230"

  Opening a row shows the reps (judged N each), the ranked top 5 once it's in, and every team with its slot, Devpost link and score pills. Contact opens phone numbers with Copy, Text and Call, as in v8. PCBWay is listed separately under "Digital: Devpost entry only".
- **Suggested fixes.** Each fix follows problem → why → Suggested → [Apply fix] [Contact]. Fixes are recomputed from the board on every render, and Apply changes the board:
  - "4 sponsors, 3 rooms" → Add a room. This adds Rm 2240.
  - "QNX has no room" / "Sun Life has no room" → Put in Rm 2235. These show only while a room is free.
  - "T-017 presents to QNX at 10:12 and Canada Life at 10:18 (needs 10 min)" → Swap T-017's QNX slot. This swaps T-017 to 10:06 with T-008, and only takes a swap that creates no new clash.
  - "Sun Life hasn't sent its shortlist" → Text their lead (copy phone). This copies the number and marks the lead as texted.
  - At 10:30: "Canada Life has no reps judging yet" → Text their lead.
  - At 12:05: "Canada Life's top 5 isn't in" → Text their lead.
- **Calendar view.** Rooms run down the side, and 10:00–11:24 runs across in 15 six-minute ticks. The current tick is marked.
  - Each held room shows its sponsor in the room cell and a team ID in each slot. Slots are shaded as done, presenting now or a clash.
  - Tapping an empty room (or "Assign a sponsor") lists the four in-person sponsors. Roomless sponsors come first; the others say "now in Rm X, moves here".
  - Tapping a held room or a slot shows the sponsor, the team, "Move to" (free rooms) and "Remove from room".
  - TinyFish has its own "Remote (judges online)" row and no room.
  - "+ Add a room" opens a small form with a name and optional seats, then adds a row.
  - Sponsors still without a room are listed under the grid.
- **Schedule view.** Each room lists its teams in order: the time, the team ID with a Devpost link, and pills (Not notified / Notified / Presenting now / Presented / Scored by 2 of 3 reps / Clash). Empty rooms have an Assign button.
- **Sticky bar.** The flow is Auto-assign → (fixes open + Re-run) → Schedule presentations → "Teams notified 9:20 AM". If a room or slot changes after that, the bar names the sponsors that changed and offers Schedule presentations again.
  - Auto-assign keeps pinned rooms: the sheet seed and manual moves.
  - It then fills free rooms one sponsor per room, most teams first.
- **Help.** This is the same sheet as v8 with the judging rules.

## Mock controls ("Mock only" panel)

- **Time:** Sun 9:20 AM, 10:30 AM, 12:05 PM. Jumping to 10:30 or later auto-assigns and schedules if you haven't yet, so the day can run.
- **Layout:** Calendar first, or Schedule first.
- **Sun Life sends its shortlist:** gives Sun Life 7 teams.
- **Reset:** reloads the page.

## Variants

- **A, Calendar first (default):** the toggle reads Calendar | Schedule, and the calendar shows on load.
- **B, Schedule first:** the toggle reads Schedule | Calendar, and the schedule is the default view. On phones the Rooms card also moves above the Sponsors band, so the schedule is the first thing you see.

## Fake data

| Sponsor | Mode | Shortlist | Reps | Starting room |
|---|---|---|---|---|
| Scotiabank | in person | 14 teams | 3 | Rm 2230 (from the sheet) |
| Canada Life | in person | 9 teams | 2 | Rm 2110 (from the sheet) |
| QNX | in person | 15 teams | 1 | none: Auto-assign puts it in Rm 2235 |
| Sun Life | in person | not sent (7 teams via the mock button) | 2 | none |
| TinyFish | remote | 6 teams | 2 | Remote (judges online) |
| PCBWay | digital | Devpost only | – | – |

- Team IDs look like T-042, and Devpost links go to `devpost.com/software/hw13-t042` (fake).
- T-017 is on both the QNX and Canada Life lists, 6 minutes apart.
- T-030, T-042 and T-047 are on two lists but far enough apart that they don't clash.
- Phone numbers are 555 numbers.
- Scores are invented from the clock:
  - At 10:30, Scotiabank's and TinyFish's past slots are scored by most reps, QNX's by its one rep, and Canada Life's by nobody.
  - At 12:05, Scotiabank, QNX and TinyFish are "Top 5 in", and Canada Life is late.

## Guesses

- **The clash rule.** "Needs 10 min" is read as slot starts at least 10 minutes apart.
- **Fixes before Auto-assign.** The spec's fixes can't all be true on one board with 3 rooms. "Sun Life has no room → Put in Rm 2235" needs Rm 2235 free, which means QNX is roomless too. So fixes show from the seeded board before Auto-assign, and both QNX and Sun Life are offered Rm 2235. After Auto-assign, QNX takes it. Once you add a room, Sun Life is offered that room (Rm 2240).
- **Who "their lead" is.** It's the sponsor's own lead contact (Dana W. for Sun Life). Contact also lists the HW lead.
- **The Add a room fix.** It adds "Rm 2240" right away instead of opening the form. The "+ Add a room" row opens the form.
- **Default seats.** The three default rooms have no seat count. Seats only show when you enter them.
- **Remote status.** Before scheduling, TinyFish's chip reads "Room set".
- **The date.** Sunday is Nov 22.

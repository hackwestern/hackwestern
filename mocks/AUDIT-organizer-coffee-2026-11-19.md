# Audit: organizer coffee chat boards v6a / v6b / v6c (2026-11-19)

Judged against the organizer's three jobs: (1) before Fri 9:30 PM see who hasn't submitted and contact them; (2) 9:30–10 PM run auto-fill, fix the few problems, send ALL invites by 10 PM; (3) Saturday handle exceptions only (room problem, last-minute room, contact).

## Why it feels messy
1. Every sponsor detail is on the board (team, own Saturday, shortlist + Met at Hacker Fair tables with hacker IDs, seat-by-seat rows). One opened sponsor is ~3,400 px tall; v6b "Expand all" at 390 px is ~17,000 px.
2. Sponsors appear twice (rooms grid + sponsor list/timeline) and must be compared; v6c draws a second full time grid.
3. Sending is per sponsor, but the job is one send ("Send for all" is a small link in v6b/v6c, missing in v6a).
4. Legend (4–7 chips) and an instruction paragraph before the work.
5. Too many numbers nobody acts on (seats/booked/waiting/open, hours used, rooms at busiest time).
6. One warning shown three ways (bar, chip, amber block).
7. Desktop-only controls (drag handles, Re-run/Discard, Request change) on phones; v6c needs sideways scroll across two grids.

## Keep / on demand / remove
- Keep: status word; ONE "Needs a fix" list; rooms grid with Near / Ivey groups; one "Send all"; one "Book a room".
- On demand: Contact (phones only), per-sponsor send (inside the sponsor), Edit booking / Request change (tap a block), flexibility (inside a fix), hacker names per seat.
- Remove: legend, instruction paragraph, "leave the Sponsor Bay by…", hours used, seat counts, shortlist/Met at Hacker Fair/hacker-ID tables, waiting list, emails, their own Saturday hatching, rooms at busiest time, notes, planning-room labels, status tabs, Expand/Collapse all, "Keep rooms on screen", the "Asked for" timeline, per-sponsor auto-fill/discard.

## Best base
v6b (row list), with v6a's phone room list and warning bars.

## Minimal design (one screen, three bands)
```
Coffee chats            [Book a room]
5 of 7 sponsors ready          (job 1)
 Commure   Not submitted  [Contact]
Needs a fix (2)              (job 2/3)
 ! Canada Life placed 10:30, asked 10:00  [Move back] [Contact]
[ Run auto-fill ] → [ Send all 38 ]
Rooms  ▸ Near 2241–2243  ▸ Ivey 1348–1358 · 15 min walk
```
Tap a sponsor: phones + their blocks. Tap a block: Edit / Request change. Desktop: same bands, rooms as a full-width draggable grid on the right, lists in a narrow left column.

## Data bugs in the mocks
- v6c: CSE "Sent" while "1 couldn't be placed".
- v6a: "last saved" times on Friday afternoon don't fit the 9:30 PM timeline.

## Note (Claude)
If sponsors give AVAILABILITY instead of exact preferences (proposed 2026-11-19), "Not the time they asked" / "outside their plan" fixes disappear entirely: every placement is inside time they said they're free.

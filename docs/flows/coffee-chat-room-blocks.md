# Coffee chat rooms: one concept, the room block (Jazz, 2026-11-18)

The room dialog mixed three ideas (whole-day sponsor room, booking a hacker,
holding a room). Replace them with one.

## The model
- A **room block** = one sponsor in one room for a stretch of time.
- Hackers are added **into** a block.
- A sponsor can have any number of blocks, any room, different times.
- Two sponsors can never overlap the same room at the same time.
- A hacker chat always goes into the sponsor's block covering that time.
  No block at that time = the offer says "Ask the sponsor team for a room at
  this time". A chat never lands in a room by itself.
- The per-sponsor whole-day room goes away (a whole day is one long block).
  Sheet rooms may pre-fill blocks once.
- Built on the existing `coffee_chat_hold` table.

## Chat type decides how many hackers a slot needs
Each sponsor has a chat type from the sheet (e.g. "1-on-1, 15 min" or
"Group of 3, 30 min") and a rep count.
- A slot in a block shows **hackers booked / hackers that chat needs**:
  a 1-on-1 slot shows `0/1`, a group-of-3 slot shows `0/3`. Not `1/6`.
- The room's 6-person limit (hackers + reps) stays a server check and only
  shows up as a warning when it would be broken.
- "Needs a hacker" = a slot in a block with fewer hackers than the chat needs.

## Free cell dialog
```
Rm 2243 · 9:00 AM · Free
Sponsor  [ CSE ▾ ]   (shows: 1-on-1 · 15 min · 1 rep)
Length   [ 15 min | 30 min | 45 min | 1 hour | 1 hr 15 | 1 hr 30 ]
                                        [ Give room ]
```

## Block dialog
```
Rm 2243 · 9:00-10:00 AM · CSE · 1-on-1, 15 min
9:00   (photo) Alex D. · Accepted    1/1
9:15   Needs a hacker                0/1   [ + Add a hacker ]
...
[ Change length ]   [ Release room ]
```

## Coffee chats tab
- Per-sponsor strip above the room table (logo, chat type, reps, blocks,
  hackers booked / needed). No legend (removed).

## Sponsor side
- Each block shows "Rm 2243 · 9:00-10:00 · 1 of 4 chats filled", with
  "Pick from candidates" and "Scan a badge" for the open slots.

# Coffee chats: sponsor requests, rooms given to sponsors, one view (Jazz, 2026-11-18, v2)

v1 (parked in `_to_delete/coffee-chat-room-blocks.v1.md`) computed hackers per
slot from chat type x reps and kept a 6-person room cap. Jazz: that doesn't
match how the day runs. This replaces it.

## How it really works
- **Sponsors request chats.** Each sponsor tells us, in their portal, how they
  want to run them. Two options:
  1. **1-on-1 chats:** "We have N reps doing 1-on-1 chats." Hackers per slot = N.
  2. **One group chat:** "We want one group chat with M hackers." Hackers per
     slot = M, whatever the rep count.
  Plus the chat length (from the sheet's FORMAT, e.g. 15 or 30 min) and the
  hours they're available (sheet's AVAILABILITY START/END).
- **Reps can change.** Sponsors can ask for **fewer hackers for a given slot
  or hour** (e.g. a rep leaves at 11). That override lives in the sponsor
  view and shows to organizers.
- **Rooms are assigned sponsors, not sponsors rooms.** Organizers give a room
  to a sponsor for a stretch of time (a room block, `coffee_chat_hold`). A
  sponsor can be in different rooms at different times. No per-sponsor room.
- **No room capacity.** Reps organize themselves in the room. Remove the
  6-person limit everywhere (UI and server). The only count is hackers booked
  vs hackers the sponsor asked for.
- Defaults before a sponsor answers: from the sheet ("Individual" -> 1-on-1
  with the rep count in NOTES, else 1; "Groups ... with 3 people" -> one group
  of 3). Organizers can edit a sponsor's request for them.

## Organizer Coffee chats tab: ONE view
Replace the three views (Rooms | By sponsor | List) with one grid:
- Columns = rooms (Rm 2241, 2242, 2243), rows = time. Each room block is the
  sponsor's **logo only** (no name text; accessible name on the element),
  tinted in the sponsor's colour, with a one-line request summary:
  `1-on-1 · 3 reps · 2/3` or `Group · 4 hackers · 1/4`.
- Each slot in a block shows booked/asked (e.g. `2/3`), "Needs 1 hacker", or
  `Full`. A slot where the sponsor asked for fewer shows the lower number with
  a small "asked for 2" note.
- The **By sponsor** information moves into this view: a sponsor strip above
  the grid (logo, request summary, available hours, hackers booked / asked
  for the day). Picking a sponsor in the strip highlights their blocks across
  rooms and dims the rest. No separate table.
- The **List** functionality moves into the view too: clicking a block opens
  the block dialog with every slot's hackers (photo, name, status) and the
  actions (+ Add a hacker, cancel/move a chat, Change length, Release room).
  The separate list view is removed.
- Free cell: "Give room" -> pick sponsor + length (15 min, 30 min, 45 min,
  1 hour, 1 hr 15, 1 hr 30). Two sponsors can't share a room at the same time.
- No legend.

## Sponsor view (`/sponsors/<id>/coffee-chats`)
- **Your chat setup** card: pick 1-on-1 (N reps) or one group (M hackers),
  saved to us; shows the chat length and hours from the sheet.
- **Your rooms**: each block "Rm 2243 · 9:00-10:00 · 3 of 4 chats filled",
  with "Pick from candidates" / "Scan a badge" for open slots.
- **Fewer hackers for a time**: on any slot or hour, "Ask for fewer" lets them
  lower the count (down to 0 = no chat then). Organizers see it immediately.

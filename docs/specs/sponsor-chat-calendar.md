# Sponsor coffee chat calendar (spec, Jazz, 2026-11-19)

Decisions and the reasons for them are in `docs/decisions.md`, entry "2026-11-19: Sponsors plan coffee chats on one calendar".

## Summary
Sponsors plan all their chats on one calendar: named reps across the top, the day in 15-minute rows down the side. Each block is a rep (or reps) chatting for a stretch of time, and it carries its own chat length and hackers per chat. Chats, hacker seats and chatting hours update live as they edit.

This one screen replaces four old steps: Format, Chat length, Availability and Preview. The sponsor flow becomes:
1. Calendar: add reps and plan their blocks
2. Shortlist: pick hackers for the seats
3. Confirm

What goes away for sponsors:
- The word "availability" and the abstract block rules ("at least 1 hour", "blocks that overlap or touch merge into one")
- The paragraph explaining how hours are counted, replaced by the hours strip on the calendar
- Rooms. Organizers assign real rooms after the sponsor confirms.
- Unnamed reps ("Rep 3" to "Rep 8"). Only named reps exist and count.

## Layout
A header with live totals, then the calendar grid.

**Header**
- Title: "When is each rep chatting?"
- Hours meter: "2 of 3 h used", with a progress bar
- Totals: chats and hacker seats
- Legend with two items only: 1-on-1 and Group

**Calendar grid**
- Rows: Saturday 10:00 AM to 5:00 PM in 15-minute rows (28 rows). Time labels every 30 minutes; a fainter line on each quarter hour.
- Hours strip: a narrow column between the time labels and the first rep. It fills in wherever at least one rep has a block.
- Rep columns: one per named rep, name in the header. The last column is "+ Add rep".
- Empty cells stay blank. A "+" appears only on hover.

**Blocks**
- Colour by format: one colour for 1-on-1, another for group. Nothing else is colour-coded.
- Line 1: format and length, e.g. "1-on-1 · 15 min" or "Group of 3 · 30 min"
- Line 2: time range, chats and hackers, e.g. "10:00–11:00 · 4 chats · 4 hackers"
- Thin dividers between chats inside the block (a 1-hour block shows 4 slices at 15 min, 2 at 30 min)
- A block shared by several reps shows in each of their columns with "with Leo T." on it

**Small screens:** below about 600 px, one rep at a time with a rep switcher above the grid. Header and hours strip stay.

## Creating and editing blocks
Everything a sponsor can do by dragging, they can also do from the block panel (keyboard and touch).

| Action | How | Result |
|---|---|---|
| Create | Drag down an empty part of a rep's column | New block with the last settings used, or 1-on-1 · 15 min the first time |
| Create one chat | Click an empty cell | One-chat block at that time |
| Edit settings | Click a block | Opens the block panel |
| Resize | Drag the top or bottom edge | Snaps in steps of the block's chat length |
| Move | Drag the block | Snaps to 15 min; dropping in another column changes the rep |
| Copy to another rep | "Copy to…" in the panel | Same times and settings in that rep's column |
| Delete | Delete key, or trash in the panel | Removed, with an "Undo" toast |
| Undo | Ctrl/Cmd + Z | Reverses the last change |

**Block panel:** reps (one or more named reps; several = they sit together and run the same chats), chat length 15/30 toggle, hackers per chat (1 = 1-on-1, or a group size up to the room limit), start and end dropdowns in 15-minute steps, a live line "4 chats · 4 hackers", Delete.

**Adding a rep:** "+ Add rep" asks for a name (required), phone (optional, organizers use it to text or call the rep on the day) and email (optional). The new column appears at the end, empty.

## Rules
Time
1. Everything snaps to 15 minutes.
2. Blocks stay inside 10:00 AM to 5:00 PM. Dragging stops at the edges.
3. A block can start on any quarter hour.

Chat length
4. A chat is 15 or 30 minutes. Nothing else.
5. A block's length is a whole number of chats (30-minute chats: 30, 60, 90… minutes; resizing moves in 30-minute steps).
6. Switching a block from 15 to 30 minutes with an odd number of 15s: extend the end by 15 minutes if there's room; otherwise trim 15 minutes off the end and say so.
7. The shortest block is one chat.
8. Buffer: 30-minute chats run 25 min + 5 min break; 15-minute chats run back to back. (Suggested 2026-11-19, pending Jazz's OK.)

Hackers per chat
9. 1 hacker = 1-on-1. 2 or more = group.
10. A room holds 6 people, reps and hackers together, so hackers per chat is at most 6 minus the block's reps.

Reps
11. Only named reps exist. Unnamed reps don't appear and don't count.
12. A rep can't be in two blocks at once. A drop that would overlap is refused and the block snaps back.
13. Different reps can overlap freely (parallel chats).
14. A block with several reps is one set of chats; it counts once.
15. Two touching blocks for the same rep with identical settings merge. Any difference keeps them separate.
16. Removing a rep who has blocks asks first, then deletes their blocks. Shared blocks just drop that rep.

Package hours and length
17. Going over package hours is allowed and flagged. Organizers send the confirmations and can resize the time.
18. No minimum block length. A soft note recommends at least 1 hour.

## Counting
- Chats in a block = block minutes ÷ chat length
- Hacker seats in a block = chats × hackers per chat
- Chatting hours = total clock time covered by at least one block, across all reps. Parallel time counts once.
A shared block counts once for chats and seats.

**Worked example**

| Rep | Time | Format | Chat length | Chats | Hacker seats |
|---|---|---|---|---|---|
| Dana W. | 10:00–11:00 | 1-on-1 | 15 min | 4 | 4 |
| Marcus O. | 10:00–11:00 | 1-on-1 | 30 min | 2 | 2 |
| Priya S. + Leo T. | 1:00–2:00 | Group of 3 | 30 min | 2 | 6 |
| Total | | | | 8 | 12 |

Chatting hours: 10:00–11:00 and 1:00–2:00, so 2 of 3 h used. Dana and Marcus overlap, so their hour counts once.

## States and messages
| Situation | What shows | Copy |
|---|---|---|
| Prefilled from sponsor info | Info banner above the grid | "We filled this in from your sponsor info. Change anything that's out of date." |
| No reps yet | Empty grid with one button | "Add a rep to start planning." |
| Reps, no blocks | Hint in the first rep's column | "Drag down a rep's column to plan their chats." |
| Next with no blocks | Inline error by the button | "Add at least one block to continue." |
| Under or at package hours | Blue meter | "2 of 3 h used" |
| Over package hours | Amber meter, note under it | "3.5 of 3 h used. You're 30 min over your package. Trim a block, or organizers will follow up." |
| Drop overlaps the same rep | Snaps back, toast | "Dana already has chats then." |
| Length switch trims a block | Toast | "Shortened to 10:00–11:00 to fit 30-minute chats." |
| Block deleted | Toast with action | "Block deleted · Undo" |
| Removing a rep with blocks | Confirm dialog | "Remove Dana W.? This deletes 2 blocks." |

## Edge cases
- Editing after hackers are placed: if a change removes chats that already have hackers, warn first: "3 hackers are booked in chats you're removing."
- Editing after invites are sent: allowed (move or cancel chats), with a strong warning. Changes send hackers an update that needs reconfirming.
- Renaming a rep: their blocks follow them.
- Times are always the event's local time (Toronto).
- Organizers can still move bookings between rooms in their own view. Sponsors never see rooms.

## Data model
```
Block {
  id: string
  repIds: string[]          // one or more named reps
  start: "10:00"            // 15-minute steps, within 10:00–17:00
  end: "11:00"
  chatLength: 15 | 30
  hackersPerChat: number    // 1 = 1-on-1, 2+ = group
}

chats(block) = (end - start) / chatLength
seats(block) = chats(block) * hackersPerChat
hoursUsed    = length of the union of all block time ranges
```
The organizer dashboard reads the same blocks, so its labels use 15- or 30-minute chats too. StarTech's 20-minute chats need to change.

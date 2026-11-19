> Superseded (2026-11-19): see docs/specs/coffee-chat-sessions.md

# Inline chat block editing (Jazz, 2026-11-19)

Pattern: inline editing / direct manipulation. Chat blocks are edited inline, directly in the calendar. No popup or modal.

The block IS the editor:
- Time = the block's position and width on the timeline. Edit it by dragging the left/right edge handles (snaps one chat at a time) or moving the whole block. While selected or dragging, show the start and end times just above each edge.
- Everything else sits inside the block as small controls:
  - Reps: avatar circles for each rep in the block, plus a "+ rep" chip. Click an avatar to remove that rep.
  - Chat length: a two-option segmented pill, "15 min | 30 min".
  - Hackers per chat: a −/+ stepper whose label reads "1-on-1" at 1 and "group of N" above that (max 5 hackers, 6 people total).
  - A live total on the right: "10 chats · 10 hackers".
  - A trash icon to delete.
- Faint dashed lines inside the block mark each chat, so changing 15 to 30 min visibly halves the slices.

Two states:
- Resting: one line, read-only summary "[avatars] 30 min · group of 3 · 3 chats · 9 hackers". Truncates from the right if the block is narrow.
- Selected (click the block): the row grows taller so the block has room for two lines of controls (row 1: reps + delete, row 2: length, hackers, total). Other rows stay put. Click outside or press Esc to go back to resting.

Narrow blocks (too small for the controls, e.g. 30 min): when selected, the controls appear in a strip directly under the block, attached to it and the same width as the row, not a floating popup. It stays visually part of the block.

Keyboard: Tab into the block, arrow keys move it, Shift+arrows resize, Delete removes it. Every control is a real button with a label.

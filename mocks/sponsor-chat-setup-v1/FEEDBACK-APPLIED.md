# Sponsor chat setup v1: rules applied

Design system copied from sponsor-coffee-chats-v7: the same tokens, buttons, status marks, frame/tbl tables, participant identity, segmented control, sheet, toast, mock strip and header. Rules from v7's FEEDBACK.md: no rank numbers, few pills, hierarchy from type and spacing, and colour only where it means something (blue = action/selected, green = ok/sent/locked, amber = errors, warnings and the organizer note).

## Rules enforced in the UI
- **Event window, Sat 10:00 AM-5:00 PM:** times outside the window show as disabled "(closed)" options in the pickers.
- **Max 6 per room:** the hackers-per-chat picker only offers 1..(6 - reps per group). It shows the math, e.g. "2 reps + 4 hackers = 6 / 6". Raising reps per group lowers hackers per chat and explains why.
- **1-on-1:** 1 rep + 1 hacker. The hint says "Each 1-on-1 rep needs their own room".
- **Reps used across formats:** shown as "Reps used: X of Y". When over, submit is blocked and an error appears.
- **Chat length:** a 15 / 30 min segmented control. Block edges snap to the chosen length, and a note says so.
- **Availability blocks:**
  - Each block must be at least 1 hour. A shorter block gets an inline error and blocks submit.
  - Blocks that overlap or touch merge automatically, with a notice.
  - Each block can be limited to some reps (the default is all reps).
- **3-hour warning, does not block:** shown per block and per column when someone would chat more than 3 hours with no Off slot.
- **Allocated hours (3 h package):** a "X / 3 h used" meter appears in Availability and in the footer. Going over blocks submit with "You've requested 4 h; your package includes 3 h. Remove 1 h or contact organizers."
- **Slot preview:**
  - Cells start at the format's hacker count. Clicking a cell steps it down and then to Off.
  - Bulk actions: set a whole row or a whole column, and mark a lunch break.
  - Labelled as a preview, not a confirmed schedule, with total hacker seats shown.
- **Shortlist:**
  - Up to 40 hackers, in no particular order, and optional.
  - Search plus school, skill and role filters, with one-click Add / Remove.
  - Add is disabled once 40 are shortlisted.
  - A non-blocking note appears when the shortlist is larger than the seats offered.
  - Résumé link where the hacker has one.
- **Sticky footer:** a summary sentence, the first blocking issue with a "Show me" jump, and Submit.
- **Submit flow:** a confirm dialog ("You can edit until <deadline>"), then a read-only summary with "Edit preferences".
- **States:** Organizer note (with Reply) and Locked (read-only).

## Interpretations
- **How hours are counted:** clock time of the availability blocks, not per room or per rep. This is stated inline.
- **Groups and per-block reps:** a group only chats in a block when all of its reps are in that block.
- **The 3-hour warning:** it can only appear when a block runs past 3 hours, and with a 3 h package that is always over the allocation as well. So the "Over allocated hours" demo shows both messages.
- **Deadline:** "Thu Nov 19, 11:59 PM" is a placeholder, and the mock strip says so.

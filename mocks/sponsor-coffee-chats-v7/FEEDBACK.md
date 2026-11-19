# Feedback on sponsor coffee chats v6 (Jazz, 2026-11-18)

Applies to the sponsor coffee chat page (Shortlist, the hacker list, Your chats). This is Jazz's feedback in full, followed by the rules that override it.

## Overrides (Jazz's earlier decisions win where the feedback differs)
- **No ranking.** Never show "#1", "#4 of 40" or a Rank column. The feedback's table example has a Rank column; drop it. Sorting options must not include rank.
- **Primary action wording:** "Confirm Shortlist to Hack Western". Above it: "Due before Saturday <their first slot time> · You can't change it once you submit." It needs a confirm step, and the shortlist locks after confirming.
- **Sponsors don't manage seats.** Organizers assign hackers to chats. On "Your chats", the sponsor only reads: time, room, who, seats, and confirmed vs waiting. No invite, cancel or swap there.
- **Links:** résumé, plus GitHub and LinkedIn as logos. No portfolio.
- **Extras:** sponsors shortlist their seat count plus a few extras (the waiting list).
- **Manually selected:** hackers added at the booth. They can be outside the 40, and they get chats first.

## Feedback (verbatim)

The current UI feels overly vibe-coded. It looks visually polished at first glance, but a lot of the design decisions feel arbitrary rather than driven by a consistent design system or a clear understanding of the user's workflow. There are too many oversized elements, rounded containers, pills, badges, and competing visual treatments. Almost everything is emphasized, which means nothing really stands out. I want this to feel like a thoughtfully designed internal event-management product, not a generic AI-generated SaaS dashboard. The priority should be improving information hierarchy, reducing visual noise, establishing consistent patterns, and making the workflows feel intentional. Don't just change colors or border radii. Revisit the underlying layout and interaction design.

### 1. Establish a more cohesive design system
- Almost every element is in a rounded container (tabs, buttons, profile cards, status badges, participant chips, whole sections). Radii are excessive and inconsistent.
- Blue background, light-blue cards, white cards, blue pills and yellow highlights read as a generic dashboard. Shadows and borders are inconsistent. Typography is oversized (section headings, card numbers, participant names).
- Change: a consistent spacing scale, type scale, radius system and palette. Rounded containers only where grouping is genuinely needed. Show hierarchy with type, spacing and alignment, not cards. Fewer background colours. Yellow/gold only as a purposeful accent. Denser and more information-efficient, without feeling cramped. Clean, restrained, professional.

### 2. Shortlist page: simplify the hierarchy
- Too much at the top: title, description, tabs, a big summary container, a heading inside it, a seat-capacity explanation, a progress bar, another sentence, two action buttons, more copy, a divider, then another heading.
- Change:
  - Compact summary header showing number shortlisted, seats and backups together.
  - Remove redundant copy. The bar and the sentence say the same thing.
  - Primary action present but less dominant. Add a hacker and Scan a badge are secondary, placed near the list.
  - The participant list is the focus.
- Participant organization:
  - Keep "Met at your booth" vs "From interested hackers", but with the same row treatment. Manually selected is a subtle label.
  - Compact rows with consistent alignment, and the whole row clickable to open details.
  - An obvious remove/change control.
  - Clearly separate shortlisted, extras and confirmed. They are different states.

### 3. Hacker directory: improve information density
- Cards are enormous for the little they hold. Shrink height and padding. The name is primary. University, program and year go on one compact secondary line.
- Links small and secondary. Shortlist status is a consistent compact control. Shortlisted rows get a subtle selected state, not gold borders.
- Consider a table or compact list instead of cards. Columns: Participant | University | Program | Links | Shortlist (NO rank column, per the overrides).
- Search and filters aligned, with the selected filter consistent with the nav. Add sorting (university, program, shortlist status; NOT rank). The search field shouldn't be oversized. Shortlisted vs not must not rely on colour alone.

### 4. Your chats: redesign the schedule
- Participant chips look like buttons and are oversized. Schedule must show at a glance: time, who, seats occupied, confirmed vs waiting, open capacity.
- Small participant tokens, no big avatars in outlined boxes, a distinct consistent time column, structured row alignment, compact capacity like `2/3 seats`. Waiting must stay distinguishable without fading to near-invisible. Same participant styling as the shortlist and directory.
- Compact schedule header per room, e.g. **Room 2243** · Saturday · 10:00 AM–12:00 PM · 30-minute sessions, then a table:

| Time | Participants | Capacity |
|---|---|---|
| 10:00 | Chloe B. · Elodie B. · Grace H. | 3/3 |
| 10:30 | Diego L. (Waiting) · Mateo R. | 2/3 |

- Say whether waiting participants hold a seat or are only awaiting confirmation.

### 5. Consistency across all three pages
- Counts disagreed: 14 shortlisted on one page, 13 in the directory. Nav proportions differed between views. Cards, rows and chips were all styled differently, and so were statuses.
- Use shared components for:
  - participant identity (initials, name, university)
  - shortlist status
  - manual selection
  - waiting/confirmed
  - external links
  - seat capacity
  - nav and page header
- Drive every view from the same data, so counts never disagree.

### 6. Interaction design
Workflow: browse → review profiles → shortlist → add manually from booth → finalize shortlist → set up chats → review confirmations and waiting → changes when people can't attend.
- Immediate feedback on shortlist and remove, with undo for removal.
- Manual additions clearly marked.
- Confirmation before sending.
- External links consistent and visibly external.
- Organizer-side items (actionable waiting list, open capacity, draft vs final schedule) belong to the organizer mock, not this sponsor page.

### 7. Visual direction
Less decoration, more structure. Smaller secondary type. Compact cards and rows. Consistent spacing and alignment. Fewer pills and badges. Less reliance on background colour. Shared components. Clear primary vs secondary vs informational.

**Priorities, in order:**
1. Hierarchy
2. Density
3. Consistency
4. Workflow clarity (shortlisted, extra, confirmed and waiting are unambiguous)
5. Visual polish

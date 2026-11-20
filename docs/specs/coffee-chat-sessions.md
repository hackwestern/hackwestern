# Sponsor chat setup: blocks and availability spec

Nov 19, 2026 · Daniel Wang (pasted by Jazz). Reconciled with Jazz's choices in docs/decisions.md, 2026-11-19 "Coffee chats switch to fixed 1-hour sessions".

## Summary
Sponsors tell us three things: how many hackers per chat, when each rep is free, and about how long each rep wants to chat. Organizers pick the final chat times from that availability and send the sponsor a confirmed schedule. Anything unusual is handled by hand.

## Choice 1: hackers per chat
A row of buttons, 1 to 5. One size applies to all of the sponsor's chats. The default is 1.

| Pick | Format | Chat length | Chats per rep per hour | Hackers per rep per hour |
|---|---|---|---|---|
| 1 | 1-on-1 | 15 min | 4 | 4 |
| 1 + longer chats | 1-on-1 | 30 min | 2 | 2 |
| 2 to 5 | Group of 2 to 5 | 30 min | 2 | 2 × group size |

- A "Longer chats: 30 min instead of 15" checkbox appears only when 1 is picked.
- Sponsors never pick chat length directly. It follows from the size and the checkbox.
- A live line under the buttons sums it up, e.g. "Groups of 3 · 30 min · 6 hackers an hour per rep".
- The cap is 6 people a chat (1 rep + 5 hackers).
- Each slot includes changeover: a 30-minute slot is a 25-minute chat + 5 to switch; a 15-minute slot is 13 + 2. Hackers see the slot times; reps are told when to wrap up.

## Choice 2: when each rep is free
Availability, not a commitment. Organizers choose the final times from it.
- A grid of toggles: named reps down the side, sessions across the top.
- Sessions are fixed 1-hour slots set by organizers: 10–11, 11–12, 1–2, 2–3, 3–4, 4–5. Lunch (12–1) is left out.
- Every open session starts ticked for every rep: "Untick any time a rep isn't free."
- A "Your day" row above the reps shows the sponsor's own events, lined up with the sessions.
- A session that clashes with one of their events shows the event in the cell (e.g. "Your workshop 2:00–3:30") and can't be ticked. Partial overlaps are marked the same way, with the times.
- Each column header shows demand: "8 hackers free".
- Each rep's row ends with a count: "3 of 4 sessions".
- Only named reps. Removing a rep removes their ticks.

## Choice 3: how long each rep wants to chat
"About how many hours should each rep spend chatting?" with buttons 1 · 2 · 3 · 4+. One answer for the whole sponsor, required, no default.
- Organizers won't schedule a rep for more than this. 4+ means no cap.

## Counting
Until organizers confirm, totals are an estimate of the most they could get.
- Hours per rep = min(hours wanted, sessions that rep is free)
- Chats = total rep-hours × chats per rep per hour (4 at 15 min, 2 at 30 min)
- Hackers = chats × hackers per chat
- Shown as "Up to 6 chats · up to 18 hackers". No package hours.
Example: groups of 3, 2 hours per rep. Jasmine free 4 sessions → 2 h; Dana free 1 → 1 h. 3 rep-hours × 2 = up to 6 chats; 6 × 3 = up to 18 hackers.

Messages:
- "Marcus O. isn't free any time Saturday. Remove him?"
- "Dana W. is free for 1 hour, so that's the most we can schedule."
- "Tick at least one session to continue."

## Review and submit
1. Warnings, each with a link to fix it; none: "Everything checks out."
2. Read-only availability: reps as rows across 10 AM–5 PM, free sessions filled, own events grey.
3. Summary: "Groups of 3 · about 2 hours per rep · up to 18 hackers".
4. Team: main contact, then reps (name, phone, email, sessions free).
5. Shortlist.
6. Submit, with: "This is when your team is free. We'll confirm your final chat times by [date]."
After organizers pick times, the sponsor gets a confirmed schedule: the same grid with chosen sessions filled and the rest faded, plus final chat and hacker totals.

## For organizers
- Pick each sponsor's final sessions from their availability, up to each rep's hours wanted.
- Each chosen rep-session is one room for one hour.
- Send the confirmed schedule to the sponsor's main contact; hackers are invited after that.
- "Need something different? Message organizers" under the grid; handled by hand (shared chats, unusual times, mixed formats).
- Chats are 15 or 30 minutes only.

## Changes after invites
Allowed but strongly discouraged: warn "Invites are already out. Changing this will ask 12 hackers to confirm again, and some may drop off." Affected hackers get an update and must reconfirm. Organizers can resize or move sessions.

## What sponsors no longer do
Drag blocks or set start/end times; pick chat length separately; put several reps in one chat; see rooms; answer how flexible they are; track package hours.

## Data model
```
Sponsor { hackersPerChat: 1..5; longerOneOnOne: boolean; hoursPerRep: 1|2|3|4 (4 = 4+, no cap); mainContact: {name, phone}; reps: Rep[] }
Rep { id; name; phone; email?; freeSessions: SessionId[]; confirmedSessions: SessionId[] (subset, set by organizers) }
Session { id: "10-11", start: "10:00", end: "11:00" }
blockedSessions(sponsor) = sessions overlapping the sponsor's own events
chatLength = (hackersPerChat == 1 && !longerOneOnOne) ? 15 : 30
chatsPerSession = 60 / chatLength
repHours(rep) = hoursPerRep == 4 ? freeSessions.length : min(hoursPerRep, freeSessions.length)
maxChats = Σ repHours × chatsPerSession ; maxHackers = maxChats × hackersPerChat
```

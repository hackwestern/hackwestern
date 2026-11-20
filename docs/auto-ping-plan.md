# Auto-Ping: plan for the mentor, volunteer and judge messenger

Status (2026-11-20, 4:40 AM): the Auto-Ping sheet is set up by hand; the sender is not built yet. Build it next, reusing this PR's Slack code (`src/server/slack/client.ts`, `organizer-sync.ts`).

## The sheet

Auto-Ping: https://docs.google.com/spreadsheets/d/12O1XRmQN3mT-bwTFGKQEGAQ2gEb6fQIjsB55K_gcHf0 (owned by Jazz). Tabs:

- **People**: Role, Full name, Email (formula: Email override, else lookup in the sign-up tabs), Shift, POC, Personal note, Send? (checkbox), Message preview (formula, welcome only), Status (bot writes), Check before sending, Email override.
- **Messages**: templates keyed by name ("Welcome: Mentor", "Shift reminder: first shift", "Final thank you: Judge"...), each with when it's sent. Fill-ins at the bottom ({checkin}, {wifi}, {channel}, {food}, {hackers}, {projects}) that Jess fills once. A line whose fill-in is empty is dropped.
- **Mentor schedule / Volunteer schedule**: live IMPORTRANGE of the "Schedule" tabs of "2. Hack_Western_13_Mentor_Schedule" (1Uq6BQFpRLf4qnLQcvnAA_dz1QfdLDKuB-_FQPohN-T0) and "2. Hack_Western_13_Volunteer_Schedule" (10IfdhOGaCwg4LE8kO8S2eVZZlnnePcSoUSnvEtuRRV8). These are the source of truth for who is in and their shifts (Jazz, 2026-11-20). The "1." copies are old.
- **Mentor / Volunteer / Judge sign-ups**: live IMPORTRANGE of the form responses (name, email, availability only). Judges come from the green rows of the judge form (11 people), shift Sun 8:30am-1:30pm.
- **Log**: Sent at, Role, Full name, Email, Channel, Message, Result. The bot appends one row per message.

The service account `hw-run-of-show@hackwestern-sheets.iam.gserviceaccount.com` needs Editor on Auto-Ping (Jazz shares it; the Drive connector can't). It reads everything through Auto-Ping, so no other sheet needs sharing.

## Schedule grid format

Row 1: day, only above the first column of each day (fill it forward). Row 2: time block, "8pm - 1am". Rows 3+: names, one per cell, sometimes with a note:

- `(2am start)`: same block, later start: "Sat 2am-9am".
- `(3-7pm)`: replaces the block: "Sat 3pm-7pm".
- `(12pm start)`: "Sat 12pm-3pm".
- Anything else: don't guess. Flag it in Check before sending and skip that person's reminders.

Blocks ending after midnight ("8pm - 1am") end the next day. "Sun 1am-9am" is Saturday night into Sunday.

## What the sender does each sync (every 5 min, same GitHub Actions pattern as organizer reminders)

1. **Rebuild People from the schedules.** Everyone on a schedule is a row (plus the judges). Add new people, drop people no longer on a schedule, recompute Shift. Keep Jess's columns (POC, Personal note, Send?, Email override) by matching the full name. Match schedule names to form names loosely ("Aiden Alaei" = "Aiden (Arman) Alaei", case, extra spaces) and flag guesses in Check before sending. Same person in two roles: two rows, one welcome.
2. **Plan messages per person** (Jazz, 2026-11-20: check in first, no welcome before they arrive): Check-in (30 min before the first shift: tell {poc} on Slack you are here and where, plus Wi-Fi, channel, food, all shifts), Shift reminder second / third / last (15 min before), After a shift (when another follows), Last day, Final thank you (Sunday after closing, sent by hand once {hackers} and {projects} are filled). Arrivals go to the POC on Slack instead of texts to Jess phone; POC is Jess Xing, or Emily for the people Jess will not meet. Shifts always come from the schedule tabs, never the roster doc notes.
3. **Send on Slack** by email lookup (users.lookupByEmail). Not on Slack: write "Not on Slack" in Status and log it, so Jess has a list. Mention the POC as a real Slack mention (@Jess Xing = U0CGMK4KX9A).
4. **Only rows with Send? ticked get messages.** Every message sent goes in Log, and Status shows the last one.
5. Use Slack's scheduled messages for the timed ones (like organizer reminders), so a missed run doesn't drop a reminder.

## Data issues seen (2026-11-20)

- Mentor "Schedule" vs "By mentor" tabs disagree (Justin Tan vs Shaun Ahuja in a Sat 3pm-8pm slot; Ali, Ian). The Schedule tab is the source now.
- Deanna Luong, Sarah Huang, Dennis Zhang are on the volunteer schedule but in no form: need Email override. Jerry Zhang's is set.
- Aleks Bursac is on the mentor schedule but pink (not accepted) in the form. Ask Jess.

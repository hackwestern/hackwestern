# Sponsor organizer flow

How an organizer on the sponsor team uses `/internal/sponsors` during the event. Nav: **Sponsors**.

The page has four tabs: Sponsors, Run of show, Coffee chats and Help. The tab is in the URL, so any view can be shared or bookmarked. The Happening now banner sits above the tabs on all four.

## During the event

1. **Start on Sponsors.** Each sponsor row shows status, room, booth and picks, plus a strip with their coffee chat room, chats accepted and pending, and whether they have a help request open. The Task pings tab shows a count when someone is waiting.
2. **Move a sponsor along.** Change their status (Checked in, Booth set up, and so on) from the row, same as before.
3. **Check their day.** Click **View on schedule** on the row. The Run of show tab opens with the sponsor filter set to them, so the grid and the rooms table only show their coffee chats. A bar at the top says who you're looking at.
4. **Fix a coffee chat.** Click **Coffee chats** on the row. The rooms table and the By sponsor board open filtered to them. Use List to add a chat, move a room or cancel.
5. **Answer a help ping.** Click **Help** on the row, or open the Task pings tab when its count shows up (help requests are at the top; old `?tab=help` links land there). That sponsor's request is first and outlined. Call the rep, go to them, then **Resolve** (if Slack didn't already).
6. **Go back.** Click the sponsor's name on a help card, or **Back to (sponsor)** in the bar. You land on their row on the Sponsors tab, scrolled into view and highlighted. **Show everyone** clears the filter instead.

## The Sponsors tab by day

Fri / Sat / Sun pills sit at the top of the Sponsors tab. It opens on today during the event and on Friday otherwise; `?day=sunday` opens a day directly.

- **Friday:** who has arrived (their status), and whether they have their portal link. Press **Mark given** once you've handed it over; it turns into **Link given** (press again to undo).
- **Saturday:** each sponsor's chat slots by room, booked/asked, e.g. `10:00 2/3`. Orange slots still need hackers.
- **Sunday:** their judging room, whether they sent their round 1 shortlist and their round 2 top 5, and where they should be right now (their presentation room while their slots run, else the run of show).

## Old links

`/internal/sponsor-schedule` still works and redirects to the matching tab. `?tab=where` and `#rooms` open Run of show at the rooms table.

# Sponsor dashboard: vision

## Goal
Give each HW13 sponsor one mobile-friendly page that tells them where to be, when, and who they're meeting, kept in sync with the organizers' run-of-show sheet. Let sponsors pick the hackers they want to meet and book coffee chats themselves, without Calendly.

## Done for v1 (before Nov 20, 2026)
- A sponsor opens their private link on a phone and sees their schedule: booth location, workshops and talks they run, opening-ceremony speaking slot, and coffee chats, each with a room. All of it comes from the run-of-show sheet and updates within about a minute of a sheet edit.
- Every organizer-owned view is read-only, with an "Edit in Google Sheets" button that opens the sheet.
- Hackers rank the sponsors they're interested in on the live site. Each sponsor gets an auto-shortlist of the 40 most interested hackers who agreed to share with sponsors, showing hacker ID, team, resume, GitHub, LinkedIn and Devpost.
- Sponsors book coffee chats in a rooms × time-slots grid. Taken slots grey out for everyone, and bookings stop at the tier cap (Gold 4h, Silver 3h, Bronze 2h). Bookings are written into the sheet.
- For judging, each sponsor can shortlist up to 20 teams (was 10).
- Organizers can add or assign a chat and assign a sponsor rep to it from the sheet, and the dashboard shows it.

## Non-goals
- Editing organizer info on the website.
- Calendly or any third-party scheduler.
- A new sponsor login system. The private UUID link stays the credential.
- Rebuilding sponsor judging. The 3-step scoring flow reuses Ethan's judge app (#1129).

## Constraints
- The run-of-show Google Sheet is the single source of truth (see docs/decisions.md, 2026-11-14).
- Reads go through the existing sponsor Sheets service account (`SPONSOR_SHEETS_*`), so the sheet must be shared with it.
- Hackers appear only if `agreeShareWithSponsors` is true.
- Phone first: every view works at 375px wide with no sideways scrolling.
- Event is Nov 20–22. Anything not ready by Nov 19 is cut, not shipped half-done.

# Decisions

## 2026-10-02 — Desktop sections keep fixed heights; wide screens crop photos

**Decision:** On desktop every section keeps its 1440-design height at every screen width (hero scene 1275px, About 1109px, Projects 1167px, Sponsors 1790px). Photos fill the width and are cropped top and bottom. The hero art is cropped from the top only, so its valley, where the scroll path and story pins sit, stays in view. Content stays its 1440 size and doesn't scale up. About's windows sit in a centred 1440 box, like the Projects stage, and the Projects clouds drift across the full width.

**Why:** Letting sections grow with width (to show each photo whole, and then scaling the content 1.33× to match) made the page much taller on large displays: 11559px at 2560 vs 7230px. Fixed heights were the preferred trade-off.

**Alternatives (tried the same day, then reverted):**
- Section photos at full height, with the strips on the seams: the whole photo shows, but the page grows with width.
- Content scaling with width, capped at 1.33× (`--ui-scale`): looks like a zoomed MacBook layout, but grows height too.
- Scaling by the smaller of width ÷ 1440 and height ÷ 900: not chosen.
- One long background image with the strips baked in: rejected because the hero has parallax layers, the ASCII and folders are placed per section, mobile uses different art, the file would be heavy, and the vector strips would blur.

## 2026-10-02 — Past 1440, sections and elements grow at half the rate of the width

**Decision:** On desktop, past 1440 wide, About, Projects and Sponsors heights and their elements (windows, folders, titles, FAQ, tree stage) grow at half the rate of the screen width: 1 + ½ × (width ÷ 1440 − 1), so 1.17× at 1920 and 1.39× at 2560. Elements stay on the same spot of their photo. Sponsors pins its title, FAQ and window to photo coordinates (`photo-pin.ts`, CSS container units). About keeps each element at its 1440 % position, which follows the full-width photo sideways and scales vertically with the section. The hero is back to its original scene (grows with width, 1.5-screen scroll hold). 1440 and below are unchanged.

**Why:** Fixed heights left content small and off its spot on the photo at wide widths. Proportional growth made the page too tall. Half rate is the middle ground.

**Alternatives:** About grows at the full rate so every element keeps its exact photo spot (About ~2770px at 2560); About elements fully photo-pinned (at 2560 the band they span on the photo, 1582px, is taller than the 1540px section).

## 2026-10-02 — Wide screens keep content in the centred column

**Decision:** Past 1440 wide, About, Sponsors and hero content sits in the same centred column as the Projects stage (1440 × `--ui-scale` wide). Horizontal positions are measured from the screen centre, and vertical positions are unchanged. The hero text and message windows (box and text), and the navbar (via CSS `zoom`), grow with `--ui-scale` too. 1440 and below are unchanged.

**Why:** With elements following the full-width photo, very wide screens spread them to the edges. Keeping one column lines up every section title with "Discover past projects".

## 2026-11-14 — Sponsor dashboard reads the run-of-show sheet and never edits organizer info

**Decision:** The run-of-show Google Sheet is the single source of truth for organizer info on the sponsor dashboard (schedule, locations, speakers, rooms, booths). The site only reads it. Organizer views have an "Edit in Google Sheets" button; sponsors never get the sheet link. Sponsors can still shortlist hackers and book coffee chats on the site (option B). Everything must work well on mobile.

**Why:** One place to edit organizer info means the sheet and the site can't disagree, and organizers already work in the sheet.

**Alternatives:** Two-way sync for everything (conflicts, double bookings); fully read-only for sponsors too (every booking becomes manual organizer work).

## 2026-11-14 — Coffee chats live in the database, tied to a hacker, mirrored to the sheet

**Decision:** Each coffee chat is a database row tied to one hacker (users.hackerId) with a status: pending, accepted, declined, expired. Sponsors create requests on the site; the hacker accepts or declines on the live site. Every booking and status change is copied one way into the Coffee Chats sheet tab so organizers see it there. Declining frees the slot and the sponsor sees "declined". A request with no answer expires 20 minutes before the chat. Notifications: email (Mailjet) and a toast plus Accept/Decline on the hacker portal. No SMS for v1. Slack DM only if the team's existing Slack bot can be found and its token shared. Sponsor shortlist sizes: 20 teams for judging, top 40 interested hackers for coffee chats.

**Why:** Accept/decline is a hacker action with state that changes on the site, which breaks "sheet is the only store". The database gives a real link to the hacker, safe concurrent updates, and reliable expiry; the mirror keeps organizers working from the sheet.

**Alternatives:** Sheet-only with a status column (no link to the hacker record, races when sponsor and hacker act at once). SMS via Twilio (new paid account, opt-in needed; deferred). Auto-offering a declined slot to the next hacker (takes the choice away from sponsors). Expiring 2 hours before (too early during a fast-moving event).

**Capacity (added same day):** A sponsor can run as many chats at once in a room slot as the reps they send (one hacker per rep), capped by the room's seat capacity. Rooms are not shared between sponsors in the same slot. Sponsors enter their rep count on their page (stored in the database); room capacities are organizer info in the run-of-show sheet, read-only on the site. Alternatives: sharing leftover seats with another sponsor (two sponsors in one room); one chat per slot (reps only decide who runs it); organizers entering rep counts in the sheet.

## 2026-11-14 — Coffee chat rules follow the live Coffee Chats tab
- **Decision:** Coffee chats are Saturday only. Each sponsor's row in the run-of-show sheet's Coffee Chats tab sets their window (AVAILABILITY START/END), format (15-min Individual 1-on-1, or 30-min group "with 3 people") and total hackers. The sponsor sets how many reps they send. Each sponsor gets their own room (2241-2243, assigned by organizers); a room fits 6 people, and reps + hackers in the room must fit (1-on-1s: up to 3 at once; groups of 3: one at a time). Every hacker has their own request row (accept/decline alone), so a group is up to 3 rows at the same sponsor and start time. `coffee_chat` stores start time on a 15-min grid plus duration_minutes so a 30-min chat blocks the hacker for both quarter hours.
- **Why:** the live sheet (read through the new hw-run-of-show service account) showed per-sponsor formats and windows starting at 9:00, which the earlier "reps x room capacity, 10:00-4:00" plan didn't cover. Room size (6 people) from Jazz.
- **Alternatives:** sheet sets everything including parallel chats (rejected, Jazz wants sponsor reps); hackers join open groups themselves (not chosen); 1-on-1 only (dropped, the sheet has groups).
- **Also:** migration 0039 was regenerated (old one moved to _to_delete/drizzle/), safe because it was never pushed. Run-of-show sheet uses its own service account (project hackwestern-sheets, hw-run-of-show, Viewer) with fallback to SPONSOR_SHEETS_*.

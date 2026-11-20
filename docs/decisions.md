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

## 2026-11-20: Organizer reminders from the HW 13 Run of Show (Jazz)

**Decision:** every organizer gets a Slack DM 15 minutes before each of their tasks on the HW 13 Run of Show "Schedule View" tab, with the cell's details. Slack holds the queue; a GitHub Actions sync every 5 minutes makes it match the sheet, so owner changes move the DM and no database is needed. Slack accounts come from the HW13 Contacts sheet emails; team words (Spon, Web) ping the whole team. The bot never edits the run of show; it DMs Jazz what to fix instead. Shipped as a small PR to main (new files only) so it doesn't depend on the sponsor-dashboard merge.
**Why:** the run of show changes all weekend and people miss their slots. Schedule View is the source (Person View is pasted text and goes stale). Main has no Slack code or reminder tables, and merging sponsor-dashboard on event day is too big.
**Alternatives:** a CSV like the marketing bot (stale after the first edit); a laptop watcher with a database (stops when the laptop does); auto-reformatting the sheet (could overwrite someone's edit); matching first names in the Slack directory (hundreds of hackers share first names).

## 2026-11-20: Auto-Ping sender for mentors, volunteers and judges (Jazz)

**Decision:** a second Slack bot (`scripts/auto-ping.ts`, `.github/workflows/auto-ping.yml`, docs/auto-ping.md) DMs mentors, volunteers and judges from the Auto-Ping sheet. A person is their email: schedule names are looked up in the contact info tabs (the only loose name match, flagged in Check before sending) and nothing is guessed when there's no email or two. The bot keeps its own record of scheduled Slack messages on a Queue tab, and shows every planned message, with its exact text and status, on a Planned messages tab. A blank fill-in holds that message instead of dropping the line. Shifts under an hour apart are one stretch. A 4th shift that isn't the last gets no reminder. "Last day" goes 8 AM Sunday only. The final thank you is sent by hand and uses the person's first shift's role.
**Why:** templates are free text Jess edits, so scheduled messages can't be recognised by their text the way the organizer bot does, and the sheet is the only state a GitHub Actions run has. Names on the schedules don't match the forms (reversed, nicknames, case), so emails are the only safe identity. A message with a blank channel or count would look broken. The "Last day" template says "the last day of Hack Western 13", which is only true on Sunday. The "third shift" text says "Shift #3", so it can't be reused for a 4th.
**Alternatives:** recognising our messages by a hidden text marker (Slack shows it); a database (none on main, and a fresh CI job needs the state); matching People rows by name (wrong person on a reversed or shared name); dropping lines with blank fill-ins (the first plan, changed by Jazz the same day); sending "Last day" on Saturday for people who finish Saturday.

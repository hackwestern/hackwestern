# Sponsor portal flow, hacker /live look (v1)

One clickable static prototype (`index.html`, hash routing) of the Sun Life sponsor portal, styled like the hacker `/live` site, built for iPhone first (390x844). Tests whether the sponsor portal should feel like the same product as `/live`. All people, phone numbers, projects and links are fake.

Open `index.html` in a browser. Routes: `#today`, `#chats-1` (Calendar), `#chats-2` (Shortlist), `#chats-3` (Confirm), `#chats-done`, `#scan`, `#judging` (locked), `#judging-browse`, `#judging-shortlist`, `#judging-r2`, `#schedule`, `#map`, `#help`.

Screens: `node mocks/sponsor-portal-flow-hacker-v1/capture.mjs` (every screen at 390x844, plus `-end` shots scrolled to the bottom; Today and Calendar at 1280x800). It also checks for horizontal page scroll and clipped text. `capture-current.mjs` takes the `00-current-*` reference shots of `/live` and `/` (it logs in as a local demo hacker and reads the password at run time; the password is never written anywhere).

## Taken from the hacker site
- Colours, radii, shadows: `src/lib/tokens.ts:242-294` (dashboardColors: page `#f3f7fc`, nav `#dbe7f5`, selected `#b9d3f0`, primary `#0b6bc4`, text `#0b2b4a`) and `:466-494` (radius 4/6/8, card shadow, primary button shadow).
- Type: Figtree everywhere, `display` 32/48 px and `h1` 28/32 px from `src/styles/globals.css:161-169`. Pix32 pixel font for day headings, time labels and event titles, as on the /live schedule (`src/components/live/day-schedule.tsx:50-55, 278, 405`; font from `src/pages/_app.tsx:37-41`).
- Phone top bar: horse logo left, centred page title, action on the right, nav-blue background (`src/components/live/topbar.tsx:24-31`).
- Desktop sidebar: 300 px nav-blue rail, horse + "Hack Western 13", icon links with the selected pill (`src/components/live/sidebar.tsx:105-121`, `navlinks.tsx:16-23`).
- White cards with soft shadow (`src/components/internals/dashboard-panel.tsx:17-21`), chips (`dashboard-chip.tsx:27-36`), buttons (`dashboard-button.tsx:16-40`).
- Hacker Checklist pattern (segmented progress bar, highlighted current step, warning-coloured due date, big check circle when done) from `src/components/live/hacker-checklist.tsx:73-190`. Reused for "Up next", the 3-step chat setup, and the submitted / help-sent confirmations.
- Schedule event blocks (rounded, 2 px coloured border, tinted fill) from `day-schedule.tsx:23-48`.
- Pixel cursors on mouse devices (`tailwind.config.ts:226-229`).
- Notification badge colour `#a34a00` (tokens `status.warning`) for the Chats "plan due" badge.
- Judging tabs, score grid and copy from `src/pages/sponsors/[uuid]/picks.tsx:174-211` and `src/content/sponsor-judging.ts`.
- Booth layout from `src/lib/sponsor-bay-layout.ts:18-29`; rooms from `src/content/sponsor-venue.ts:19-31`.
- Assets copied into `assets/`: `horse.svg`, `sunlife.png`, `Pix32.woff2`, `cursor-default.webp`, `hover-hand.webp`.

## Adapted for sponsors
- Sticky bottom tab bar on phones (the /live site uses a hamburger sheet). Four tabs, styled like the sidebar's selected pill.
- The bell is replaced by one Help button in the top-right of every page.
- Tone is professional: "Hi, Sun Life!" is the only playful line. Pixel font is used only for headings and times, never body text.
- Calendar follows `docs/specs/sponsor-chat-calendar.md` in hackwestern-coffee-prefs: worked example data, live hours meter, chats and seats, hours strip, 1-on-1 (blue) vs Group (violet, the /live main-event colour), dividers per chat, "with Leo T." on shared blocks, one rep at a time with a switcher under 600 px. Tap an empty slot to add a chat; tap a block for the block panel (reps, 15/30 toggle with the odd-length rule, hackers per chat capped by room size, start/end, delete).
- Confirm asks for the sponsor's phone number (at least 7 digits) before submit.
- Mock-only links (dashed boxes) show states that depend on time or sponsor type: judging after Sun 9 AM, round 2, and a sponsor without a prize track.
- Copy is inline in the HTML (mock convention). In the app it would go in `src/content/`.

## Feedback applied (Jazz's review of the live portal)
- Nav is 4 items: Today, Chats, Schedule, Map. Help lives in one place: the top-right Help button. The HW lead's tap-to-call/text sits on the Help page only.
- Location lives on Map only (Sponsor Bay layout with Sun Life highlighted, plus room lookup). Today has one line ("right wall, middle booth, between CSE and Scotiabank") and a "Your booth on the map" link.
- Scan sits inside Chats (Your chats / Scan tabs, plus a floating scan button on phones once the plan is submitted). After a scan it states exactly what was offered (time, rep, format) under "Scanning offers a hacker an open seat in your planned chats." The no-camera fallback shows the actual link and a QR.
- Today adapts per sponsor: judging items disappear for a sponsor without a prize track (mock toggle on Today). No "Phone number coming soon" anywhere.
- Chats: setup is the calendar, "Shortlist up to 40 hackers", no refresh button, "Shortlist" used everywhere, and "An unanswered offer expires 20 minutes before the chat." on its own line.
- Schedule: no "Happening now", no duplicate events, the sponsor's own column first (stacked on phones, side by side on desktop), nothing clipped, no tap-to-expand headings, one location format ("Rm 2110", "Rm 1110 (Grand Hall)", "SM Atrium").
- Every page starts content right under the top bar on phones; the page title is the top-bar title, and intro paragraphs show only on desktop.

## Open questions
- Brief asked for the HW lead on Home; the feedback says help lives in one place. I kept the lead on the Help page only.
- Booth position is from `sponsor-bay-layout.ts` (right wall, row 3), not the "spot 4, left wall" example in the feedback.
- Judging has no nav item; it's reached from Today (judging sponsors only).

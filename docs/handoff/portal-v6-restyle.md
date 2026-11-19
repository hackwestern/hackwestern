# Portal v6 restyle: handoff

Branch `portal-v6-restyle` (worktree `hackwestern-portal-v6`). The sponsor portal (`/sponsors/[uuid]/*`) now uses the look and layout of `hackwestern-sponsor-dash/mocks/sponsor-portal-flow-hacker-v6`. Behaviour is unchanged: where the mock and the app disagree, the app wins (docs/decisions.md, docs/ship/decisions-log.md).

**Today is paused.** Jazz is reviewing a separate Today mock (`sponsor-today-v1`). The portal's default route (`src/pages/sponsors/[uuid]/index.tsx`) is the old home, untouched, sitting inside the new shell. Nothing for Today was built.

## What maps to what

| Mock | App |
|---|---|
| Side nav (`.side`): horse + "Hack Western 13", white sponsor card with logo and "Sponsor portal", nav links, "Times are Eastern" footer | `SponsorShell` in `src/components/sponsors/sponsor-shell.tsx`. The links reuse `navLinkClass` from `src/components/live/navlinks.tsx`, the same style as the hacker /live sidebar. Width 300px, `bg-dashboard-bg-nav`, rounded right edge, like the mock. |
| Phone top bar (`.top`): horse, page title, Help | The same `<header>` element. On phones it's the sticky bar. From tablets up it becomes the page's title row (big heading on the left, How to and Help on the right), so the tour and Help mount once. |
| Bottom tabs (`.tabs`) | Phone tab bar on `bg-dashboard-bg-nav`, current tab on `bg-dashboard-bg-navSelected`. |
| Nav: Today, Chats, Schedule, Judging, Map | Today, Chats, Scan, Schedule, Judging, Map (Scan stays in the nav, as the brief asked). Judging is still hidden without a prize track, and greyed with a "Sun 9 AM" note and popover until it opens. `?preview=judging` carries through every link. |
| Help as a modal over the current page | The existing Help dialog (HW lead's name and phone with copy, Noah as emergency), opened from a "Help" button in the header on every page. No message form. |
| Page heading (`.h1`) and lead line | `heading` and `lead` props on `SponsorShell`. The lead shows from tablets up, as in the mock. Chats and Scan keep their intro on phones because it says what the page is for. |
| `#map` | New route `src/pages/sponsors/[uuid]/map.tsx`: "Your booth" card with the Sponsor Bay layout, then the floor plans and key places. The floor plan is now `VenueFloors` in `venue-map.tsx`, shared with the map dialog. Floor buttons use `DashboardChip`. |
| Sponsor Bay booths | `BoothLayout` restyled: white booths with a border, yours in primary blue, the projector screen as a dashed box, every name on one line (no vertical text). |
| `#chats` home, flows, step rails, status card, Your chats | Already built from this mock. The page title moved into the shell; in the flows the header shows "Back to Chats" (desktop) and the flow card keeps its h1. Rep filters and shortlist filters now use the chip style (`bg-nav`, primary when on), kept as radio buttons. |
| `#schedule` | Heading "Your schedule" and lead in the shell; the grid card is unchanged. The "Need help?" card under it is gone (Help is in the header). |
| `#scan` | Heading in the shell, phone bar says "Scan". The scanner card is unchanged. |
| `#judging` | Frame only (nav, header, shell). `picks.tsx` and the judging components are untouched because judging is being rebuilt in the main folder, so the page keeps its own h1 under the header row. |
| `wrapCo()` (company names on one line) | `keepNamesTogether` in `src/lib/keep-names-together.ts`: non-breaking spaces inside every Sponsor Bay company name, "Hack Western" and the viewer's company. Used for run-of-show titles (schedule grid, happening now, next event), workshop titles and the Your team heading. |
| Figtree only | The shell and pages use `font-figtree`; no pixel font anywhere in the portal. |

## Left out, and why

- **Chats badge in the nav ("1").** The mock's badge has no source in the app (there's no "unread changes" count for sponsors). The status card on every coffee chat screen covers "what changed".
- **"Add a hacker" as a tab inside Coffee chats.** The brief keeps Scan as its own nav item, so Chats doesn't repeat it as a tab. The Chats home still links to it.
- **Map: the Venue address card and pinch-to-zoom.** The address isn't in the app's content or data. The floor plans aren't zoomable today; adding zoom is new behaviour, not a restyle.
- **Mock-only demo controls** ("Mock only: ..." boxes, `?demo=`, simulated teammate picks, "Who's shortlisting?", "Longer chats", "hackers free" counts, the Help message form). The decisions logs override these.
- **Today page.** Paused for the `sponsor-today-v1` mock (see above).

## Decisions made while building

- **How to stays in the header, next to Help.** The mock has only Help, but the tour menu is existing behaviour and needs a home. It uses a compass icon so it isn't confused with Help's "?", and it's labelled "How to" on phones too.
- **The side nav's "Need help?" and "How this works" buttons are gone.** Both now live in the header on every page.
- **The Map button in the header became the Map tab.** The map tour's first step targets the Map nav item (`data-tour="map"`), and its later steps find `map-floors` and `map-place-*` on the Map page.
- **Content width** is up to 1040px on every page (the mock lets cards fill the pane). `SponsorShell` lost its `wide` prop.
- **Wording:** nav "Home" is now "Today", the locked judging page's button reads "Back to Today", and the welcome tour's last step says How to is "at the top of the page".

## Clarity walk (UX specialist and the 5-year-old)

- **Phone header, every page.** The tour button was a bare compass icon. 5-year-old: "What's the circle thing?" **Fixed:** it says "How to" on phones too.
- **Scan, phone.** The heading "Scan a hacker's badge" would be cut off in the top bar. **Fixed:** the bar says "Scan" (the page's h1 on phones), and the full heading shows from tablets up. The intro under it still says what scanning does.
- **Judging for a sponsor without a prize track.** The phone bar said "Hack Western 13" because Judging isn't in their nav. **Fixed:** the bar names the section from the route.
- **Locked judging page.** "Back to Home" pointed at a tab that's now called Today. **Fixed:** "Back to Today".
- **Desktop Judging.** The header row has How to and Help but no title on the left, and the page's own "Judging" heading sits just below. Clear enough; it lines up once the judging rebuild lands and can take the shell's `heading`.
- **Chats, Schedule, Map, Help dialog.** Clear. The biggest button on each screen is the next thing to do, and Help opens over the page and returns focus to the button.

## Shared files

- No changes to global CSS, the Tailwind config or tokens.
- `src/components/live/navlinks.tsx`: `navLinkClass` is now exported (one word, `export`), so the sponsor side nav uses the /live style instead of a copy. Hacker /live is unchanged.
- Server and lib: none. `getSponsorPortalInfo`, `sponsorSchedule.get` and the judging routers are untouched.

## Screenshots

`docs/ship/walkthrough/portal-v6/before/` and `after/`, every route at 390 and 1280 (`NN-route-390.png` / `-1280.png`). Test Sponsor (fake team and hackers) for everything except Judging, which needs a prize track, so it uses Sun Life's portal on the local database. Real phones are covered with a grey block.

Retake them with the dev server on :3081:

```
BASE=http://localhost:3081 node docs/ship/walkthrough/portal-v6/capture.mjs after
```

Headless full-page shots stop painting below the first screen at phone width (the body is the scroller), so the script grows the viewport to the page height instead. The "before" set was taken before that fix, so its phone shots are cut off below the first screen.

## Checks

`tsc` clean, `next lint` 0 errors, `vitest` 1742 passed with the one known Apple Wallet failure.

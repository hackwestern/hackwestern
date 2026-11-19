# NEXT: sponsor dashboard (branch `sponsor-dashboard`)

## Now
Build the coffee chat flow in the app from the mocks Jazz approved:

**Sponsor side:** `mocks/sponsor-coffee-chats-v7/` (follow its FEEDBACK.md and its Overrides).
- Shortlist is the main view.
- "Manually selected" booth picks get chats first.
- Confirm Shortlist to Hack Western: due before their first Saturday slot, can't be changed after, locks.
- No ranking shown anywhere.
- Résumé, plus GitHub and LinkedIn logos.
- Chat setup (1-on-1 or 3-on-1, 20 or 30 min, reps, "Offer less chats").
- Your chats is read-only.

**Organizer side:** `mocks/organizer-coffee-autofill-v2/`, an auto-fill with a preview, then Send invites.
- Fill order: manual picks first, then the shortlist by interest rank.
- Extras become the waiting list. On a decline, invite the next from the waiting list, then from interest rank.
- A stats table, not an activity log.
- 8 rooms.

Do it in a worktree, with code review before merging.

## Where things stand (2026-11-18)
- **PR #1165** (draft, WORK IN PROGRESS, base `spon-judging`) is app code only. Docs, mocks, `_to_delete`, NEXT.md and context/ are kept out with `.git/info/exclude`, and `docs/decisions.md` is skip-worktree. Latest work there:
  - side nav portal (3c0ef20e)
  - Need help Message/Location
  - rooms 1348-1358
  - prize-track judging and the Sponsor Judging sheet tab
- **PR #1164** (live site maps): ready for review.
- **Sheet:** "Spon Team RUN OF SHOW" is the only one, and the service account is Editor. Writes happen only in production or with `SHEET_WRITES=1`. The tab name the app uses is "live sponsor info".
- **Checks:** tsc is clean; vitest is 116/117 (only the known Apple Wallet failure). The local DB `hackwestern_spon` is migrated through 0057.

## Local setup
- **App:** `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hackwestern_spon" SKIP_ENV_VALIDATION=1 npx next dev -p 3013`. The `.env` DATABASE_URL (Neon) fails auth.
- **Mocks:** run `python -m http.server 3040 --bind 127.0.0.1` from the repo root, then open http://127.0.0.1:3040/mocks/
- **Side-nav test server:** worktree `hackwestern-sd-sidenav`, port 3035. Test sponsors:
  - Scotiabank: `11111111-1111-4111-8111-111111111111`
  - Accenture: `22222222-2222-4222-8222-222222222222`

## Open questions for Jazz
- Chat length: 20 or 30 only? StarTech's sheet row says 15.
- Sponsor-track judging: Grand Hall (per the map), or Rm 2110/2230/2235 (per the run of show)?
- Luca's hackers-per-sponsor data: where is it? Likely the `HACKER_INTEREST_FORM` sheet.
- Map pins for Rm 1348-1358: where are they?
- Should the "Coffee Chat Room Grid" tab be retired, and the fields "live sponsor info" duplicates cleaned up?
- Should the emergency contact read Noah's number from the HW Contacts tab?
- Registering PCBWay, QNX, Accenture, Manulife and TinyFish as sponsors (Lucas).
- Organizer mock: restyle it to match v7's design system?

## Not in git (local only)
- ops-pings (worktree `hackwestern-ops-pings`) is done and needs its own PR.
- Admin page for the web team is queued.

## Files touched this session (main ones)
- **Code:**
  - `src/components/sponsors/sponsor-shell.tsx`
  - the sponsor pages
  - tour files
  - `src/content/sponsor-help.ts`, `sponsor-portal.ts`
  - `src/lib/coffee-chat-requests.ts`
  - `src/server/api/utils/sponsor-sheets.ts`, `sponsor-info-tab.ts`, `run-of-show-*`
  - `src/lib/sponsor-map-rooms.ts`
- **Mocks:**
  - `sponsor-coffee-chats-v5`, `v6`, `v7`
  - `organizer-coffee-autofill-v1`, `v2`
  - `wireframes-v2`

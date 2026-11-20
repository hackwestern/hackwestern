# Lucas: sponsor judging shortlist

You're picking up the sponsor side of judging: reps score projects, send a shortlist for round 1, then rank a top 5. Work from `sponsor-dashboard`. It has everything, including Jazz's latest work from Nov 19.

## Get the branch

```bash
git fetch origin
git checkout sponsor-dashboard
git pull origin sponsor-dashboard
git checkout -b lucas/sponsor-judging-shortlist
npm install
```

Open your PR into `sponsor-dashboard`, not `main`. PR #1165 (`sponsor-dashboard` into `spon-judging`, still a draft) is the one that carries all of this toward main. Its merge runs prod migrations 0059 and 0060, so don't merge #1165 yourself; leave that to Jazz.

## Run it locally

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` for your local Postgres. `npm run db:start` starts one in Docker.
2. `npm run db:migrate`, then `npm run db:seed` if your database is empty.
3. Start the app with `SKIP_ENV_VALIDATION=1 npm run dev`. Without `SKIP_ENV_VALIDATION=1` it stops on missing keys you don't need for this.
4. The sponsor judging page is `/sponsors/<sponsor id>/picks`. The sponsor id is a row id in the `sponsor_judging_sponsor` table, and the UUID is the sponsor's login, so no account is needed.
5. Leave `SHEET_WRITES` unset so nothing writes to the live Spon Team sheet.

Tests: `SKIP_ENV_VALIDATION=1 npx vitest run`. One test fails before you change anything (`wallet-apple-api.test.ts`); it's a known Apple Wallet issue, unrelated to judging.

## How it works now

- Reps pick their name ("Who's judging?"), then go through submitted projects one at a time or as a list. Scores run 1 to 10 in half points, and each rep's score is saved separately.
- Round 1: the sponsor sends a shortlist of up to 15 teams (`SHORTLIST_MAX`, one per 6-minute presentation slot in their room).
- Round 2: once organizers open it, the sponsor ranks a top 5 (`SPONSOR_FINAL_TOP = 5`).
- Digital sponsors (PCBWay) don't use the portal. The spon team enters their top 5 on the organizer judging board by pasting Devpost links.
- TinyFish judges remotely through the portal like everyone else.

## Where the code is

- Page: `src/pages/sponsors/[uuid]/picks.tsx`
- Components: `src/components/sponsors/judging/` (`shortlist-ranking.tsx` and `shortlist-send.tsx` are the shortlist steps)
- Rules and limits: `src/lib/sponsor-scoring.ts`, `src/lib/sponsor-presentations.ts`
- Server: `src/server/api/routers/sponsor-scoring.ts` (`get`, `score`, `review`, `sendShortlist`, `submit`) and `sponsor-judging.ts`
- Copy: `src/content/sponsor-judging.ts`. All user-facing text goes in `src/content/`, never hardcoded in components.
- Background: `docs/handoff/build-f-sat-judging.md` explains the build. It was written when the top was 3; it's 5 now. `docs/specs/judging-room-board.md` covers the organizer room board.

## Open problems you'll hit

- Sun Life has no judging room on the sheet yet, so its presentations and round 2 can't open. Round 2 hasn't been tested end to end because of this.
- Manulife's and Commure's judging rooms on the sheet read "RM 555" and "RM 44". They may be test values.

## Mocks

They're in `mocks/` on this branch. Open any `index.html` straight from your file explorer (double-click), no server needed.

- `sponsor-judging-redesign-d-v1`: the newest sponsor judging design (scroll score 1 to 10 in halves, several reps on one login, "Who's judging?").
- `sponsor-judging-redesign-a-v1`, `-b-v1`, `-c-v1`: earlier versions (A swipe cards, B scorecard list with rubric, C demo-fair route).
- `organizer-judging-board-v1`, `-v2`: the organizer's judging room board. v2 is the newest.
- `sponsor-chats-v3`: the approved design for the whole sponsor portal. Jazz wants the finished portal to follow it exactly.
- `sponsor-portal-flow-hacker-v1`: only there so the judging mocks' nav links work.

The app is the source of truth where it already differs from a mock (for example the top 5, not top 3). Ask Jazz before changing what a screen looks like.

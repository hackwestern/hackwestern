# Sponsor judging redesign, version C: demo fair route + board (v1)

One clickable static prototype (`index.html`, hash routes) of the Sun Life judging flow. Look copied from `mocks/sponsor-portal-flow-hacker-v1` (tokens, Figtree + Pix32, top bar, sidebar, cards, chips, buttons, sheet; assets copied into `assets/`). Data is `mocks/_data/devpost-projects.json`, inlined as `DATA`. State lives in memory, so a reload starts over.

## The model
Round 1 is a walk. Projects are sorted into a route by table area (A, B, C, D, then table number). A "Next" card shows where to go ("Table A04 · Next table on the route" or "3 tables away"), with "I'm at A04" and per-area visited bars. Every project card has a Visited check and sits in one of three columns: Not seen / Maybe / Shortlist. On phones, a segmented control picks the column and "Move to…" opens a sheet. At 1100 px and up, all three columns show side by side and cards drag between them. Scoring 1 to 10 is on each card. A sticky bar counts the shortlist (5 to 10, capped at 10) and holds "Send shortlist" (confirm sheet).
Round 2 is a podium. Five stands, 1st to 5th, each holds one team. On phones they stack, 1st on top. On desktop they form a podium (4-2-1-3-5) and you drag teams onto stands. Tapping "Place…" on a team, or "Place a team…" on an empty stand, does the same: taking an occupied stand swaps the two teams, or sends the old one back to the list. The "Presented to you" list shows each team's time and round 1 column plus score.

## Pros / cons
- Pro: matches what sponsors physically do (walk tables in order), and "where next" is never a question; the columns make the Maybe pile explicit.
- Pro: the podium makes 1st–5th visibly distinct, so you can't have duplicate ranks, and a swap is one tap.
- Con: cards are tall on phones (full Devpost card + score grid), and Visited vs. Not seen can feel like two overlapping ideas.

## Routes
`#locked` (before Sun 9:00 AM) · `#round-1` (route + board) · `#waiting` (presentation times and room) · `#round-2` (podium) · `#review` (exact lines sent, e.g. "1st place · Pocket Planner (a1c3e5f70912)") · `#sent` (read-only, with "Change and send again" while judging is open). The dashed "Mock only" bar on each page jumps between time states and seeds a shortlist when needed.

## Rules followed (docs/decisions.md, src/content/sponsor-judging.ts)
Opens Sun Nov 22 9:00 AM after the 8:30 debrief. Score out of 10. Shortlist 5 to 10, then Send shortlist (confirm). Teams present in the sponsor's room from 10:00 and hear about it on Slack or by email. Round 2 opens only when organizers open it, and ranks only teams that presented. Exactly 5 distinct places. Copy is inline (mock convention); in the app it belongs in `src/content/`.

## Check
`node mocks/sponsor-judging-redesign-c-v1/capture.mjs` from the repo root. It runs the whole flow at 390x844 by tapping (visit, score, shortlist 6, Maybe 2, send, open round 2, place 5 including a swap, review, send). It asserts the review lines match `^(1st|…|5th) place · Name \(12-hex id\)$` in order with distinct ids, and that the sent page is read-only. At 1280x800 it drags cards between columns and teams onto stands. Every step fails on page errors, horizontal page scroll, clipped text, or a tap target under 44 px. Screens are in `screens/`.

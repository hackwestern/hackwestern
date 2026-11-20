# Sponsor judging redesign A: "Swipe through the demo fair" (v1)

One clickable static prototype (`index.html`, hash routes) of the Sun Life sponsor judging flow, version A of 3. Phone first (390x844), works at 1280. Look copied from `sponsor-portal-flow-hacker-v1` (tokens, Figtree + Pix32, top bar, sidebar, cards, chips, buttons, sheet; assets copied into `assets/`). Data is `mocks/_data/devpost-projects.json`, inlined as `DATA`. All teams and people are fake.

## The model
Round 1 is a card stack: one Devpost-style project at a time (big table number, name, tagline, team, built with, Devpost / Video / GitHub buttons). Shortlist, Maybe or Skip with the bottom buttons, or swipe right (shortlist) / left (skip). Optional 1-5 score on the card. Counter "4 of 10 shortlisted · min 5", Undo for the last decision, and a Review list grouped by Shortlisted / Maybe / Skipped / Not seen where any team can be changed or reopened. Send shortlist (5 to 10) asks to confirm. Round 2: tap teams in the order you'd rank them (first tap = 1st place), tap again or x to take one out, Undo, drag the grip (or arrow keys) to reorder five distinct 1st-5th slots.

## Pros / cons
- Pro: one big card and three thumb-sized buttons fit walking a demo fair; the table number is the first thing you see.
- Con: comparing teams side by side is harder; you rely on the score, the Review list and Maybe.
- Con: swipe is hidden (buttons carry the action); a full shortlist (10) blocks Shortlist until you swap one out.

## Routes
`#locked` (before Sun 9:00 AM) · `#r1` (card stack) · `#r1-review` (change your mind + Send shortlist, confirm sheet) · `#waiting` (presentation times in Rm 2240) · `#r2` (tap to rank) · `#review` (exactly what's sent) · `#sent` (read-only). The dashed "Mock only" bar on every screen jumps between time states and fills in sample picks when needed.

## Check
`node mocks/sponsor-judging-redesign-a-v1/capture.mjs` from the repo root runs the whole flow (score, button + swipe shortlist, swipe skip, undo, review change, send, rank 5, undo, drag reorder, review, send), asserts the review lists 1st-5th with 12-hex team IDs, and fails on page errors, sideways scroll or clipped text. Screens land in `screens/` (390x844 every step, round 1 and round 2 at 1280x800).

## Open questions
- Score is 1-5 as briefed; the app scores 1-10 (`SCORE_MAX` in `src/lib/sponsor-scoring.ts`).
- Sent is read-only as briefed; the app lets sponsors resubmit until judging closes.
- Phone judging screens drop the bottom tab bar so the decision buttons sit where the thumb is; the top bar logo and Help still lead out.
- Copy is inline (mock convention); in the app it would go in `src/content/sponsor-judging.ts`.

# Sponsor judging redesign B: Scorecard list (v1)

One clickable static prototype (`index.html`, hash routes) of Sun Life judging at Hack Western 13. It uses the hacker `/live` look copied from `mocks/sponsor-portal-flow-hacker-v1` (tokens, Figtree + Pix32, top bar, sidebar, cards, chips, buttons; assets in `assets/`). It's built for phones first (390x844) and works at 1280. Data is `mocks/_data/devpost-projects.json`, inlined as `DATA`. All teams and people are fictional.

## The model
Round 1 is a searchable list of the 18 teams in the track. You can filter it (All / Not scored / Shortlisted) and sort it by table or score. Tapping a row opens it in place: the Devpost card (tagline, team, table, built with, tracks, plus Devpost / Video / GitHub buttons) and a 3-criterion rubric (Impact on financial wellness, Technical execution, Presentation; each scored 1 to 5). The total out of 15 adds up as you score. Each row also has a private note (280 characters) and a Shortlist toggle. A sticky bottom bar says "N shortlisted · Send shortlist". It only lets you send 5 to 10 teams and asks you to confirm first. Round 2 has five labelled podium slots, 1st to 5th. Each slot has its own picker listing the teams that presented. A team already placed is greyed out in the other pickers, and the slot shows its round 1 score (and your note) as a hint.

## Pros / cons
- Pro: one screen does both jobs, browsing and scoring, so it's quick to walk the fair table by table (sorted by table) and easy to find teams you haven't scored yet.
- Pro: round 2 can't produce a bad ranking: every place is a separate slot, and no team can fill two places.
- Con: an open row is long on a phone (Devpost card + rubric + note), and round 2's native pickers hide the other teams until you open one. The side list "Teams that presented" makes up for that.

## Routes
`#locked` (before Sun 9:00 AM) · `#r1` (round 1 scorecards) · `#waiting` (shortlist sent, presentation times in Rm 2240) · `#r2` (podium) · `#review` (exactly what's sent) · `#sent` (read-only). The dashed "Mock only" box on each page jumps between time states. Each route fills in mock state, so any route works on its own.

## Choices worth a look
- The phone tab bar is hidden on Judging so the sticky action bar can take the bottom edge. Judging is a focused task, and the horse and Help still lead out.
- Tapping a score that's already selected doesn't clear it. A double tap while walking would otherwise wipe a score.
- The rubric is 1 to 5 x 3 = /15, per the brief. The live app scores 1 to 10 (`sponsor-judging.ts`), so adopting B means changing that.
- Copy is inline (mock convention). In the app it goes in `src/content/sponsor-judging.ts`.

## Verify
`node mocks/sponsor-judging-redesign-b-v1/capture.mjs` (from the repo root) runs the full flow. It scores and shortlists teams up to 6, searches, filters, sorts, confirms the send, checks 6 presentation times, fills all 5 places (checking that a placed team is disabled in the other slots), asserts that the review shows "1st place · Name (id)" through 5th plus the sheet note, sends, and asserts that the sent screen has no inputs. Screenshots go to `screens/` (each step at 390x844, plus round 1 and round 2 at 1280x800). It also reports any page errors, horizontal page scroll, clipped text, or tap targets under 44px.

# Sponsor judging redesign D: team scoring with three ways through the list (v1)

One clickable static prototype (`index.html`, hash routes) of Sun Life's judging flow, version D. It's built for phones first (390x844) and works at 1280. The look is copied from `mocks/sponsor-portal-flow-hacker-v1`: tokens, Figtree + Pix32, top bar, sidebar, cards, chips, buttons and sheet, with assets copied into `assets/`. Data is `mocks/_data/devpost-projects.json`, inlined as `DATA`. All teams and people are fake. Scores live in memory, so a reload starts them over. The rep name, mode and split setting are kept in `localStorage`.

The flow is the same as A, B and C: locked → round 1 → send shortlist → presentations → round 2 (rank 1st to 5th) → review with team IDs → sent. What's new is how round 1 gets scored and who scores it.

## Routes
`#locked` (before Sun 9:00 AM) · `#r1` (who's judging + scoring) · `#shortlist` (team shortlist, send) · `#waiting` (presentation times) · `#r2` (tap to rank, drag to reorder; from A) · `#review` ("1st place · Name (12-hex id)") · `#sent`. The dashed "Mock only" box jumps between time states, turns the simulated teammates on or off, and has "Forget my name" to act like a new phone.

## Score control (Holia's slider, 1 to 10 in 0.5 steps)
- One overall score per project, from 1 to 10 in half points (1, 1.5 … 10). It's drawn as a horizontal scroll-snap strip of numbers: scroll or drag it (mouse drag works too), tap a number, use −/+ for 0.5 steps, or focus it and use ← → (Home/End, PageUp/PageDown). It's an ARIA slider.
- The big current value sits on the right of the label, as in Holia's slider (`src/components/judging/judge-scoring.tsx:142-173`). The control stays dimmed and reads "–" until you touch it, like `rubric-scorer.tsx` in `c7e6c2e1`, lines 196-238 ("Sliders start at 0 but stay dimmed … until the judge actually touches them"). Half steps come from the same file, `RUBRIC_STEP = 0.5`, lines 4-7.
- Holia's range is 0 to 10. The brief asked for 1 to 10, so the strip starts at 1.
- **Rubric** next to the score opens a modal with the four criteria and what 1-3 / 4-7 / 8-10 look like. It's optional. Close, Esc or the scrim returns focus to that project's Rubric button.

### Rubric source
- Criteria names and descriptions are the newest: `c7e6c2e1` (Kevin Li, "feat(judging): new rubric, Adventurous track ranking, super likes on results", Nov 18 23:41), `src/components/judging/shared/rubric-scorer.tsx:41-82`. These are Innovation + Impact, Creativity, Technical Complexity and Design/Polish. It's newer than holiazhang's `e5090654` ("updating rubric and moving question bank", Nov 18 16:24), which had no Technical Complexity.
- Adventurous (`track: true`) is left out. It only feeds Hack Western's own Adventurous track score (`src/lib/judging-score.ts` in `c7e6c2e1`), not a sponsor prize.
- The low/mid/high anchors for Innovation, Technical and Design come from Holia's `CRITERIA` in `src/components/judging/judge-scoring.tsx:31-60` (Idea, Technical, Design). Neither commit has anchors for Creativity, so its anchors were **written for this mock**.

## Three ways through the Devposts (segmented switch at the top of round 1, remembered)
1. **One at a time**: one full card (table, name, tagline, team, built with, Devpost / Video / GitHub) plus the score. "Save 8.5 & next" jumps to the next unscored project, and Skip moves on. Shows "4 of 5 scored".
2. **5 at a time**: a batch of 5 neighbouring projects (sorted by table, "Tables A02 to A15") as compact cards, each with its own score control. Scores save as you go ("Saved"). There's a batch bar, then Previous 5 / Next 5, and Review shortlist on the last batch.
3. **Quick pass**: triage only. Tap Yes / Maybe / No, or swipe right / left, with Undo. When you're done, "Score your Yes and Maybe projects" switches to One at a time or 5 at a time, filtered to those, with "Show all" to clear the filter.

Quick pass is the default the first time, and the tip under the switch says "Quick pass first … then score them 5 at a time".

## Several reps on one sponsor account
- **Who's judging?** lists Sun Life's reps (Dana W., Marcus O., Priya S., Leo T.) and is remembered on this phone. After that the page shows "Judging as Dana W. · with Marcus, Priya, Leo · Switch".
- **Split the list** is on by default and lives in the Sun Life team card. The 18 projects are divided evenly between reps who have picked a name, in runs of tables so each rep walks one part of the room. In the mock, Leo, Priya and Marcus have already picked, so Dana gets "Your 5" next to "Everyone's 18". Anyone can open Everyone's 18, where other reps' projects carry a "Leo's list" tag.
- Every score records who gave it. Each project shows all reps' scores and the average ("Dana 9 · Marcus 5 avg 7"). A gap of 3 or more gets an amber flag: "Dana 9 · Marcus 5: talk it through". The team card counts each rep's progress, the flags and the top averages.
- **Live teammates (simulated)**: every 8 s another rep scores something and a toast appears ("Marcus scored CareCost 5"). Every other tick, a teammate scores one of your projects, and every second one of those disagrees by 4 points so the flag shows up.
- **Shortlist** is suggested from the team's averages: projects that average 7.5 or more, kept between 5 and 10. You can tap to add or remove. "Send shortlist" sends once for all of Sun Life, and the confirm sheet names everyone. Round 2 shows team averages next to each team.

## Check
`node mocks/sponsor-judging-redesign-d-v1/capture.mjs` from the repo root (last run: all checks passed). It asserts:
- the picker appears, then "Judging as Dana W." with Your 5 / Everyone's 18
- quick pass with taps, a swipe and the Yes/Maybe filter into 5 at a time
- the score control: untouched, then +, −, End = 10 and no higher, Home = 1 and no lower, ArrowRight walking 1.5 … 10 in 0.5 steps, tap a number, horizontal wheel scroll landing on a half step, and at 1280 a mouse drag
- the rubric modal opens with the 4 newest criteria, and close / Esc return focus to the same project
- one at a time: Save is disabled until there's a score, then Save & next
- name and mode are remembered after a reload
- Everyone's 18, the owner tags and split off
- the seeded and live disagreement flags, and the live toast
- the suggested shortlist (5 to 10) can be edited and is sent for the whole team
- round 2 ranks 5, the review lines match `^(1st…5th) place · Name \(12-hex\)$` with distinct IDs, and the sent page is read-only

Every step fails on page errors, sideways page scroll, or clipped or off-screen text. Screens are in `screens/`: every step at 390x844, plus the three modes and the rubric at 1280x800.

## Open questions
- Should one rep be able to send the shortlist for everyone, or should it need a second rep to agree? The mock lets anyone send it.
- If two reps score the same project, both count toward the average. Should the owner's score weigh more?
- The split is fixed once reps join. If a rep joins late, the lists reshuffle; the mock has everyone join before scoring.
- Copy is inline (mock convention). In the app it belongs in `src/content/sponsor-judging.ts`.
- `_to_delete/_dbg.mjs` is a throwaway debug script from building this. It's safe to remove.

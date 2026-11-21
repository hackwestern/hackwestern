# Judging engine

How general judging is laid out and run on the day. The engine is the backend
(schema + `judging` tRPC router + `src/server/judging/`); every screen (judge
app, table map, organizer console, hacker Home) reads from it.

Out of scope for the engine: how teams and judges get into the system (hackers
create and submit teams; organizers add judges on the roster), sponsor judging
(sponsor rooms, run separately), and the screens themselves.

## Model in one paragraph

The room has a fixed number of physical tables (70 by default), numbered along
a snake. Every submitted team is seated at one numbered spot. Every judge owns a
**section** of consecutive occupied spots along the snake. Each occupied spot
falls inside the sections of **3 different judges** by default, so every team gets 3 scores. The
sections never move; to put a team in a different judge's lineup, organizers
swap teams between tables.

## Tables and the snake

- Organizers set two numbers: **table count** (default 70) and **rows**
  (default 5). Tables per row = ceil(table count / rows).
- Tables are numbered along the snake: row 1 left to right, row 2 right to
  left, and so on. Walking 1, 2, 3, ... traces the snake with no backtracking.
- Position of table `n` (1-based) on the grid:

  ```
  perRow = ceil(tableCount / rows)
  row    = floor((n - 1) / perRow)
  idx    = (n - 1) mod perRow
  col    = row is even ? idx : perRow - 1 - idx
  ```

  70 tables in 5 rows:

  ```
   1  2  3  4  5  6  7  8  9 10 11 12 13 14   ->
  28 27 26 25 24 23 22 21 20 19 18 17 16 15   <-
  29 30 31 32 33 34 35 36 37 38 39 40 41 42   ->
  56 55 54 53 52 51 50 49 48 47 46 45 44 43   <-
  57 58 59 60 61 62 63 64 65 66 67 68 69 70   ->
  ```

- Tables can be switched off (`is_active = false`); switched-off tables get no
  team and no judges.
- Changing the table setup clears any plan that hasn't started, so auto-assign
  must be re-run.

## Seating

- Every submitted team (`submission_status` = `submitted` or `late`) gets one
  active table. One team per table.
- Pair neighboring spots from the left edge of each row. First fill one
  active spot per physical table in snake order, then backfill the second
  spots. An unpaired spot or the active half of a pair fills in the first pass.
- Teams are shuffled by default. The API can seat them in submission order.
- More submitted teams than active spots is an error.
- Seating can be re-run until judging starts. The seating API clears the existing
  judge plan. The room map's **Reassign teams** button rebuilds any routes it
  cleared.

## Auto-assign: judge sections

- Every occupied, active spot needs **3 judges** by default (`judges_per_table`). Judges are taken
  in **the order they were added** (`judge.created_at`).
- Only organizer-type judges get sections. Sponsor judges judge in their
  sponsor rooms (and the ranking ignores sponsored marks), so they're left out
  of auto-assign, hand-offs and top-ups.
- Judges marked as a **no-show** are left out too (see Day-of fixes).
- Lay the occupied spots out in snake order 3 times end to end and
  cut it into one consecutive run per judge, as evenly as possible. Judge `k`
  (0-based, of `J`) gets slots `floor(k * S / J)` up to `floor((k + 1) * S / J)`,
  where `S = occupied spots * 3`. Use `s mod occupied spots` as the zero-based
  index into the occupied spot list.
- Result: every table is covered by exactly 3 different judges, no judge sees a
  table twice, and each judge walks a short stretch of the snake.
- Section size adapts to the judge count: 35 judges -> 6 tables each, 30 -> 7,
  21 -> 10. Fewer than 3 judges is an error (a table can't get 3 different
  judges).
- A judge's stops are written in walking order (`position` 1, 2, 3, ...). A run
  that crosses the end of a pass wraps from the last table back to table 1.
- All judges judge at the same time. They start at different tables, and
  because the passes are offset, no two judges are at the same table in the
  same round if they keep pace. With 6 tables each, the room is done in 6
  rounds.
- Empty and switched-off spots are skipped. If a seated team is missing
  when a judge arrives, the judge reports it absent.
- Auto-assign can be re-run (it replaces the plan) until judging starts.

Example, 70 occupied spots and 35 judges:

```
J1 [1-6]   J2 [7-12]  ...  J11 [61-66]  J12 [67-70, 1-2]
J13 [3-8]  J14 [9-14] ...  J23 [63-68]  J24 [69-70, 1-4]
J25 [5-10] J26 [11-16] ... J35 [65-70]
Table 1 is judged by J1, J12 and J24.
```

## Timed rounds

Judges don't wander. **Round N is every judge's Nth stop** (`position` N).
Stops in future rounds are refused; any stop whose round has started can be
started, scored or reported absent, so a judge who runs out of time can still
finish that team late.

- One row of state, `judging_round`: current round, status, round length
  (default 10 minutes) and the timer.
- Organizers press **Start round N** in the control room. Status goes
  `idle -> running`. Judges see "Waiting for round 1" until then, and a judge
  with no stop in the round sits it out.
- **Pause** stops the clock (`running -> paused`, `remaining_ms` kept). Scoring
  still works while paused. **Resume** carries on from the time left.
- At 0, or when an organizer ends the round, it is `closed`. Stops still in
  progress are released back to `assigned`. A running round whose `ends_at` has
  passed is treated as closed when read, so nothing has to tick.
- **Late scoring.** An unscored stop from a round that has ended is "missed".
  The judge moves on: the Next screen shows the current round's table (or "Up
  next" between rounds), and My teams lists the missed team with a **Score
  late** button, during the first pass and while re-scoring. A late score made
  while re-scoring counts as re-scored. The score form stays on the team it was
  opened for even if the next round starts, so a score never lands on another
  team.
- An organizer then starts the next round. Starting is refused while a round is
  open and after the last round (the most stops any judge has).
- **Catch-up round.** A table is "missed" when its judge never came: unscored
  and never started (nobody pressed "Judge this team") in a round that has
  ended, or a team told an organizer their judge never came ("Didn't come" in
  the table dialog). A started but unrated table isn't missed: the judge saw
  the team and scores it late from My teams. After the last round ends, the
  control room shows the missed count and a **Start catch-up round** button.
  Each missed table moves (same table, new judge and round) into a round after
  the last, to a present judge who hasn't seen that team, fewest catch-up
  tables first; the judge who never came gets it back only if nobody else can.
  One table per judge per round, so extras spill into a second catch-up round.
  A table every present judge has already seen stays missed.
- A judge marked no-show after judging starts keeps their tables; the unscored
  ones are picked up by the catch-up round (or can be handed off).
- **Reset** goes back to before round 1; marks are kept. Turning "Judges follow
  the rounds" off (`rounds_enabled = false`) lets judges go in any order, a
  safety valve for the day. Organizer fixes (absent by an organizer, hand-offs,
  edits to marks) are not tied to the round.
- Screens get the round from `judging.me.getMyStops` (polled every 4s, with the
  server clock so a wrong device clock doesn't skew the countdown) and
  `judging.admin.getRound`.

## Judging starts

Judging has started once any stop is `in_progress`, `done` or `team_absent`.
After that, table setup, seating and auto-assign are locked; only the day-of
fixes below are allowed.

## A stop's lifecycle

```
assigned --start--> in_progress --submit--> done        (team_mark written)
    |                    \--------absent--> team_absent
    \--organizer cancels--> cancelled
```

- A judge has at most one stop `in_progress` at a time.
- A judge can only act on their **current stop**: the one in progress, else
  their first `assigned` stop in walking order. Start, submit and report absent
  are refused for any other stop, except stops from rounds that have already
  ended (late scoring, see Timed rounds).
- Submitting writes the `team_mark` (score + breakdown) for the team seated at
  the table and marks the stop `done` in one transaction.
- Start and submit also send the `teamId` the judge's screen showed. If a
  different team is seated there now (an organizer swapped them in the
  meantime), the request is refused so the score can't land on the wrong team;
  the judge refreshes and scores the team that's there.
- Score format (from the judge app): `score` 0-10, plus
  `score_breakdown = { ratings: { criterionId: 0-10 in half steps }, notes?, superLike? }`.
- Organizers deleting a mark reopens its stop (`done` -> `assigned`), except
  at a table whose team was reported absent.

### Absence is final

- The first absent report at a table (by a judge or an organizer) disqualifies
  the team seated there. Every other open stop at that table (assigned or in
  progress) becomes `team_absent` at once, which counts as closed.
- No endpoint gives an absent table a live stop again: top-ups are refused,
  hand-offs leave its stops behind, and deleting a mark doesn't reopen one.
  The one exception is an organizer's **Undo absent** (see Day-of fixes).
- Disqualified teams are left out of the team results page and the ranking.
  Their marks also don't count toward judge averages in the ranking.
- The control room's round count leaves out absent tables, so a round can
  complete.
- Known limit: the in-database normalization (`judging_team_scores`) still
  uses an absent team's earlier marks for judge averages.

## Table live status

`judging_table.status` is kept in sync by a Postgres trigger on
`judging_assignment` and `team.judging_table_id`:

| Status         | Rule (first match wins)                                   |
| -------------- | --------------------------------------------------------- |
| `empty`        | No team seated                                            |
| `being_judged` | A stop at the table is `in_progress`                      |
| `waiting`      | A stop is still `assigned`, or the table has no stops yet |
| `finished`     | Every stop is `done`, `team_absent` or `cancelled`        |

## Day-of fixes (organizers)

- **Swap two teams' tables** (moves a team into other judges' sections).
  Locked once either table has a stop in progress or finished.
- **Move a team** to an empty active spot (same lock). Pending stops follow
  the team if the destination has no pending stops of its own.
- **Hand off a judge:** a judge who leaves gives all their unfinished stops to
  another judge in one action. Refused if the receiving judge already has one
  of those tables or has already scored a team seated at one.
- **Add a judge to a table:** top-up when a table needs another score.
- Hand-offs and top-ups go **after the receiving judge's last stop** (the next
  free `position`). With timed rounds a stop at position N opens once round N
  starts, which can add a round at the end. With late scoring (stops at or
  below the current round can be scored), a stop that lands at or below the
  current round opens at once, e.g. a floater's first stops.
- **Cancel a stop**, or **mark a team absent**.
- **Undo absent:** every `team_absent` stop at the table goes back to
  `assigned` (start and finish times cleared), with the judges who had them, so
  the team is judged and ranked again. Stops that were `done` stay done. If a
  judge who had one of those stops has left, cancel it and add someone else.
- **Mark a judge as a no-show** (Judges and Teams page): auto-assign skips
  them, and hand-offs and top-ups to them are refused. Before judging starts,
  marking a judge who already has stops clears the plan (run auto-assign
  again). After it starts, hand off their unfinished stops first.
- Judges added after auto-assign are **floaters** (no stops) until auto-assign
  is re-run or an organizer adds them to tables.

## Reads

- Organizers: table setup and settings, every table with its team, status and
  judges done of 3, every judge's stops, floaters, totals by status.
- Judges: their stops in walking order with table number, grid position,
  seated team and their score if given, plus which stop is next.
- Hackers: their table number and grid position, "N of 3 judges done", and
  whether their team was reported absent.

## Cheat check

The cheat-check sweep starts automatically once judging is complete: at least
one stop exists and every stop is `done`, `team_absent` or `cancelled`.
Organizers can still start a sweep by hand.

## Normalization

Unchanged. `judging.admin.getLatestRanking` computes each team's normalized
score from `team_mark` at read time (regular-round marks from organizer-type
judges).

## Trying it locally

```bash
npm run db:start && npm run db:migrate
npm run seed:judging -- --tables 70 --rows 5 --teams 60 --judges 35 --yes
```

The seed wipes the judging tables and all teams on your local database, then
builds a ready room through the engine: tables, every team seated (add
`--in-order` for submission order) and every judge given a section. Seeded
accounts sign in at `/login` as `judge<n>@judging.hackwestern.dev` and
`organizer@judging.hackwestern.dev` with password `hw13-judging`.

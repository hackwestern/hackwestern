# Judging engine

How general judging is laid out and run on the day. The engine is the backend
(schema + `judging` tRPC router + `src/server/judging/`); every screen (judge
app, table map, organizer console, hacker Home) reads from it.

Out of scope for the engine: how teams and judges get into the system (number of teams/projects automatically pulled from Devpost submissions with
`import-devpost-teams.ts`; organizers seed judges into the database and toggle `no-show` day-off), sponsor judging (sponsor rooms, run separately), 
and the screens themselves.

## Model in one paragraph

The room has a fixed number of physical tables (70 by default), numbered along
a snake. Each table has one **seat**, or two once there are more teams than
tables. Seat 1 always refers to the the primary seat of the table (or the only seat
if it is not split) while seat 2 refers to the second seat that is added when a table is split.
When a table is split seat 1 becomes on the left side and seat 2 becomes on the right side. 
Every submitted team is seated at one seat. Every judge owns a fixed
**section** of consecutive seats along the snake. Each seat falls inside the
sections of exactly **3 different judges**, so every team gets 3 scores. The
sections never move; to put a team in a different judge's lineup, organizers
swap teams between seats.

**All assignment logic is matched by seat id.** A seat is a `judging_seat`
row; `team.judging_seat_id` and `judging_assignment.judging_seat_id` point at
it. A table exists only as the physical place a seat sits: `table_number`
(position on the snake grid) plus `seat` (1 or 2) to tell the two seats at a
split table apart. The API sends `seatId`, `tableNumber` and `seat`; screens
show a seat as `4` (when there is only one seat) or `4 (seat 1)` and `4 (seat 2)` (when there are 2 seats) (`seatName`).

## Tables and the snake

- Organizers set two numbers: **table count** (default 70) and **rows**
  (default 5). This is fixed for Hack Western 13, but it can still be changed
  on the day with **table setup** (`setupTables`, the "Set up tables" form) if
  the room changes. Table setup is separate from auto-assign: it only builds
  the tables and seats; it doesn't seat teams or give judges stops. Tables per
  row = ceil(table count / rows).
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

- Seats can be switched off (`is_active = false`) in-case it becomes physically unavailable. If for some reason we don't want to a table to seat 2 teams, 
  we can switch seat 2 off (`toggleSecondSeat`). If for some reason an entire table cannot be used, we can switch the table itself off (`toggleTable`), by switching both seat 1 and seat 2 off. Seat 2 will never be on while seat 1 is off. If projects have already been assigned to seats that are being switched off, they will have to manually be moved to another free seat.
- Changing the table setup (`setupTables`, `toggleTable`, `toggleSecondSeat`)
  before judging starts clears any plan: every stop is deleted, so no judge
  can start until auto-assign is re-run. The control room says so when it
  happens.

## Seating

- Every submitted team (`submission_status` = `submitted` or `late`) gets one
  active seat. One team per seat, at most **2 teams per table**.
- For the first number of `tables`, one team is assigned per active table, every table has one seat. 
   Above that, `teams - tables` tables get a second seat, **spread evenly** along the snake
  (`tablesToSplit`). 70 tables: 95 teams split 25 tables (every 2nd-3rd),
  105 split every 2nd, 140 split all.
- Seats are filled in snake order; a split table's two seats are next to each
  other, so a judge scores both teams there one after the other.
- **Random by default**; `seatTeams({ random: false })` seats in **submission
  order** instead (earliest `submitted_at` gets Table 1 (seat 1)). The seed
  script's flag for this is `--in-order`.
- More teams than usable seats throws an error and seats nobody. Usable seats
  = 2 per active table, minus tables whose seat 2 is switched off (70 tables
  with nothing switched off: 140). Fewer teams than tables leaves the last
  tables empty.
- Seating can be re-run until judging starts. If the re-run adds or removes
  second seats, the plan is cleared and auto-assign must be re-run.
- Order on the day: submissions close (populate teams from Devpost) -> organizers mark no-show judges (`setJudgeNoShow`) -> seat teams (`seatTeams`) -> auto-assign (`autoAssign`) -> check for conflicts/toggle seats and tables -> manually swap teams (for conflicts) -> move tables (for unusable seats/tables) -> re-assign.

## Auto-assign: judge sections

- Every active seat needs **3 judges** (`judges_per_seat`). Judges are taken
  in **the order they were added** (`judge.created_at`).
- Only organizer-type judges get sections. Sponsor judges judge in their
  sponsor rooms (and the ranking ignores sponsored marks), so they're left out
  of auto-assign, hand-offs and top-ups.
- Lay the snake of seats (table number order, seat 1 then seat 2) out 3 times
  end to end (70 seats: 1..70, 1..70, 1..70 = 210 visits) and cut it into one
  consecutive run per judge, as evenly as possible. Judge `k` (0-based, of
  `J`) gets slots `floor(k * S / J)` up to `floor((k + 1) * S / J)`, where
  `S = seats * 3`; slot `s` is seat `s mod seats` in snake order.
- Result: every seat is covered by exactly 3 different judges, no judge sees a
  seat twice, and each judge walks a short stretch of the snake.
- Section size adapts: about `3 * seats / judges` stops each. 70 seats: 35
  judges -> 6 each, 30 -> 7, 21 -> 10. Fewer than 3 judges is an error (a seat
  can't get 3 different judges).
- At 6.5 minutes a stop (3 min pitch, 2 min Q&A, 1.5 min buffer), judging
  takes (most stops) x 6.5 min:

  | Teams \ judges | 35               | 30                | 25                |
  | -------------- | ---------------- | ----------------- | ----------------- |
  | 84             | 7-8 (52 min)     | 8-9 (58.5 min)    | 10-11 (71.5 min)  |
  | 95             | 8-9 (58.5 min)   | 9-10 (65 min)     | 11-12 (78 min)    |
  | 111            | 9-10 (65 min)    | 11-12 (78 min)    | 13-14 (91 min)    |
- A judge's stops are written in walking order (`position` 1, 2, 3, ...). A run
  that crosses the end of a pass wraps from the last seat back to the first.
- All judges judge at the same time. They start at different seats, and
  because the passes are offset, no two judges are at the same seat in the
  same round because judges move at the exact same pace (one stop per round). 
  With 6 stops each, the room is done in 6 rounds.
- Sections cover every active seat whether or not a team shows up. An empty
  seat is on the team; the judge reports it absent.
- Auto-assign can be re-run (it replaces the plan) until judging starts.

Example, 70 tables with one seat each and 35 judges:

```
J1 [1-6]   J2 [7-12]  ...  J11 [61-66]  J12 [67-70, 1-2]
J13 [3-8]  J14 [9-14] ...  J23 [63-68]  J24 [69-70, 1-4]
J25 [5-10] J26 [11-16] ... J35 [65-70]
Table 1 is judged by J1, J12 and J24.
```

## Judges who know a team

There is no automatic conflict check (decided against: too much complexity
for the day). If a judge knows a team personally, an organizer fixes it by
hand before judging starts: swapping the team with a team at a different seat 
after confirming that the judges assigned to each seat do not know their new teams.

## Judging starts

Judging has started once any stop is `in_progress`, `done` or `team_absent`.
After that, table setup, seating and auto-assign are locked; only the day-of
fixes below are allowed.

## A judge at a seat

A judge only ever works on their **current stop**: the stop they have
`in_progress`, or else their first `assigned` stop in walking order
(`position`). They can't start, score or report any other stop, and they can't
touch another judge's stops. The judge app shows only the current stop, and
the server refuses a request for any other stop.

When a judge arrives at their current seat, the app shows the seat (`Table 4`,
or `Table 4 (seat 1)` at a split table) and the team seated there. The judge then does one of:

1. **Judge the team** (`startStop`): the stop goes `assigned` -> `in_progress`
   and the seat shows `being_judged`. A judge has at most one stop
   `in_progress`.
2. **Score and submit** (`submitStop`): writes the `team_mark` and the stop
   goes to `done`. Submitting straight from `assigned` is allowed (for
   example, if the start request failed while offline).
3. **Team not here** (`reportAbsent`): the stop goes to `team_absent`. This is
   final: the team is disqualified (see below).
4. **Seat already reported absent**: if another judge already reported the
   team absent, this judge's stop there was closed as `team_absent` at that
   moment, so it is no longer their current stop. The app shows that the team
   was reported absent; the judge takes the break for this round and moves on
   to their next stop once the round ends.

Start, submit and absent all send the `teamId` the judge's screen showed. If a
different team is seated there now, the request is refused and the judge's
list refreshes.

After the last stop, the judge app moves through its own stages (on the
device, not in the engine): **re-score** (go back through every team the judge
scored, now with project links, and edit their own marks with
`editTeamMark`), **final** (review all scores), then **submitted** (scores
locked in the app; the comparison with other judges is shown).

## A stop's lifecycle

```
assigned --start--> in_progress --submit--> done        (team_mark written)
    |                    \--------absent--> team_absent
    \--organizer cancels--> cancelled
```

- A judge has at most one stop `in_progress` at a time.
- **Absence is final.** The first absent report at a seat disqualifies the
  team seated there: the seat has a `team_absent` stop from then on (the seat
  is locked, so the team can't be moved away from it). At the same moment,
  every other open stop for that team (`assigned` or `in_progress`) is marked
  `team_absent`, which counts as closed. Judges keep moving at the same pace:
  when they reach that seat they see the `team_absent` status and take a
  break. So once a team is reported absent, no stop at its seat is ever
  `in_progress`, and no endpoint gives the seat a new stop.
  A team that shows up late stays disqualified; there is no undo. The ranking leaves
  out teams whose seat has a `team_absent` stop, even marks given before the report.
- Submitting writes the `team_mark` (score + breakdown) for the team seated at
  the seat and marks the stop `done` in one transaction.
- Start and submit also send the `teamId` the judge's screen showed. If a
  different team is seated there now (an organizer swapped them in the
  meantime), the request is refused so the score can't land on the wrong team;
  the judge refreshes and scores the team that's there.
- Score format (from the judge app): `score` 0-10, plus
  `score_breakdown = { ratings: { criterionId: 0-10 in half steps }, notes?, superLike? }`.
- Organizers deleting a mark reopens its stop (`done` -> `assigned`), except
  at a seat reported absent.

## Seat live status

`judging_seat.status` is kept in sync by a Postgres trigger on
`judging_assignment` and `team.judging_seat_id`:

| Status         | Rule (first match wins)                                   |
| -------------- | --------------------------------------------------------- |
| `empty`        | No team seated                                            |
| `being_judged` | A stop at the seat is `in_progress`                       |
| `waiting`      | A stop is still `assigned`, or the seat has no stops yet  |
| `finished`     | Every stop is `done`, `team_absent` or `cancelled`        |

## Day-of fixes (organizers)

- **Swap two teams' seats** (`swapTeams`; moves each team into the other's
  judges' sections). Locked once either seat has a stop in progress or
  finished.
- **Move a team** to an empty active seat (`moveTeam({ teamId, seatId })`, same
  lock).
- **Switch a table on or off** (`toggleTable({ tableNumber, isActive })`):
  both seats. Turning a table back on turns both seats on.
- **Switch seat 2 on or off** (`toggleSecondSeat({ tableNumber, isActive })`):
  whether the table can take a second team. Refused while seat 1 is off.
  Switching off a seat 2 that doesn't exist yet keeps seating from ever
  splitting that table.
- A seat with a team can't be switched off; move the team first. After
  judging starts, a seat with stops can't be switched off either.
- **Mark a judge as a no-show** (`setJudgeNoShow({ judgeId, noShow })`), or
  undo it. No-show judges get no section from auto-assign and can't receive
  hand-offs or top-ups. Before judging starts, marking a judge who has stops
  clears the plan; after it starts, hand their stops off first.
- **Hand off a judge:** a judge who leaves gives all their unfinished stops to
  another judge in one action. Refused if the receiving judge already has one
  of those seats or has already scored a team seated at one.
- **Add a seat to a judge** (`addSeatToJudge({ judgeId, seatId })`): top-up
  when a seat needs another score; the seat goes to the end of that judge's
  list. Refused for a seat reported absent.
- **Cancel a stop**, or **mark a team absent**.
- Judges added after auto-assign are **floaters** (no stops) until auto-assign
  is re-run or an organizer adds seats to them.

## Reads

- Organizers (`getProgress`): table setup and settings, every seat with its
  table number, team, status and judges done of 3, every judge's stops,
  floaters, totals by status.
- Judges (`getMyStops`): their stops in walking order, each with its seat
  (table number, seat, grid position), seated team, status (`team_absent` when
  the team was reported absent) and their score if given, plus the current
  stop (`currentStopId`) and the one after it (`nextStopId`).
- Hackers (`getMyJudging`): their seat (table number, grid position), and
  "N of 3 judges done", and whether the team was reported absent (`absent`).

## Cheat check

The cheat-check sweep starts automatically once judging is complete: at least
one stop exists and every stop is `done`, `team_absent` or `cancelled`.
Organizers can still start a sweep by hand.

## Normalization

`judging.admin.getLatestRanking` computes each team's normalized score from
`team_mark` at read time (regular-round marks from organizer-type judges). The
results page reads the in-database normalization (`judging_team_scores`).
Both leave out teams whose seat has a `team_absent` stop.

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

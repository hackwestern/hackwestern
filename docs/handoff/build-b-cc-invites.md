# Track B handoff: coffee chat session invites

Branch `build-b-cc-invites`. Hacker invites for the confirmed coffee chat schedule: one invite per seat, round 1 at the Friday Send, then automatic 30-minute rounds on Saturday from 10 AM. A declined seat goes to the next hacker at once. Invites are `coffee_chat` rows (migration 0059 columns), so the old Slack Accept / Decline, /live and notification center all work on them.

## Files

- `src/lib/coffee-chat-invites.ts`: the pure planner. Seat times (partial sessions too), round timing, `planInviteRound`, `reconfirmExpiresAt`. Tests: `src/lib/coffee-chat-invites.test.ts`.
- `src/server/api/utils/coffee-chat-invites.ts`: server side. Reads rows, runs the planner, writes invites, reconciles changes, delivers notices, the delivery sweep, the timed job and its dry run. Tests (PGlite): `src/server/api/utils/coffee-chat-invites.test.ts`.
- `src/server/api/routers/coffee-chat-invites.ts`: `coffeeChatInvites.status` and `coffeeChatInvites.runRoundNow` (organizers only). Status lists only live invites (waiting or accepted) and counts `unfilled` seats (no eligible hacker left), which the board shows as a problem flag. It's 0 while invites are off (kill switch, previews; `dry` counts as on) or the run of show is unreadable, and for a chat too close to offer any more (under 10 minutes before its last call).
- `src/server/api/utils/coffee-chat-respond.ts`: Accept / Decline (Slack button, /live and the email's link to /live all land here). Declining a session invite refills the seat in the same transaction (see `refillSeatsAfterNo`).
- `src/server/api/utils/coffee-chat-invite-text.ts` and `src/content/coffee-chat-invites.ts`: the words of a session invite (time, sponsor, rep, room and building, answer-by).
- `drizzle/0060_coffee_invite_notified.sql` (this branch only): `coffee_chat.notified_at` (timestamp(3), nullable): when the DM or email about the current invite went out. Snapshot `drizzle/meta/0060_snapshot.json` (prevId = 0059's id). Applied to the local `hackwestern_spon` DB.
- `.github/workflows/coffee-invite-rounds.yml` and `scripts/run-coffee-invite-round.ts`: the Saturday round ticker (see Timed rounds).
- Small changes to the old flow: `effectiveCoffeeChatStatus` uses the row's `expiresAt` when it has one (`src/lib/coffee-chat-requests.ts`), and the selects that feed it read `expiresAt`. Every expiry check goes through one helper, `chatExpiresAt(row)`: the row's `expires_at` when set, else 20 minutes before the chat (coffee-chat-capacity, coffee-chat-holds, sponsor-organizer (one line), room-blocks, the `offer` reply in coffee-chat-requests). The Slack DM and offer email switch to session copy when the row has a `placementId`. `loadCoffeeChatNotices(ids, conn)` loads several notices, also inside a transaction. `coffeeChatRequests.mine` kicks a due round.
- One Eastern offset: `COFFEE_CHAT_UTC_OFFSET`, exported from `src/lib/coffee-chat-requests.ts`, used by the planner and the invite text.
- `src/env.js`: `COFFEE_INVITES_ENABLED` (kill switch) and `VERCEL_ENV`.

## Contract for track C (board Send) and track A (sponsor changes)

All write functions take a transaction, write rows only, and return `jobs`. Deliver the jobs after the commit:

```ts
import {
  sendRoundOneInvites,
  reconcileInvitesAfterChange,
  deliverInviteNotices,
} from "~/server/api/utils/coffee-chat-invites";
```

### `sendRoundOneInvites(tx, { sponsorIds?, now? }) => Promise<RoundResult>`

Call it inside Send's `boardWrite`, after the placements are marked `sent`. Then, after the transaction, `await deliverInviteNotices(result.jobs)`. (If that delivery is cut off, the sweep sends what's missing.)

- Invites only for placements with status `sent` (all sponsors, or `sponsorIds`).
- Takes the board lock itself (same `BOARD_LOCK_KEY`, re-entrant, so it's fine inside `boardWrite`).
- Safe to call again: it only fills seats that have no live invite.
- Before Sat 10:00 AM it's round 1 (answer by Sat 10:00 AM, or the chat's last call if earlier). Pressed later, it runs as the current Saturday round.
- Inserts seat by seat. If a hacker books an old-flow chat at the same time while the round runs (the unique index on one live chat per hacker and slot), only that insert is skipped and the seat goes to the next candidate; the round isn't rolled back.
- `RoundResult.status`: `"ok"` (with `created` ids, `unfilled` seats (no eligible hacker left, or too close to the chat), `jobs`), `"disabled"` (kill switch off: nothing written), `"nothingSent"`, `"workshopsUnknown"` (run of show unreadable: nothing written; Send already refuses in that case).

Suggested Send return value: replace `invites: "not-built"` with `{ status, created: created.length, unfilled }` and the delivery counts.

### `reconcileInvitesAfterChange(tx, sponsorId, { now?, removingPlacementIds? }) => Promise<ReconcileResult>`

Call it in the same transaction as any change to a sponsor's placements or preferences once invites may exist: a placement moved (session or room), a rep's chats changed, hackers per chat changed, a placement or rep removed.

- After the change, except deletes: for a deleted placement or rep, call it **before** the delete and pass the placement ids in `removingPlacementIds`. The delete cascades the invite rows, so the function snapshots the notices first.
- Every current placement of the sponsor counts, draft or sent (a moved chat goes back to draft but its hackers were already invited).
- Same chat, same time and length, within the seats: kept. Room or rep changed: back to pending with a new answer-by time (reconfirm).
- Chat gone or over its seats: moved to an open seat of the same sponsor (same placement first, then earliest) where the hacker is free, back to pending (reconfirm). No seat: cancelled. Accepted hackers keep seats before pending ones.
- New answer-by: Sat 10 AM on Friday night; on Saturday the current round's close or 30 minutes from now, whichever is later; capped at the chat's last call. If that leaves under 10 minutes, the details change, their answer stays, and they get a "moved" notice.
- A re-asked invite is marked unsent (`notified_at` null), so the sweep sends it if the caller's delivery doesn't.
- Seats freed or added here go to the next candidates at once (`refillSeatsAfterNo`, never on a placement in `removingPlacementIds`). Their `offered` notices are in `jobs` with the rest.
- `ReconcileResult`: `{ status, kept, reconfirm, cancelled, jobs }`.

### `refillSeatsAfterNo(tx, sponsorId, { now?, excludePlacementIds? }) => Promise<InviteJob[]>` (new)

Offers a sponsor's empty seats to the next candidates inside the caller's transaction: the current round for that one sponsor. `respondToCoffeeChat` calls it after a decline of a session invite (it takes the board lock before the row lock, the order a round uses), and `reconcileInvitesAfterChange` calls it at the end. Deliver the jobs after the commit; `respondToCoffeeChat` does this itself, waiting at most its notify cap (Slack needs an answer within 3 s) and leaving the rest to `waitUntil` and the sweep.

- Runs in a savepoint: if it fails, the decline still commits, it logs, and the next round fills the seat.
- Nothing while the kill switch is off, and nothing after the day's last chat starts.

### `deliverInviteNotices(jobs) => Promise<{ slack, email, failed, skipped }>`

Slack DM first (Accept / Decline buttons, value = chat id, handled by the existing `/api/slack/interactions`). Email only when there's no DM to send (DM status `skipped-no-token` or `not-found`), never after a `failed` DM. Never throws. Sends nothing while the kill switch is off. Rewrites the Coffee Chat Bookings mirror once at the end (only when sheet writes are on). Runs 4 at a time.

Changed after review (same signature and result shape): invites (`offered`, `reconfirm`) are claimed first (`UPDATE … SET notified_at = now() WHERE id = … AND notified_at IS NULL AND status = 'pending' AND not expired RETURNING`). One already claimed is counted as `skipped` and not sent again. If nothing went out (failed, threw, no channel), the claim is cleared so the sweep retries it. `cancelled` and `roomMoved` notices aren't claimed or retried, as before.

### `deliverUnnotifiedInvites(now?) => Promise<DeliveryResult>` (new)

The delivery sweep: sends every pending, unnotified, unexpired session invite, claiming each first. Runs after every timed round, from the traffic kick, and from the workflow. A re-asked invite retried here goes out with the plain invite copy (same details and answer-by). `countUnnotifiedInvites(now?)` counts them (for the dry run).

### Timed job: `runDueInviteRounds(now?)`, `previewDueInviteRound(now?)`, `kickDueInviteRounds()`

- `runDueInviteRounds` delivers through the sweep. New status `"over"`: returned once the day's last chat has started (4:45 PM), before any lock or board read.
- `previewDueInviteRound` (new): the dry run. Plans the current round in a transaction that is always rolled back (ignores the kill switch and the throttle). Returns counts: `{ status, round, invites, unfilled }`.
- `kickDueInviteRounds()` now returns `void` and doesn't wait: it starts the round and the sweep with `waitUntil` (from `@vercel/functions`, already a dependency). Throttled to once a minute per server. Callers drop the `await`.

## Safety gate

- Nothing is invited, DMed or emailed for a sponsor until their placements are `sent`.
- `COFFEE_INVITES_ENABLED`: `"1"` forces on, `"0"` forces off. Unset = on only when `VERCEL_ENV === "production"`, so not on preview deploys, a local `next start`, or a script. Tests are off unless a test sets it. Covered by "the kill switch is off in tests by default", "the timed job sends nothing when nothing is sent" and "on by default only on the Vercel production deploy".
- Slack needs `SLACK_BOT_TOKEN` and email needs Mailjet keys, as before. Dev has neither.

## Timed rounds

Rounds 2+ run when something triggers them:

1. **The workflow** `.github/workflows/coffee-invite-rounds.yml`: every 10 minutes on Sat Nov 21 2026, 9 AM to 5 PM Eastern (its first useful tick is 10:00, when round 2 opens) (14:00 to 22:00 UTC), plus manual runs. It runs `scripts/run-coffee-invite-round.ts`: `runDueInviteRounds()`, then `deliverUnnotifiedInvites()`, with the Production environment's secrets under the names `src/env.js` reads: `DATABASE_URL`, `SLACK_BOT_TOKEN`, `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `RUN_OF_SHOW_SHEET`, `RUN_OF_SHOW_SHEETS_CLIENT_EMAIL`, `RUN_OF_SHOW_SHEETS_PRIVATE_KEY` (or the `SPONSOR_SHEETS_*` fallback). Add any that are missing to the Production environment first. Without the run of show, a round does nothing (`workshopsUnknown`).
   - **A dry run by default**: counts only. Nothing is written (the plan runs in a rolled-back transaction) and nothing is sent.
   - **To arm it**: `gh variable set COFFEE_ROUNDS_LIVE --body true`. To disarm: `gh variable set COFFEE_ROUNDS_LIVE --body false`. It is not armed.
   - Live runs also set `SHEET_WRITES=1`, so the Bookings mirror updates as it does from the app.
   - Logs show counts only. The script drops the db's `Query:` log lines, which carry ids and rep names.
   - Locally: `npx tsx scripts/run-coffee-invite-round.ts --now=2026-11-21T11:05:00-05:00` previews any time (dry runs only).
2. **Traffic**: an organizer loading `coffeeChatInvites.status` or a hacker loading `coffeeChatRequests.mine` (/live) kicks a round and the sweep without waiting.
3. **`coffeeChatInvites.runRoundNow`**: the manual safety net.

A run skips when another run holds the board lock. It's a no-op before Sat 10:00 AM and after 4:45 PM, and only fills empty seats. That includes seats whose invite expired: the round writes them back as expired, then offers them to the next hacker. A late or missed round is just the current round, with its own answer-by times (rule 2).

## Delivery

Each session invite's DM or email goes out once: claimed before the send (`notified_at`), released when nothing went out. Every timed round ends with the sweep, and the workflow runs it every 10 minutes, so a failed or cut-off send is retried and nothing is sent twice. Known gap: if a server dies between the claim and the send, that row stays claimed and isn't retried. The hacker still sees the invite on /live and in the notification center.

## Rules

1. **Answer-by lead.** An invite must be answered by 20 minutes before the chat (35 for Ivey: the old flow's 20 plus the 15-minute walk, as in the "one coffee chat deadline" decision and the router TODO). Round 1 closes at Sat 10:00 AM or that last call, whichever is first, so a 10:00 AM chat must be answered by 9:40.
2. **Rounds 2+ answer-by (review fix R1).** The round's close or 30 minutes from when the round actually ran, whichever is later, capped at the chat's last call. Under 10 minutes to answer: the seat waits for a later round. So a round run late (11:25 for 11:00 to 11:30) still gives 30 minutes (until 11:55), and a missed round doesn't skip seats. Round 2 opens at 10:00, as round 1 closes, and runs to 10:30; then a round every 30 minutes. Round 2 can offer a 10:30 near chat (answer by 10:10) or 10:45 (by 10:25). 10:00 and 10:15 chats (and 10:30 in Ivey) stay round 1 only.
3. **Declines re-send at once (Jazz, 2026-11-19, replaces D5).** A decline offers the seat to the next candidate in the same transaction, with the current round's answer-by: Sat 10:00 AM for a Friday-night decline, else 30 minutes (or the round's close if later), capped at the chat's last call. An expired invite's seat goes out at the next round tick (the workflow runs every 10 minutes, plus traffic). Sponsor changes refill what they free the same way.
4. **No second ask.** A hacker who declined a sponsor or let its invite expire isn't asked by that sponsor again. A cancelled invite doesn't count against them.
5. **Order.** Tiers run across all sponsors: every sponsor's scanned hackers first, then shortlists, then interested hackers. Inside a tier, sponsors take turns one hacker at a time. Scanned = earliest scan first; shortlist = order picked; interested = their rank of the sponsor. Each hacker gets the earliest seat they're free for.
6. **Partial sessions (D4).** Only whole chats that end by the workshop buffer start (setup or start minus 15 minutes; the window runs to end plus 15). For Sun Life to get 1:00 to 1:30, the run of show's setup block has to start at 1:45. If setup is at 2:00, the rule gives 1:00, 1:15 and 1:30 (1:00 to 1:45).
7. **Chats per placement.** A rep's sent placements fill in time order up to their chats wanted (6 chats at 15 minutes = 4 + 2), each holding only the chats that fit.
8. **Rooms on the row.** Invite rows store `"Rm 2241"`, matching old rows and /live.
9. **Cap (D1).** A hacker holds at most 2 live (pending or accepted) chats at a time, counting both flows (`MAX_LIVE_CHATS_PER_HACKER`).
10. **No open seats shown.** Every seat is filled while an eligible hacker is left. The planner is greedy but maximal: each hacker tries every seat of the sponsor, so a seat stays empty only when no remaining candidate can take it. Sponsor and organizer screens show only Accepted and Waiting ("N accepted · N waiting"); declined and expired session invites are left out of the status endpoint, the sponsor's chat list, the organizer's chat list and Your chats. A seat no one could take shows on the board row as "1 seat couldn't be filled (no one free)". The hacker's own /live and notification center still show their own answers.

## Review fixes (2026-11-19)

- R1 late rounds: rule 2, with tests for a late round and a missed one.
- R2 the traffic kick no longer waits (`waitUntil`); the sweep guarantees delivery.
- R3 an old-flow booking racing the round skips that seat, not the round (tested).
- R4 default-on only when `VERCEL_ENV === "production"`; `"1"` / `"0"` force it (tested).
- R5 one expiry helper, `chatExpiresAt(row)`, at every listed call site. The capacity, holds, sponsor-organizer and room-blocks sites check a slot time, not a row, so they pass `{ slotTime }` (or the slot) and behave as before; the `offer` reply passes its row.
- R6 email only after a `skipped-no-token` or `not-found` DM, never after `failed` (change notices too).
- R7 `runDueInviteRounds` returns `"over"` after the day's last chat starts, before the lock or the board read.
- R8 one Eastern offset, `COFFEE_CHAT_UTC_OFFSET`.

## Open questions for Jazz

- **Sun Life's setup time:** see rule 6.

## Not done here (other tracks)

- Wire `sendRoundOneInvites` into `coffeeChatSessions.send`, and `reconcileInvitesAfterChange` into `movePlacement`, `removePlacement`, `applyFix` (move/remove) and the sponsor-side setup writes (tracks C and A).
- A UI for `coffeeChatInvites.status` on the organizer board.
- Each sponsor's confirmed schedule to their primary contact (the other half of the Send TODO).
- Migration 0060 lives on this branch only: merge it with track B, and renumber if another branch takes 0060 first.

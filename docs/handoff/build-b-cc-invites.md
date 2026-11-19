# Track B handoff: coffee chat session invites

Branch `build-b-cc-invites`. Hacker invites for the confirmed coffee chat schedule: one invite per seat, round 1 at the Friday Send, then automatic 30-minute rounds on Saturday. Invites are `coffee_chat` rows (migration 0059 columns), so the old Slack Accept / Decline, /live and notification center all work on them.

## Files

- `src/lib/coffee-chat-invites.ts`: the pure planner. Seat times (partial sessions too), round timing, `planInviteRound`, `reconfirmExpiresAt`. Tests: `src/lib/coffee-chat-invites.test.ts`.
- `src/server/api/utils/coffee-chat-invites.ts`: server side. Reads rows, runs the planner, writes invites, reconciles changes, delivers notices, the timed job. Tests (PGlite): `src/server/api/utils/coffee-chat-invites.test.ts`.
- `src/server/api/routers/coffee-chat-invites.ts`: `coffeeChatInvites.status` and `coffeeChatInvites.runRoundNow` (organizers only).
- `src/server/api/utils/coffee-chat-invite-text.ts` and `src/content/coffee-chat-invites.ts`: the words of a session invite (time, sponsor, rep, room and building, answer-by).
- Small changes to the old flow: `effectiveCoffeeChatStatus` now uses the row's `expiresAt` when it has one (`src/lib/coffee-chat-requests.ts`), and the selects that feed it read `expiresAt`. The Slack DM and offer email switch to session copy when the row has a `placementId`. `loadCoffeeChatNotices(ids, conn)` loads several notices, also inside a transaction. `coffeeChatRequests.mine` kicks a due round.
- `src/env.js`: `COFFEE_INVITES_ENABLED` (kill switch).

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

Call it inside Send's `boardWrite`, after the placements are marked `sent`. Then, after the transaction, `await deliverInviteNotices(result.jobs)`.

- Invites only for placements with status `sent` (all sponsors, or `sponsorIds`).
- Takes the board lock itself (same `BOARD_LOCK_KEY`, re-entrant, so it's fine inside `boardWrite`).
- Safe to call again: it only fills seats that have no live invite and weren't offered this round.
- Before Sat 10:30 AM it's round 1 (answer by Sat 10:00 AM, or the chat's last call if earlier). Pressed later, it runs as the current Saturday round.
- `RoundResult.status`: `"ok"` (with `created` ids, `unfilled` seats, `jobs`), `"disabled"` (kill switch off: nothing written), `"nothingSent"`, `"workshopsUnknown"` (run of show unreadable: nothing written; Send already refuses in that case).

Suggested Send return value: replace `invites: "not-built"` with `{ status, created: created.length, unfilled }` and the delivery counts.

### `reconcileInvitesAfterChange(tx, sponsorId, { now?, removingPlacementIds? }) => Promise<ReconcileResult>`

Call it in the same transaction as any change to a sponsor's placements or preferences once invites may exist: a placement moved (session or room), a rep's chats changed, hackers per chat changed, a placement or rep removed.

- After the change, except deletes: for a deleted placement or rep, call it **before** the delete and pass the placement ids in `removingPlacementIds`. The delete cascades the invite rows, so the function snapshots the notices first.
- Every current placement of the sponsor counts, draft or sent (a moved chat goes back to draft but its hackers were already invited).
- Same chat, same time and length, within the seats: kept. Room or rep changed: back to pending with a new answer-by time (reconfirm).
- Chat gone or over its seats: moved to an open seat of the same sponsor (same placement first, then earliest) where the hacker is free, back to pending (reconfirm). No seat: cancelled. Accepted hackers keep seats before pending ones.
- New answer-by: the current round's close (Sat 10 AM on Friday), or the chat's last call if earlier. If that's already past, the details change and their answer stays, and they get a "moved" notice.
- Seats freed here pass on at the next round.
- `ReconcileResult`: `{ status, kept, reconfirm, cancelled, jobs }`.

### `deliverInviteNotices(jobs) => Promise<{ slack, email, failed, skipped }>`

Slack DM first (Accept / Decline buttons, value = chat id, handled by the existing `/api/slack/interactions`), email only if the DM wasn't sent. Never throws. Sends nothing while the kill switch is off. Rewrites the Coffee Chat Bookings mirror once at the end (only when sheet writes are on). Runs 4 at a time.

## Safety gate

- Nothing is invited, DMed or emailed for a sponsor until their placements are `sent`.
- `COFFEE_INVITES_ENABLED`: `"1"` on, `"0"` off, unset = on only in production. Tests are off unless a test sets it. Covered by "the timed job sends nothing when nothing is sent" and "the kill switch is off in tests by default".
- Slack needs `SLACK_BOT_TOKEN` and email needs Mailjet keys, as before. Dev has neither.

## Timed rounds

There's no cron in the app. Rounds 2+ run lazily, like the old flow's expiry and the task reminders' auto-sync: `runDueInviteRounds()` runs when an organizer loads `coffeeChatInvites.status` or a hacker loads `coffeeChatRequests.mine` (/live). It's throttled to once a minute per server, skips when another run holds the board lock, and is a no-op before Sat 10:30 AM. `coffeeChatInvites.runRoundNow` is the manual safety net.

## Rules I picked (check these)

1. **Answer-by lead.** An invite must be answered by 20 minutes before the chat (35 for Ivey: the old flow's 20 plus the 15-minute walk, as in the "one coffee chat deadline" decision and the router TODO). Round 1 closes at Sat 10:00 AM or that last call, whichever is first, so a 10:00 AM chat must be answered by 9:40.
2. **Rounds 2+ give a full 30 minutes.** A round only offers chats whose last call is at or after the round's close. So round 2 (10:30 to 11:00) offers near chats from 11:20 and Ivey chats from 11:35. 10 to 11 AM chats are only filled by round 1 (as agreed), and so are 11:00 and 11:15 near chats.
3. **Declines wait for the next round.** A decline or expiry in round N isn't refilled until round N+1, even on Friday night. That follows "Round 2 Sat 10:30 for seats still open".
4. **No second ask.** A hacker who declined a sponsor or let its invite expire isn't asked by that sponsor again. A cancelled invite doesn't count against them.
5. **Order.** Tiers run across all sponsors: every sponsor's scanned hackers first, then shortlists, then interested hackers. Inside a tier, sponsors take turns one hacker at a time. Scanned = earliest scan first; shortlist = order picked; interested = their rank of the sponsor. Each hacker gets the earliest seat they're free for.
6. **Partial sessions.** A chat can't overlap the sponsor's workshop window (setup or start minus 15 minutes, to end plus 15). For Sun Life to get 1:00 to 1:30, the run of show's setup block has to start at 1:45. If setup is at 2:00, the rule gives 1:00, 1:15 and 1:30 (1:00 to 1:45).
7. **Chats per placement.** A rep's sent placements fill in time order up to their chats wanted (6 chats at 15 minutes = 4 + 2), each holding only the chats that fit.
8. **Rooms on the row.** Invite rows store `"Rm 2241"`, matching old rows and /live.

## Open questions for Jazz

- **Cap per hacker?** There's no limit on how many sponsors invite one hacker (different times only). A top-ranked hacker could get 5 invites. Want a cap, say 2 live invites?
- **Delivery isn't tracked.** There's no `notified_at` column, so if Slack or Mailjet fails, or a serverless request is cut off mid-delivery, nothing retries and a resend would double-DM. Hackers still see the invite on /live. A `coffee_chat.notified_at` column (shared schema change) would let a retry send only what's missing.
- **Round trigger.** Rounds depend on traffic (organizer board or hackers on /live). Saturday traffic should be plenty, but a cron ping would be more certain. Vercel Hobby crons are daily, so it would need an external pinger and a secret-protected route.
- **Sun Life's setup time:** see rule 6.
- **Friday declines:** fine to leave those seats empty until 10:30 AM (rule 3)?

## Not done here (other tracks)

- Wire `sendRoundOneInvites` into `coffeeChatSessions.send`, and `reconcileInvitesAfterChange` into `movePlacement`, `removePlacement`, `applyFix` (move/remove) and the sponsor-side setup writes (tracks C and A).
- A UI for `coffeeChatInvites.status` on the organizer board.
- Each sponsor's confirmed schedule to their primary contact (the other half of the Send TODO).

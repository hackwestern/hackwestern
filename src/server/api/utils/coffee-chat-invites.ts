/**
 * Coffee chat session invites, server side (track B of the 8-hour build).
 * The planner is pure (src/lib/coffee-chat-invites.ts); this file turns DB
 * rows into its input, writes the invites as coffee_chat rows (so the old
 * flow's Slack Accept / Decline, /live and status rules apply), and sends
 * the notices. Contract for callers: docs/handoff/build-b-cc-invites.md.
 *
 * Safety gate (Jazz, 2026-11-19): nothing is invited, DMed or emailed until
 * an organizer has pressed Send for that sponsor (placements with status
 * "sent"), and never while the COFFEE_INVITES_ENABLED kill switch is off
 * (off by default outside production, and in tests unless a test sets it).
 *
 * Timed rounds: rounds 2+ run when triggered: every 10 minutes on Saturday
 * by .github/workflows/coffee-invite-rounds.yml (scripts/
 * run-coffee-invite-round.ts), by traffic (the organizer invite status
 * query, the hacker's /live chats query, without waiting for it), and by an
 * organizer "run now" button. A round is idempotent: re-running it only
 * fills empty seats (no live invite).
 *
 * No open seats (decision 2026-11-19, "Declines re-send at once…"): a
 * decline offers the seat to the next candidate in the same transaction
 * (refillSeatsAfterNo, from respondToCoffeeChat), a sponsor change refills
 * what it frees (reconcileInvitesAfterChange), and every round refills
 * expired seats, all with the current round's answer-by time.
 *
 * Delivery: a session invite's DM or email is sent once. Each row is
 * claimed (notified_at set) before its send and released (back to null) if
 * nothing went out, so the next sweep (deliverUnnotifiedInvites, run after
 * every timed round and by the workflow) retries it.
 */
import { waitUntil } from "@vercel/functions";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { env } from "~/env";
import { admittedStatuses } from "~/lib/admission";
import {
  LAST_CHAT_STARTS_AT,
  chatKey,
  currentRound,
  isFinalCallInvite,
  planInviteRound,
  reconfirmExpiresAt,
  repChatStarts,
  type BusyChat,
  type InviteSource,
  type PlanChat,
  type PlanInput,
  type PlannedInvite,
} from "~/lib/coffee-chat-invites";
import {
  coffeeChatTimeOf,
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import {
  COFFEE_SESSIONS,
  buildingOf,
  minutesOfClock,
  type Building,
} from "~/lib/coffee-chat-sessions";
import {
  sendCoffeeChatChangeEmail,
  sendCoffeeChatOfferEmail,
} from "~/server/api/utils/coffee-chat-email";
import { inviteRoomLabel } from "~/server/api/utils/coffee-chat-invite-text";
import {
  errorMessage,
  loadCoffeeChatNotices,
  type CoffeeChatNotice,
} from "~/server/api/utils/coffee-chat-notify";
import {
  BOARD_LOCK_KEY,
  loadBoardState,
  type BoardState,
} from "~/server/api/utils/coffee-chat-sessions-board";
import { mirrorCoffeeInvitesLater } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import { mirrorCoffeeChats } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatLine,
  coffeeChats,
  sponsorInterests,
  sponsorScans,
  sponsorShortlists,
  users,
} from "~/server/db/schema";
import { sendCoffeeChatDm } from "~/server/slack/coffee-chat-dm";

type Db = typeof db;
export type InviteTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | InviteTx;

/**
 * The kill switch: COFFEE_INVITES_ENABLED "1" forces on, "0" forces off.
 * Unset = on only on the Vercel production deploy (VERCEL_ENV), so never
 * on preview deploys, a local `next start` or a script. Tests are off
 * unless they set COFFEE_INVITES_ENABLED=1 themselves.
 */
function invitesFlag(): string | undefined {
  return process.env.COFFEE_INVITES_ENABLED ?? env.COFFEE_INVITES_ENABLED;
}

/**
 * Whether rounds create invites. "dry" also counts: invites are planned and
 * saved (so /live, the board and Your chats show them) but nothing is sent;
 * see invitesDeliveryLive. Use "dry" for local walkthroughs.
 */
export function invitesEnabled(): boolean {
  const flag = invitesFlag();
  if (flag === "1" || flag === "dry") return true;
  if (flag === "0") return false;
  if (process.env.VITEST) return false;
  return (process.env.VERCEL_ENV ?? env.VERCEL_ENV) === "production";
}

/** Whether invite messages really go to Slack or email ("dry" = never). */
export function invitesDeliveryLive(): boolean {
  return invitesFlag() !== "dry" && invitesEnabled();
}

/** What a hacker hears about: a new invite, a changed one, or a cancel. */
export type InviteJob = {
  event: "offered" | "reconfirm" | "cancelled" | "roomMoved";
  notice: CoffeeChatNotice;
};

/**
 * Same lock as every board write, so placements can't move under a round.
 * Re-entrant within a transaction. Take it before locking any coffee_chat
 * row (a round updates rows while holding it).
 */
export async function lockBoard(tx: InviteTx): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${sql.raw(BOARD_LOCK_KEY)})`,
  );
}

async function tryLockBoard(tx: InviteTx): Promise<boolean> {
  const rows = await tx.execute<{ ok: boolean }>(
    sql`select pg_try_advisory_xact_lock(${sql.raw(BOARD_LOCK_KEY)}) as ok`,
  );
  const list = Array.isArray(rows)
    ? rows
    : (rows as { rows: { ok: boolean }[] }).rows;
  return !!list[0]?.ok;
}

// ---------------------------------------------------------------------------
// Seats from placements
// ---------------------------------------------------------------------------

/** One chat (seats at one time with one rep), with what the rows store. */
export type LayoutChat = PlanChat & {
  room: string;
  repName: string;
  repId: string;
};

/**
 * Every chat of the given placements: each rep's placements in time order,
 * as many chats as fit (partial sessions keep only the chats that fit
 * outside the workshop window) up to the rep's wanted chats.
 */
export function layoutOf(
  state: Pick<BoardState, "placements" | "sponsors" | "sched">,
  include: (p: BoardState["placements"][number]) => boolean,
): LayoutChat[] {
  const byRep = new Map<string, BoardState["placements"]>();
  for (const p of state.placements) {
    if (!include(p)) continue;
    byRep.set(p.repId, [...(byRep.get(p.repId) ?? []), p]);
  }
  const out: LayoutChat[] = [];
  for (const [repId, placements] of byRep) {
    const sponsorId = placements[0]!.sponsorId;
    const sponsor = state.sponsors.find((s) => s.id === sponsorId);
    const rep = sponsor?.reps.find((r) => r.id === repId);
    const sched = state.sched.find((s) => s.id === sponsorId);
    if (!sponsor || !rep || !sched) continue;
    const withSession = placements.flatMap((p) => {
      const session = COFFEE_SESSIONS.find((s) => s.id === p.sessionId);
      return session ? [{ p, session }] : [];
    });
    const starts = repChatStarts(
      withSession.map(({ p, session }) => ({ id: p.id, session })),
      rep.chatsWanted,
      sponsor.chatMinutes,
      sched.workshops,
    );
    for (const { p } of withSession) {
      const building: Building = buildingOf(p.room) ?? "near";
      for (const start of starts.get(p.id) ?? []) {
        out.push({
          placementId: p.id,
          sponsorId,
          start,
          minutes: sponsor.chatMinutes,
          building,
          seats: sponsor.hackersPerChat,
          live: 0,
          room: inviteRoomLabel(p.room),
          repName: rep.name,
          repId,
        });
      }
    }
  }
  return out.sort(
    (a, b) => a.start - b.start || a.placementId.localeCompare(b.placementId),
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type ChatRow = {
  id: string;
  sponsorId: string;
  userId: string;
  slotTime: string;
  durationMinutes: number;
  status: CoffeeChatStatus;
  expiresAt: Date | null;
  placementId: string | null;
  round: number | null;
  room: string | null;
  repName: string | null;
  createdAt: Date;
};

export async function loadChatRows(conn: Conn): Promise<ChatRow[]> {
  return conn
    .select({
      id: coffeeChats.id,
      sponsorId: coffeeChats.sponsorId,
      userId: coffeeChats.userId,
      slotTime: coffeeChats.slotTime,
      durationMinutes: coffeeChats.durationMinutes,
      status: coffeeChats.status,
      expiresAt: coffeeChats.expiresAt,
      placementId: coffeeChats.placementId,
      round: coffeeChats.round,
      room: coffeeChats.room,
      repName: coffeeChats.repName,
      createdAt: coffeeChats.createdAt,
    })
    .from(coffeeChats)
    .orderBy(asc(coffeeChats.createdAt), asc(coffeeChats.id));
}

/**
 * Write "expired" back for pending rows past their answer-by time, so the
 * DB's one-live-chat-per-slot index doesn't block the next invite. Returns
 * the rows with their effective status.
 */
export async function sweepExpired(
  tx: InviteTx,
  rows: ChatRow[],
  now: Date,
): Promise<ChatRow[]> {
  const expired = rows
    .filter(
      (r) =>
        r.status === "pending" &&
        effectiveCoffeeChatStatus(r, now) === "expired",
    )
    .map((r) => r.id);
  if (expired.length) {
    await tx
      .update(coffeeChats)
      .set({ status: "expired" })
      .where(
        and(
          inArray(coffeeChats.id, expired),
          eq(coffeeChats.status, "pending"),
        ),
      );
  }
  const gone = new Set(expired);
  return rows.map((r) =>
    gone.has(r.id) ? { ...r, status: "expired" as const } : r,
  );
}

export const isLive = (r: ChatRow) =>
  r.status === "pending" || r.status === "accepted";
const startOf = (r: ChatRow) => minutesOfClock(r.slotTime) ?? 0;
export const busyOf = (r: ChatRow): BusyChat => ({
  userId: r.userId,
  sponsorId: r.sponsorId,
  start: startOf(r),
  minutes: r.durationMinutes,
});
const atChat = (
  r: ChatRow,
  c: { placementId: string; start: number; minutes: number },
) =>
  r.placementId === c.placementId &&
  startOf(r) === c.start &&
  r.durationMinutes === c.minutes;

/**
 * "sponsorId|userId" pairs an organizer removed from one of that sponsor's
 * chats (coffee_chat_line kind "removed"): never offered that sponsor again,
 * like a decline.
 */
export async function loadRemovedPairs(conn: Conn): Promise<Set<string>> {
  const rows = await conn
    .select({ sponsorId: coffeeChatLine.sponsorId, userId: coffeeChatLine.userId })
    .from(coffeeChatLine)
    .where(eq(coffeeChatLine.kind, "removed"));
  return new Set(rows.map((r) => `${r.sponsorId}|${r.userId}`));
}

/**
 * Each sponsor's candidates in order: hackers an organizer put first in
 * line (newest first), then scanned (earliest scan first), then the
 * shortlist (order picked), then interested hackers (their rank of the
 * sponsor). Only admitted hackers who agreed to share with sponsors. A
 * hacker can show up in several tiers; the planner and the line keep the
 * first.
 */
export async function loadCandidates(
  conn: Conn,
  sponsorIds: readonly string[],
  now: Date,
): Promise<Map<string, { userId: string; source: InviteSource }[]>> {
  const out = new Map<string, { userId: string; source: InviteSource }[]>();
  if (sponsorIds.length === 0) return out;
  const ids = [...sponsorIds];
  const [front, scans, shortlist, interested, pool] = await Promise.all([
    conn
      .select({
        sponsorId: coffeeChatLine.sponsorId,
        userId: coffeeChatLine.userId,
      })
      .from(coffeeChatLine)
      .where(
        and(
          inArray(coffeeChatLine.sponsorId, ids),
          eq(coffeeChatLine.kind, "front"),
        ),
      )
      .orderBy(desc(coffeeChatLine.createdAt), asc(coffeeChatLine.userId)),
    conn
      .select({
        sponsorId: sponsorScans.sponsorId,
        userId: sponsorScans.userId,
      })
      .from(sponsorScans)
      .where(inArray(sponsorScans.sponsorId, ids))
      .orderBy(asc(sponsorScans.scannedAt), asc(sponsorScans.userId)),
    conn
      .select({
        sponsorId: sponsorShortlists.sponsorId,
        userId: sponsorShortlists.userId,
      })
      .from(sponsorShortlists)
      .where(inArray(sponsorShortlists.sponsorId, ids))
      .orderBy(asc(sponsorShortlists.createdAt), asc(sponsorShortlists.userId)),
    conn
      .select({
        sponsorId: sponsorInterests.sponsorId,
        userId: sponsorInterests.userId,
      })
      .from(sponsorInterests)
      .where(inArray(sponsorInterests.sponsorId, ids))
      .orderBy(
        asc(sponsorInterests.rank),
        asc(sponsorInterests.updatedAt),
        asc(sponsorInterests.userId),
      ),
    // Everyone on the interest list (any sponsor), best rank first: every
    // sponsor's line ends with them, so seats keep filling (Jazz, 2026-11-20).
    conn
      .select({
        userId: sponsorInterests.userId,
        best: sql<number>`min(${sponsorInterests.rank})`.mapWith(Number),
        first: sql<Date>`min(${sponsorInterests.updatedAt})`,
      })
      .from(sponsorInterests)
      .groupBy(sponsorInterests.userId)
      .orderBy(
        sql`min(${sponsorInterests.rank})`,
        sql`min(${sponsorInterests.updatedAt})`,
        asc(sponsorInterests.userId),
      ),
  ]);
  const userIds = [
    ...new Set(
      [...front, ...scans, ...shortlist, ...interested, ...pool].map(
        (r) => r.userId,
      ),
    ),
  ];
  if (userIds.length === 0) return out;
  const eligibleRows = await conn
    .select({ id: users.id })
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(
      and(
        inArray(users.id, userIds),
        eq(users.type, "hacker"),
        eq(applications.agreeShareWithSponsors, true),
        inArray(applications.status, [...admittedStatuses(now.getTime())]),
      ),
    );
  const eligible = new Set(eligibleRows.map((r) => r.id));
  const add = (
    rows: { sponsorId: string; userId: string }[],
    source: InviteSource,
  ) => {
    for (const r of rows) {
      if (!eligible.has(r.userId)) continue;
      out.set(r.sponsorId, [
        ...(out.get(r.sponsorId) ?? []),
        { userId: r.userId, source },
      ]);
    }
  };
  add(front, "organizer");
  add(scans, "scanned");
  add(shortlist, "shortlist");
  add(interested, "interested");
  add(
    ids.flatMap((sponsorId) => pool.map((r) => ({ sponsorId, userId: r.userId }))),
    "anyone",
  );
  return out;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export type RoundResult =
  | {
      status: "disabled" | "workshopsUnknown" | "nothingSent";
      round: number;
      jobs: InviteJob[];
    }
  | {
      status: "ok";
      round: number;
      /** New coffee_chat ids. */
      created: string[];
      /**
       * Seats left empty: no eligible hacker left, or too close to the
       * chat to offer. A problem, not a normal state.
       */
      unfilled: { placementId: string; start: number; open: number }[];
      /** Notices to deliver after the transaction commits. */
      jobs: InviteJob[];
    };

type RoundOpts = {
  round?: number;
  now?: Date;
  sponsorIds?: readonly string[];
  /** Placements about to be deleted: never offered. */
  excludePlacementIds?: readonly string[];
};

/**
 * Run one invite round inside `tx`: one invite per empty seat of every
 * sponsor with sent placements (optionally only `sponsorIds`). Takes the
 * board lock (re-entrant, so it's fine inside boardWrite). Writes rows only;
 * deliver `jobs` with deliverInviteNotices() after the commit.
 */
export async function runInviteRound(
  tx: InviteTx,
  opts: RoundOpts = {},
): Promise<RoundResult> {
  const now = opts.now ?? new Date();
  const round = opts.round ?? currentRound(now);
  if (!invitesEnabled()) return { status: "disabled", round, jobs: [] };
  return writeInviteRound(tx, { ...opts, round, now });
}

/** The round itself, past the kill switch (also run by the dry run). */
async function writeInviteRound(
  tx: InviteTx,
  opts: RoundOpts & { round: number; now: Date },
): Promise<RoundResult> {
  const { round, now } = opts;
  await lockBoard(tx);
  const state = await loadBoardState(tx);
  if (!state.workshopsAvailable)
    return { status: "workshopsUnknown", round, jobs: [] };
  const only = opts.sponsorIds ? new Set(opts.sponsorIds) : null;
  const skip = new Set(opts.excludePlacementIds ?? []);
  // The safety gate: only placements an organizer has sent.
  const layout = layoutOf(
    state,
    (p) =>
      p.status === "sent" &&
      (!only || only.has(p.sponsorId)) &&
      !skip.has(p.id),
  );
  if (layout.length === 0) return { status: "nothingSent", round, jobs: [] };

  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const live = rows.filter(isLive);
  // A seat whose invite was declined or expired is empty again: it goes to
  // the next candidate now, not in a later round.
  // Past a chat's final call, a seat whose last invite ended stays empty.
  for (const c of layout) {
    const here = rows.filter((r) => atChat(r, c));
    c.live = here.filter(isLive).length;
    c.finalSpent = here.filter(
      (r) => !isLive(r) && isFinalCallInvite(r.expiresAt, c.start, c.building),
    ).length;
  }
  const blocked = new Set([
    ...rows
      .filter((r) => r.status === "declined" || r.status === "expired")
      .map((r) => `${r.sponsorId}|${r.userId}`),
    ...(await loadRemovedPairs(tx)),
  ]);
  const sponsorIds = [...new Set(layout.map((c) => c.sponsorId))];
  const candidates = await loadCandidates(tx, sponsorIds, now);
  const order = state.sponsors
    .map((s) => s.id)
    .filter((id) => sponsorIds.includes(id));
  let input: PlanInput = {
    round,
    now,
    chats: layout,
    candidates,
    busy: live.map(busyOf),
    blocked,
    sponsorOrder: order,
  };

  const meta = new Map(layout.map((c) => [chatKey(c), c]));
  const insertOne = async (inv: PlannedInvite) => {
    const c = meta.get(chatKey(inv))!;
    const [row] = await tx
      .insert(coffeeChats)
      .values({
        sponsorId: inv.sponsorId,
        userId: inv.userId,
        room: c.room,
        slotTime: coffeeChatTimeOf(inv.start),
        durationMinutes: inv.minutes,
        status: "pending",
        repName: c.repName,
        placementId: inv.placementId,
        round: inv.round,
        expiresAt: inv.expiresAt,
        source: inv.source,
      })
      // An old-flow booking for this hacker at this time, committed after
      // the rows were read (coffee_chat_user_slot_active_idx): skip it
      // instead of rolling back the whole round.
      .onConflictDoNothing()
      .returning({ id: coffeeChats.id });
    return row?.id ?? null;
  };

  // Insert seat by seat. A clash marks that hacker busy then and plans
  // again, so the seat goes to the next candidate. Each pass adds a busy
  // time the planner then avoids, so this ends.
  const created: string[] = [];
  let plan = planInviteRound(input);
  for (;;) {
    const placed: PlannedInvite[] = [];
    const clashed: PlannedInvite[] = [];
    for (const inv of plan.invites) {
      const id = await insertOne(inv);
      if (id) {
        created.push(id);
        placed.push(inv);
      } else {
        clashed.push(inv);
      }
    }
    if (clashed.length === 0) break;
    input = {
      ...input,
      chats: input.chats.map((c) => ({
        ...c,
        live:
          c.live + placed.filter((i) => chatKey(i) === chatKey(c)).length,
      })),
      busy: [
        ...input.busy,
        ...placed.map((i) => ({ ...i })),
        // The clashing chat's sponsor isn't known: "" blocks the time only.
        ...clashed.map((i) => ({ ...i, sponsorId: "" })),
      ],
      blocked: new Set([
        ...input.blocked,
        ...placed.map((i) => `${i.sponsorId}|${i.userId}`),
      ]),
    };
    plan = planInviteRound(input);
  }
  const notices = await loadCoffeeChatNotices(created, tx);
  return {
    status: "ok",
    round,
    created,
    unfilled: plan.unfilled,
    jobs: notices.map((notice) => ({ event: "offered" as const, notice })),
  };
}

/**
 * For the organizer board's Send (track C): invite hackers for the sent
 * placements, inside Send's transaction. Round 1 on Friday night (answer by
 * Sat 10 AM); sent later, it runs as the current Saturday round. Call it
 * after marking the placements sent, then deliverInviteNotices(result.jobs)
 * after the commit.
 */
export function sendRoundOneInvites(
  tx: InviteTx,
  opts: { sponsorIds?: readonly string[]; now?: Date } = {},
): Promise<RoundResult> {
  return runInviteRound(tx, opts);
}

/**
 * A hacker said no to one of `sponsorId`'s session invites (or a change
 * freed seats): offer the empty seats to the next candidates now, inside
 * the caller's transaction (it should hold the board lock already; taken
 * here too). The new invites get the current round's answer-by: Sat 10 AM
 * on Friday night, else the round's close or 30 minutes from now, capped at
 * the chat's last call. Runs in a savepoint, so a failure here never undoes
 * the caller's write: it logs, and the next round fills the seat. Returns
 * the notices to deliver after the commit (none while invites are off).
 */
export async function refillSeatsAfterNo(
  tx: InviteTx,
  sponsorId: string,
  opts: { now?: Date; excludePlacementIds?: readonly string[] } = {},
): Promise<InviteJob[]> {
  const now = opts.now ?? new Date();
  if (!invitesEnabled() || now >= LAST_CHAT_STARTS_AT) return [];
  try {
    const r = await tx.transaction((sp) =>
      runInviteRound(sp, { ...opts, now, sponsorIds: [sponsorId] }),
    );
    return r.jobs;
  } catch (error) {
    console.error(
      "coffee chat invites: refill after a decline failed",
      errorMessage(error),
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Changes after invites
// ---------------------------------------------------------------------------

export type ReconcileResult = {
  status: "ok" | "workshopsUnknown";
  kept: number;
  reconfirm: number;
  cancelled: number;
  jobs: InviteJob[];
};

/**
 * After a sponsor's placements or preferences change (rep removed, session
 * moved, hackers per chat changed): every live session invite of that
 * sponsor is checked against the chats that exist now.
 * - Still at the same chat (same placement, time, length) and within the
 *   seats: kept. If its room or rep changed, it goes back to pending with a
 *   new answer-by time (reconfirm).
 * - Its chat is gone or over capacity: moved to an open seat of the same
 *   sponsor (same placement first, then the earliest) where the hacker is
 *   free, back to pending with a new answer-by (reconfirm); else cancelled.
 * Accepted invites keep their seat before pending ones. Seats freed here
 * go to the next candidates at once (refillSeatsAfterNo). Call it inside the transaction that made the
 * change, after the change; for a deleted placement or rep, call it BEFORE
 * the delete with `removingPlacementIds` (the delete cascades the rows).
 * Deliver `jobs` after the commit.
 */
export async function reconcileInvitesAfterChange(
  tx: InviteTx,
  sponsorId: string,
  opts: { now?: Date; removingPlacementIds?: readonly string[] } = {},
): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  await lockBoard(tx);
  const state = await loadBoardState(tx);
  if (!state.workshopsAvailable) {
    return {
      status: "workshopsUnknown",
      kept: 0,
      reconfirm: 0,
      cancelled: 0,
      jobs: [],
    };
  }
  const removing = new Set(opts.removingPlacementIds ?? []);
  // Every current placement of the sponsor, draft or sent (a moved or fixed
  // chat stays sent; a draft has no invites, so counting it is harmless).
  const layout = layoutOf(
    state,
    (p) => p.sponsorId === sponsorId && !removing.has(p.id),
  );
  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const mine = rows
    .filter((r) => r.sponsorId === sponsorId && r.placementId && isLive(r))
    .sort(
      (a, b) =>
        Number(b.status === "accepted") - Number(a.status === "accepted") ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.slotTime.localeCompare(b.slotTime) ||
        a.id.localeCompare(b.id),
    );
  const others = rows.filter((r) => isLive(r) && !mine.includes(r));
  const busy = new Map<string, BusyChat[]>();
  for (const r of others)
    busy.set(r.userId, [...(busy.get(r.userId) ?? []), busyOf(r)]);

  const taken = new Map<string, number>();
  const seatFree = (c: LayoutChat) => (taken.get(chatKey(c)) ?? 0) < c.seats;
  const take = (c: LayoutChat) =>
    taken.set(chatKey(c), (taken.get(chatKey(c)) ?? 0) + 1);

  const keep: ChatRow[] = [];
  const changed: { row: ChatRow; chat: LayoutChat }[] = [];
  const displaced: ChatRow[] = [];
  for (const r of mine) {
    const c = layout.find((x) => atChat(r, x));
    if (c && seatFree(c)) {
      take(c);
      if (c.room === r.room && c.repName === r.repName) keep.push(r);
      else changed.push({ row: r, chat: c });
    } else {
      displaced.push(r);
    }
  }
  const moves: { row: ChatRow; chat: LayoutChat }[] = [];
  const cancels: ChatRow[] = [];
  for (const r of displaced) {
    const theirs = busy.get(r.userId) ?? [];
    const fits = (c: LayoutChat) =>
      seatFree(c) &&
      reconfirmExpiresAt(now, c.start, c.building) !== null &&
      !theirs.some(
        (b) => b.start < c.start + c.minutes && c.start < b.start + b.minutes,
      );
    const c =
      layout.find((x) => x.placementId === r.placementId && fits(x)) ??
      layout.find(fits);
    if (!c) {
      cancels.push(r);
      continue;
    }
    take(c);
    moves.push({ row: r, chat: c });
  }

  const round = currentRound(now);
  const jobsOf: { id: string; event: InviteJob["event"] }[] = [];
  for (const { row, chat } of [...changed, ...moves]) {
    const expiresAt = reconfirmExpiresAt(now, chat.start, chat.building);
    await tx
      .update(coffeeChats)
      .set({
        placementId: chat.placementId,
        slotTime: coffeeChatTimeOf(chat.start),
        durationMinutes: chat.minutes,
        room: chat.room,
        repName: chat.repName,
        // Too close to the chat to ask again: keep their answer, tell them.
        // Asked again: unsent, so delivery (or the sweep) sends it.
        ...(expiresAt
          ? {
              status: "pending" as const,
              expiresAt,
              round,
              respondedAt: null,
              notifiedAt: null,
            }
          : {}),
      })
      .where(eq(coffeeChats.id, row.id));
    jobsOf.push({ id: row.id, event: expiresAt ? "reconfirm" : "roomMoved" });
  }
  if (cancels.length) {
    await tx
      .update(coffeeChats)
      .set({ status: "cancelled", respondedAt: now })
      .where(
        inArray(
          coffeeChats.id,
          cancels.map((r) => r.id),
        ),
      );
    for (const r of cancels) jobsOf.push({ id: r.id, event: "cancelled" });
  }
  // Snapshot now: a cancelled row may be deleted with its placement next.
  const notices = await loadCoffeeChatNotices(
    jobsOf.map((j) => j.id),
    tx,
  );
  const byId = new Map(notices.map((n) => [n.chatId, n]));
  // Seats this change freed or added go to the next candidates now (never
  // on a placement about to be deleted).
  const refill = await refillSeatsAfterNo(tx, sponsorId, {
    now,
    excludePlacementIds: [...removing],
  });
  return {
    status: "ok",
    kept: keep.length,
    reconfirm: changed.length + moves.length,
    cancelled: cancels.length,
    jobs: [
      ...jobsOf.flatMap((j) => {
        const notice = byId.get(j.id);
        return notice ? [{ event: j.event, notice }] : [];
      }),
      ...refill,
    ],
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export type DeliveryResult = {
  slack: number;
  email: number;
  failed: number;
  skipped: number;
};

/**
 * Claim an invite's notice: set notified_at if it's still unsent, pending
 * and answerable. Returns the claim time, or null when someone else sent
 * (or is sending) it, or it no longer needs one.
 */
async function claimNotice(chatId: string): Promise<Date | null> {
  const at = new Date();
  const [row] = await db
    .update(coffeeChats)
    .set({ notifiedAt: at })
    .where(
      and(
        eq(coffeeChats.id, chatId),
        isNull(coffeeChats.notifiedAt),
        eq(coffeeChats.status, "pending"),
        or(isNull(coffeeChats.expiresAt), gt(coffeeChats.expiresAt, at)),
      ),
    )
    .returning({ id: coffeeChats.id });
  return row ? at : null;
}

/** Nothing went out: unclaim, so the next sweep retries. */
async function releaseNotice(chatId: string, at: Date): Promise<void> {
  await db
    .update(coffeeChats)
    .set({ notifiedAt: null })
    .where(and(eq(coffeeChats.id, chatId), eq(coffeeChats.notifiedAt, at)));
}

/**
 * One notice: Slack DM first, the email only when there's no DM to send
 * (no Slack token, hacker not on Slack). A failed DM isn't doubled by an
 * email; for invites the next sweep retries it.
 */
async function sendNotice(
  job: InviteJob,
): Promise<"slack" | "email" | "failed" | "skipped"> {
  const n = job.notice;
  if (job.event === "offered" || job.event === "reconfirm") {
    const chat = { ...n, reconfirm: job.event === "reconfirm" };
    const dm = await sendCoffeeChatDm(chat, {}, "offered");
    if (dm === "sent") return "slack";
    if (dm === "failed") return "failed";
    return (await sendCoffeeChatOfferEmail(chat)) ? "email" : "skipped";
  }
  const dm = await sendCoffeeChatDm(n, {}, job.event);
  if (dm === "sent") return "slack";
  if (dm === "failed") return "failed";
  return (await sendCoffeeChatChangeEmail(job.event, n)) ? "email" : "skipped";
}

/**
 * Tell each hacker: Slack DM first (Accept / Decline buttons for invites),
 * the email only when there's no DM to send. Invites ("offered",
 * "reconfirm") are claimed first, so each is sent once even if a round's
 * caller and a sweep deliver it at the same time; one already claimed
 * counts as skipped. Never throws. Nothing is sent while the kill switch
 * is off. The sheet mirror is rewritten once at the end (only when sheet
 * writes are on).
 */
export async function deliverInviteNotices(
  jobs: readonly InviteJob[],
  opts: { concurrency?: number } = {},
): Promise<DeliveryResult> {
  const result: DeliveryResult = { slack: 0, email: 0, failed: 0, skipped: 0 };
  if (jobs.length === 0) return result;
  if (!invitesDeliveryLive()) {
    // Counts only: no names or ids in logs.
    if (invitesEnabled()) console.info(`[coffee invites] dry run: ${jobs.length} notice(s) not sent`);
    result.skipped = jobs.length;
    return result;
  }
  let cursor = 0;
  const one = async (job: InviteJob) => {
    const invite = job.event === "offered" || job.event === "reconfirm";
    let claimed: Date | null = null;
    let outcome: Awaited<ReturnType<typeof sendNotice>> = "failed";
    try {
      if (invite) {
        claimed = await claimNotice(job.notice.chatId);
        if (!claimed) {
          result.skipped++;
          return;
        }
      }
      outcome = await sendNotice(job);
    } catch (error) {
      outcome = "failed";
      console.error(
        `coffee chat invite notice failed (${job.event}):`,
        errorMessage(error),
      );
    }
    result[outcome]++;
    if (claimed && outcome !== "slack" && outcome !== "email") {
      try {
        await releaseNotice(job.notice.chatId, claimed);
      } catch (error) {
        console.error(
          "coffee chat invites: couldn't unclaim a notice",
          errorMessage(error),
        );
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(opts.concurrency ?? 4, jobs.length) },
    async () => {
      while (cursor < jobs.length) await one(jobs[cursor++]!);
    },
  );
  await Promise.all(workers);
  try {
    await mirrorCoffeeChats();
  } catch (error) {
    console.error(
      "coffee chat invites: sheet mirror failed",
      errorMessage(error),
    );
  }
  return result;
}

/** Pending session invites whose notice hasn't gone out, still answerable. */
function unnotifiedInvites(now: Date) {
  return and(
    isNotNull(coffeeChats.placementId),
    eq(coffeeChats.status, "pending"),
    isNull(coffeeChats.notifiedAt),
    or(isNull(coffeeChats.expiresAt), gt(coffeeChats.expiresAt, now)),
  );
}

/** How many invites the sweep would send now (the dry run's count). */
export async function countUnnotifiedInvites(
  now: Date = new Date(),
): Promise<number> {
  const rows = await db
    .select({ id: coffeeChats.id })
    .from(coffeeChats)
    .where(unnotifiedInvites(now));
  return rows.length;
}

/**
 * The delivery sweep: send every pending, unnotified, unexpired session
 * invite (new ones whose caller didn't deliver, failed sends, deliveries
 * cut off mid-request). Claims each row first, so nothing goes out twice.
 * A re-asked invite comes out as a plain invite here (same details and
 * answer-by). Never throws; nothing while the kill switch is off.
 */
export async function deliverUnnotifiedInvites(
  now: Date = new Date(),
): Promise<DeliveryResult> {
  const none: DeliveryResult = { slack: 0, email: 0, failed: 0, skipped: 0 };
  if (!invitesDeliveryLive()) return none;
  try {
    const rows = await db
      .select({ id: coffeeChats.id })
      .from(coffeeChats)
      .where(unnotifiedInvites(now))
      .orderBy(asc(coffeeChats.createdAt), asc(coffeeChats.id));
    const notices = await loadCoffeeChatNotices(rows.map((r) => r.id));
    return deliverInviteNotices(
      notices.map((notice) => ({ event: "offered" as const, notice })),
    );
  } catch (error) {
    console.error(
      "coffee chat invites: delivery sweep failed",
      errorMessage(error),
    );
    return none;
  }
}

/**
 * Run `fn` in a transaction, then deliver its jobs. For callers that don't
 * already have a transaction (the router's "run now", the timed job).
 */
export async function runAndDeliver<T extends { jobs: InviteJob[] }>(
  fn: (tx: InviteTx) => Promise<T>,
): Promise<T & { delivery: DeliveryResult }> {
  const out = await db.transaction(fn);
  const delivery = await deliverInviteNotices(out.jobs);
  mirrorCoffeeInvitesLater();
  return { ...out, delivery };
}

// ---------------------------------------------------------------------------
// The timed job
// ---------------------------------------------------------------------------

/** The lazy round runs at most this often per server instance. */
export const ROUND_THROTTLE_MS = 60_000;
let lastRun = 0;
let lastKick = 0;

/** Tests only. */
export function resetInviteRoundThrottle(): void {
  lastRun = 0;
  lastKick = 0;
}

export type DueRoundOutcome =
  | { status: "disabled" | "notYet" | "over" | "throttled" | "busy" }
  | { status: "ran"; result: RoundResult; delivery: DeliveryResult };

/**
 * The timed rounds (2+, Saturday from 10:00 AM, every 30 minutes). Safe to
 * call from any request: a no-op when the kill switch is off, before round
 * 2, after the last chat of the day starts ("over": no lock, no board
 * read), within a minute of the last run, while another run holds the
 * board, and for sponsors with no sent placements. A round run late or
 * after a missed one is just the current round. Never throws.
 */
export async function runDueInviteRounds(
  now: Date = new Date(),
): Promise<DueRoundOutcome> {
  if (!invitesEnabled()) return { status: "disabled" };
  const round = currentRound(now);
  if (round < 2) return { status: "notYet" };
  if (now >= LAST_CHAT_STARTS_AT) return { status: "over" };
  if (Date.now() - lastRun < ROUND_THROTTLE_MS) return { status: "throttled" };
  lastRun = Date.now();
  try {
    const result = await db.transaction(async (tx) => {
      if (!(await tryLockBoard(tx))) return null;
      return runInviteRound(tx, { round, now });
    });
    if (!result) return { status: "busy" };
    // The sweep sends this round's invites and retries any earlier ones.
    const delivery = await deliverUnnotifiedInvites(now);
    mirrorCoffeeInvitesLater();
    return { status: "ran", result, delivery };
  } catch (error) {
    console.error(
      "coffee chat invites: timed round failed",
      errorMessage(error),
    );
    return { status: "busy" };
  }
}

/** Hacker ids with a live session invite (for the organizer status view). */
export async function sessionInviteRows(conn: Conn = db) {
  return conn
    .select({
      id: coffeeChats.id,
      sponsorId: coffeeChats.sponsorId,
      userId: coffeeChats.userId,
      placementId: coffeeChats.placementId,
      slotTime: coffeeChats.slotTime,
      durationMinutes: coffeeChats.durationMinutes,
      status: coffeeChats.status,
      expiresAt: coffeeChats.expiresAt,
      round: coffeeChats.round,
      source: coffeeChats.source,
      firstName: applications.firstName,
      lastName: applications.lastName,
      userName: users.name,
    })
    .from(coffeeChats)
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .where(isNotNull(coffeeChats.placementId))
    .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt));
}

export type RoundPreview = {
  status: DueRoundOutcome["status"] | RoundResult["status"];
  round: number;
  /** Invites the round would create now. */
  invites: number;
  /** Seats it would leave empty (no eligible hacker left). */
  unfilled: number;
};

/** Thrown to roll back the dry run's transaction. */
class PreviewRollback extends Error {}

/**
 * The dry run of runDueInviteRounds: plans the current round inside a
 * transaction that is always rolled back, ignoring the kill switch and the
 * throttle. Writes nothing (the rollback undoes the expired write-back
 * too) and sends nothing.
 */
export async function previewDueInviteRound(
  now: Date = new Date(),
): Promise<RoundPreview> {
  const round = currentRound(now);
  const empty = { round, invites: 0, unfilled: 0 };
  if (round < 2) return { status: "notYet", ...empty };
  if (now >= LAST_CHAT_STARTS_AT) return { status: "over", ...empty };
  let preview: RoundPreview = { status: "busy", ...empty };
  try {
    await db.transaction(async (tx) => {
      if (await tryLockBoard(tx)) {
        const r = await writeInviteRound(tx, { round, now });
        preview = {
          status: r.status,
          round,
          invites: r.status === "ok" ? r.created.length : 0,
          unfilled:
            r.status === "ok" ? r.unfilled.reduce((n, u) => n + u.open, 0) : 0,
        };
      }
      throw new PreviewRollback();
    });
  } catch (error) {
    if (!(error instanceof PreviewRollback)) throw error;
  }
  return preview;
}

/**
 * Start a due round and the delivery sweep from a request, without waiting
 * for them (waitUntil keeps a Vercel function alive until they finish).
 * At most once a minute per server. Never throws.
 */
export function kickDueInviteRounds(): void {
  if (!invitesEnabled()) return;
  if (Date.now() - lastKick < ROUND_THROTTLE_MS) return;
  lastKick = Date.now();
  const work = runDueInviteRounds()
    // A round that ran has already swept.
    .then(async (out) => {
      if (out.status !== "ran") await deliverUnnotifiedInvites();
    })
    .catch((error: unknown) => {
      console.error(
        "coffee chat invites: kicked round failed",
        errorMessage(error),
      );
    });
  waitUntil(work);
}

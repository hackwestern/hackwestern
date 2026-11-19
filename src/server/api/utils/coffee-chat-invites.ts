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
 * Timed rounds: there is no cron in this app (Vercel Hobby crons are daily).
 * Like the old flow's expiry (computed on read) and the task reminders'
 * auto-sync (run after a sheet read, throttled), rounds 2+ run lazily:
 * runDueInviteRounds() is called by traffic (the organizer invite status
 * query, the hacker's /live chats query) and by an organizer "run now"
 * button. A round is idempotent: re-running it only fills seats that
 * haven't been offered this round yet.
 */
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { admittedStatuses } from "~/lib/admission";
import {
  chatKey,
  currentRound,
  planInviteRound,
  reconfirmExpiresAt,
  repChatStarts,
  type BusyChat,
  type InviteSource,
  type PlanChat,
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
import { mirrorCoffeeChats } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { db } from "~/server/db";
import {
  applications,
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
 * The kill switch: "1" on, "0" off; unset = on only in production. Tests
 * are off unless they set COFFEE_INVITES_ENABLED=1 themselves.
 */
export function invitesEnabled(): boolean {
  const flag = process.env.COFFEE_INVITES_ENABLED ?? env.COFFEE_INVITES_ENABLED;
  if (flag === "1") return true;
  if (flag === "0") return false;
  if (process.env.VITEST) return false;
  return env.NODE_ENV === "production";
}

/** What a hacker hears about: a new invite, a changed one, or a cancel. */
export type InviteJob = {
  event: "offered" | "reconfirm" | "cancelled" | "roomMoved";
  notice: CoffeeChatNotice;
};

/** Same lock as every board write, so placements can't move under a round. */
async function lockBoard(tx: InviteTx): Promise<void> {
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
          spentThisRound: 0,
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

type ChatRow = {
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

async function loadChatRows(conn: Conn): Promise<ChatRow[]> {
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
async function sweepExpired(
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

const isLive = (r: ChatRow) =>
  r.status === "pending" || r.status === "accepted";
const startOf = (r: ChatRow) => minutesOfClock(r.slotTime) ?? 0;
const busyOf = (r: ChatRow): BusyChat => ({
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
 * Each sponsor's candidates in order: scanned (earliest scan first), then
 * the shortlist (order picked), then interested hackers (their rank of the
 * sponsor). Only admitted hackers who agreed to share with sponsors.
 */
async function loadCandidates(
  conn: Conn,
  sponsorIds: readonly string[],
  now: Date,
): Promise<Map<string, { userId: string; source: InviteSource }[]>> {
  const out = new Map<string, { userId: string; source: InviteSource }[]>();
  if (sponsorIds.length === 0) return out;
  const ids = [...sponsorIds];
  const [scans, shortlist, interested] = await Promise.all([
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
  ]);
  const userIds = [
    ...new Set([...scans, ...shortlist, ...interested].map((r) => r.userId)),
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
  add(scans, "scanned");
  add(shortlist, "shortlist");
  add(interested, "interested");
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
      /** Seats still open after the round. */
      unfilled: { placementId: string; start: number; open: number }[];
      /** Notices to deliver after the transaction commits. */
      jobs: InviteJob[];
    };

/**
 * Run one invite round inside `tx`: one invite per open seat of every
 * sponsor with sent placements (optionally only `sponsorIds`). Takes the
 * board lock (re-entrant, so it's fine inside boardWrite). Writes rows only;
 * deliver `jobs` with deliverInviteNotices() after the commit.
 */
export async function runInviteRound(
  tx: InviteTx,
  opts: { round?: number; now?: Date; sponsorIds?: readonly string[] } = {},
): Promise<RoundResult> {
  const now = opts.now ?? new Date();
  const round = opts.round ?? currentRound(now);
  if (!invitesEnabled()) return { status: "disabled", round, jobs: [] };
  await lockBoard(tx);
  const state = await loadBoardState(tx);
  if (!state.workshopsAvailable)
    return { status: "workshopsUnknown", round, jobs: [] };
  const only = opts.sponsorIds ? new Set(opts.sponsorIds) : null;
  // The safety gate: only placements an organizer has sent.
  const layout = layoutOf(
    state,
    (p) => p.status === "sent" && (!only || only.has(p.sponsorId)),
  );
  if (layout.length === 0) return { status: "nothingSent", round, jobs: [] };

  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const live = rows.filter(isLive);
  for (const c of layout) {
    const here = rows.filter((r) => atChat(r, c));
    c.live = here.filter(isLive).length;
    c.spentThisRound = here.filter(
      (r) =>
        r.round === round &&
        (r.status === "declined" || r.status === "expired"),
    ).length;
  }
  const blocked = new Set(
    rows
      .filter((r) => r.status === "declined" || r.status === "expired")
      .map((r) => `${r.sponsorId}|${r.userId}`),
  );
  const sponsorIds = [...new Set(layout.map((c) => c.sponsorId))];
  const candidates = await loadCandidates(tx, sponsorIds, now);
  const order = state.sponsors
    .map((s) => s.id)
    .filter((id) => sponsorIds.includes(id));
  const plan = planInviteRound({
    round,
    now,
    chats: layout,
    candidates,
    busy: live.map(busyOf),
    blocked,
    sponsorOrder: order,
  });

  const meta = new Map(layout.map((c) => [chatKey(c), c]));
  const values = plan.invites.map((inv) => {
    const c = meta.get(chatKey(inv))!;
    return {
      sponsorId: inv.sponsorId,
      userId: inv.userId,
      room: c.room,
      slotTime: coffeeChatTimeOf(inv.start),
      durationMinutes: inv.minutes,
      status: "pending" as const,
      repName: c.repName,
      placementId: inv.placementId,
      round: inv.round,
      expiresAt: inv.expiresAt,
      source: inv.source,
    };
  });
  const created = values.length
    ? (
        await tx
          .insert(coffeeChats)
          .values(values)
          .returning({ id: coffeeChats.id })
      ).map((r) => r.id)
    : [];
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
 * pass on at the next round. Call it inside the transaction that made the
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
  // Every current placement of the sponsor: a moved chat goes back to draft
  // until it's sent again, but its hackers were already invited.
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
        ...(expiresAt
          ? { status: "pending" as const, expiresAt, round, respondedAt: null }
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
  return {
    status: "ok",
    kept: keep.length,
    reconfirm: changed.length + moves.length,
    cancelled: cancels.length,
    jobs: jobsOf.flatMap((j) => {
      const notice = byId.get(j.id);
      return notice ? [{ event: j.event, notice }] : [];
    }),
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
 * Tell each hacker: Slack DM first (Accept / Decline buttons for invites),
 * the email only when the DM wasn't sent. Never throws. Nothing is sent
 * while the kill switch is off. The sheet mirror is rewritten once at the
 * end (only when sheet writes are on).
 */
export async function deliverInviteNotices(
  jobs: readonly InviteJob[],
  opts: { concurrency?: number } = {},
): Promise<DeliveryResult> {
  const result: DeliveryResult = { slack: 0, email: 0, failed: 0, skipped: 0 };
  if (jobs.length === 0) return result;
  if (!invitesEnabled()) {
    result.skipped = jobs.length;
    return result;
  }
  let cursor = 0;
  const one = async (job: InviteJob) => {
    const n = job.notice;
    try {
      if (job.event === "offered" || job.event === "reconfirm") {
        const chat = { ...n, reconfirm: job.event === "reconfirm" };
        if ((await sendCoffeeChatDm(chat, {}, "offered")) === "sent")
          result.slack++;
        else if (await sendCoffeeChatOfferEmail(chat)) result.email++;
        else result.skipped++;
      } else {
        if ((await sendCoffeeChatDm(n, {}, job.event)) === "sent")
          result.slack++;
        else if (await sendCoffeeChatChangeEmail(job.event, n)) result.email++;
        else result.skipped++;
      }
    } catch (error) {
      result.failed++;
      console.error(
        `coffee chat invite notice failed (${job.event}):`,
        errorMessage(error),
      );
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

/**
 * Run `fn` in a transaction, then deliver its jobs. For callers that don't
 * already have a transaction (the router's "run now", the timed job).
 */
export async function runAndDeliver<T extends { jobs: InviteJob[] }>(
  fn: (tx: InviteTx) => Promise<T>,
): Promise<T & { delivery: DeliveryResult }> {
  const out = await db.transaction(fn);
  const delivery = await deliverInviteNotices(out.jobs);
  return { ...out, delivery };
}

// ---------------------------------------------------------------------------
// The timed job
// ---------------------------------------------------------------------------

/** The lazy round runs at most this often per server instance. */
export const ROUND_THROTTLE_MS = 60_000;
let lastRun = 0;

/** Tests only. */
export function resetInviteRoundThrottle(): void {
  lastRun = 0;
}

export type DueRoundOutcome =
  | { status: "disabled" | "notYet" | "throttled" | "busy" }
  | { status: "ran"; result: RoundResult; delivery: DeliveryResult };

/**
 * The timed rounds (2+, Saturday from 10:30 AM, every 30 minutes). Safe to
 * call from any request: a no-op when the kill switch is off, before round
 * 2, within a minute of the last run, while another run holds the board,
 * and for sponsors with no sent placements. Never throws.
 */
export async function runDueInviteRounds(
  now: Date = new Date(),
): Promise<DueRoundOutcome> {
  if (!invitesEnabled()) return { status: "disabled" };
  const round = currentRound(now);
  if (round < 2) return { status: "notYet" };
  if (Date.now() - lastRun < ROUND_THROTTLE_MS) return { status: "throttled" };
  lastRun = Date.now();
  try {
    const result = await db.transaction(async (tx) => {
      if (!(await tryLockBoard(tx))) return null;
      return runInviteRound(tx, { round, now });
    });
    if (!result) return { status: "busy" };
    const delivery = await deliverInviteNotices(result.jobs);
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

/** Longest a request waits for a due round it triggered. */
export const KICK_TIMEOUT_MS = 2500;

/**
 * Start a due round from a request and wait at most `timeoutMs` for it
 * (the rest keeps running where the server allows). Never throws.
 */
export async function kickDueInviteRounds(
  timeoutMs = KICK_TIMEOUT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([runDueInviteRounds().then(() => undefined), cap]);
  clearTimeout(timer);
}

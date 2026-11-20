/**
 * Organizer edits to a sponsor's hackers on the coffee board (mock
 * organizer-coffee-v12): who's next in line, checking a hacker ID, removing
 * a hacker from a sent chat and giving the seat to someone else, and putting
 * someone first in line. The line's order is pure (src/lib/coffee-chat-
 * line.ts); this file reads and writes the rows. Every write takes the board
 * lock, like invite rounds, and messages go out after the commit.
 */
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { isAdmittedStatus } from "~/lib/admission";
import {
  currentRound,
  inviteExpiresAt,
  type BusyChat,
  type InviteSource,
} from "~/lib/coffee-chat-invites";
import {
  firstForSeat,
  seatFit,
  sponsorLine,
  type LineEntry,
} from "~/lib/coffee-chat-line";
import { effectiveCoffeeChatStatus } from "~/lib/coffee-chat-requests";
import { buildingOf, minutesOfClock } from "~/lib/coffee-chat-sessions";
import {
  busyOf,
  invitesEnabled,
  loadCandidates,
  loadChatRows,
  loadRemovedPairs,
  lockBoard,
  refillSeatsAfterNo,
  sweepExpired,
  type ChatRow,
  type InviteJob,
  type InviteTx,
} from "~/server/api/utils/coffee-chat-invites";
import { shortName } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import { loadCoffeeChatNotices } from "~/server/api/utils/coffee-chat-notify";
import { resolveScannedUserId } from "~/server/api/utils/hacker-id";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatLine,
  coffeeChatPlacements,
  coffeeChats,
  users,
} from "~/server/db/schema";

const errors = coffeeChatInvitesCopy.line;
type Conn = typeof db | InviteTx;

/** One seat: a chat of this sponsor at this time. */
type Seat = { sponsorId: string; start: number; minutes: number };

/** A row's status now: a pending invite past its answer-by is expired. */
const statusOf = (r: ChatRow, now: Date) => effectiveCoffeeChatStatus(r, now);
const live = (r: ChatRow, now: Date) => {
  const s = statusOf(r, now);
  return s === "pending" || s === "accepted";
};

/** Everything the line needs for one sponsor, from one read of the rows. */
async function lineState(conn: Conn, sponsorId: string, rows: ChatRow[], now: Date) {
  const [candidates, removed] = await Promise.all([
    loadCandidates(conn, [sponsorId], now),
    loadRemovedPairs(conn),
  ]);
  // Seated with this sponsor now, or never offered it again.
  const seated = new Set(
    rows.filter((r) => r.sponsorId === sponsorId && live(r, now)).map((r) => r.userId),
  );
  const blocked = new Set([
    ...rows
      .filter((r) => {
        const s = statusOf(r, now);
        return r.sponsorId === sponsorId && (s === "declined" || s === "expired");
      })
      .map((r) => r.userId),
    ...[...removed]
      .filter((pair) => pair.startsWith(`${sponsorId}|`))
      .map((pair) => pair.slice(sponsorId.length + 1)),
  ]);
  const line = sponsorLine(
    candidates.get(sponsorId) ?? [],
    new Set([...seated, ...blocked]),
  );
  const busy: BusyChat[] = rows.filter((r) => live(r, now)).map(busyOf);
  return { line, seated, blocked, busy };
}

/** "Ada L." for each hacker (first name and last initial, as on the Invites tab). */
async function namesOf(conn: Conn, userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await conn
    .select({
      id: users.id,
      name: users.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
    })
    .from(users)
    .leftJoin(applications, eq(applications.userId, users.id))
    .where(inArray(users.id, [...userIds]));
  return new Map(rows.map((r) => [r.id, shortName(r.firstName, r.lastName, r.name)]));
}

/** The seat a live session invite holds, and its building (for the answer-by time). */
async function seatOf(conn: Conn, row: ChatRow) {
  const [p] = row.placementId
    ? await conn
        .select({ room: coffeeChatPlacements.room })
        .from(coffeeChatPlacements)
        .where(eq(coffeeChatPlacements.id, row.placementId))
    : [];
  if (!p) return null;
  return {
    seat: { sponsorId: row.sponsorId, start: minutesOfClock(row.slotTime) ?? 0, minutes: row.durationMinutes },
    building: buildingOf(p.room) ?? "near",
  };
}

export type LineView = {
  /** The next few in line, in order. */
  queue: { userId: string; name: string; source: InviteSource }[];
  /** With a chat: the first in line who can take that seat, or null. */
  next: { userId: string; name: string; source: InviteSource } | null;
};

/** A sponsor's line: the first `limit`, and who'd get the seat of invite `chatId`. */
export async function sponsorLineView(
  sponsorId: string,
  opts: { chatId?: string; limit?: number; now?: Date } = {},
): Promise<LineView> {
  const now = opts.now ?? new Date();
  const rows = await loadChatRows(db);
  const { line, busy } = await lineState(db, sponsorId, rows, now);
  const queue = line.slice(0, opts.limit ?? 3);
  const row = opts.chatId ? rows.find((r) => r.id === opts.chatId) : undefined;
  const at = row && row.sponsorId === sponsorId ? await seatOf(db, row) : null;
  const pick = at ? firstForSeat(line, at.seat, busy) : null;
  const names = await namesOf(db, [...queue.map((q) => q.userId), ...(pick ? [pick.userId] : [])]);
  const named = (e: LineEntry) => ({ ...e, name: names.get(e.userId) ?? "" });
  return { queue: queue.map(named), next: pick ? named(pick) : null };
}

export type HackerCheck =
  | { kind: "ok"; userId: string; name: string }
  | { kind: "unknown" }
  | { kind: "noShare" | "taken" | "blocked" | "busy" | "full"; name: string };

/** The message for a check that failed, or null when it's fine. */
export function hackerCheckError(check: HackerCheck, code: string): string | null {
  switch (check.kind) {
    case "ok":
      return null;
    case "unknown":
      return errors.unknown(code);
    default:
      return errors[check.kind](check.name);
  }
}

/**
 * Can an organizer give this hacker (a hacker ID like "brave-otter-kite",
 * or a user id from a badge QR) a seat with this sponsor? An admitted
 * hacker who agreed to share with sponsors, not seated with or in line for
 * this sponsor, never blocked from it; with `seat`, also free then and
 * under the live-chat cap.
 */
export async function checkHacker(
  conn: Conn,
  sponsorId: string,
  code: string,
  opts: { now?: Date; seat?: Seat; rows?: ChatRow[] } = {},
): Promise<HackerCheck> {
  const now = opts.now ?? new Date();
  const userId = await resolveScannedUserId(code.trim());
  const [h] = await conn
    .select({
      id: users.id,
      type: users.type,
      name: users.name,
      status: applications.status,
      firstName: applications.firstName,
      lastName: applications.lastName,
      share: applications.agreeShareWithSponsors,
    })
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(eq(users.id, userId));
  if (!h || h.type !== "hacker" || !isAdmittedStatus(h.status, now.getTime())) {
    return { kind: "unknown" };
  }
  const name = shortName(h.firstName, h.lastName, h.name);
  if (!h.share) return { kind: "noShare", name };
  const rows = opts.rows ?? (await loadChatRows(conn));
  const { line, seated, blocked, busy } = await lineState(conn, sponsorId, rows, now);
  if (seated.has(h.id) || line.some((e) => e.userId === h.id)) return { kind: "taken", name };
  if (blocked.has(h.id)) return { kind: "blocked", name };
  if (opts.seat) {
    const fit = seatFit(opts.seat, busy.filter((b) => b.userId === h.id));
    if (fit !== "ok") return { kind: fit, name };
  }
  return { kind: "ok", userId: h.id, name };
}

const fail = (code: "BAD_REQUEST" | "CONFLICT" | "PRECONDITION_FAILED", message: string) =>
  new TRPCError({ code, message });

export type ReplaceResult = { removed: string; invited: string; jobs: InviteJob[] };

/**
 * Remove one hacker from a sent chat and give their seat to someone else,
 * inside `tx`: the next person in line who can take it, or a hacker an
 * organizer picked by ID ("Added by organizer"). The old invite is
 * cancelled (they're told) and they're never offered this sponsor again.
 * The new one gets the same seat as Waiting, with the current round's
 * answer-by. Deliver `jobs` after the commit.
 */
export async function replaceInvite(
  tx: InviteTx,
  input: { chatId: string; pick: { kind: "next" } | { kind: "code"; code: string }; by: string | null },
  now = new Date(),
): Promise<ReplaceResult> {
  if (!invitesEnabled()) throw fail("PRECONDITION_FAILED", errors.invitesOff);
  await lockBoard(tx);
  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const old = rows.find((r) => r.id === input.chatId);
  if (!old?.placementId || !live(old, now)) throw fail("CONFLICT", errors.inviteGone);
  const at = await seatOf(tx, old);
  if (!at) throw fail("CONFLICT", errors.inviteGone);
  const round = currentRound(now);
  const expiresAt = inviteExpiresAt(round, at.seat.start, at.building, now);
  if (!expiresAt) throw fail("BAD_REQUEST", errors.tooLate);

  let pick: { userId: string; source: InviteSource; name: string };
  if (input.pick.kind === "next") {
    const { line, busy } = await lineState(tx, old.sponsorId, rows, now);
    const next = firstForSeat(line, at.seat, busy);
    if (!next) throw fail("CONFLICT", errors.nobody);
    pick = { ...next, name: (await namesOf(tx, [next.userId])).get(next.userId) ?? "" };
  } else {
    const check = await checkHacker(tx, old.sponsorId, input.pick.code, { now, seat: at.seat, rows });
    if (check.kind !== "ok") throw fail("BAD_REQUEST", hackerCheckError(check, input.pick.code.trim())!);
    pick = { userId: check.userId, source: "organizer", name: check.name };
  }

  await tx
    .update(coffeeChats)
    .set({ status: "cancelled", respondedAt: now })
    .where(eq(coffeeChats.id, old.id));
  await tx
    .insert(coffeeChatLine)
    .values({ sponsorId: old.sponsorId, userId: old.userId, kind: "removed", addedBy: input.by })
    .onConflictDoUpdate({
      target: [coffeeChatLine.sponsorId, coffeeChatLine.userId],
      set: { kind: "removed", addedBy: input.by, createdAt: sql`now()` },
    });
  const [fresh] = await tx
    .insert(coffeeChats)
    .values({
      sponsorId: old.sponsorId,
      userId: pick.userId,
      room: old.room,
      slotTime: old.slotTime,
      durationMinutes: old.durationMinutes,
      status: "pending",
      repName: old.repName,
      placementId: old.placementId,
      round,
      expiresAt,
      source: pick.source,
    })
    .onConflictDoNothing()
    .returning({ id: coffeeChats.id });
  // Another booking for them at this time committed after the read.
  if (!fresh) throw fail("CONFLICT", errors.busy(pick.name));
  const notices = await loadCoffeeChatNotices([old.id, fresh.id], tx);
  const jobs: InviteJob[] = notices.map((notice) => ({
    event: notice.chatId === old.id ? ("cancelled" as const) : ("offered" as const),
    notice,
  }));
  const removed = (await namesOf(tx, [old.userId])).get(old.userId) ?? "";
  return { removed, invited: pick.name, jobs };
}

/**
 * Put a hacker first in this sponsor's line, ahead of earlier organizer
 * picks and everyone else. Same checks as a pick by ID (no seat). An open
 * seat goes to them at once; else they get the next free one.
 */
export async function putFirstInLine(
  tx: InviteTx,
  input: { sponsorId: string; code: string; by: string | null },
  now = new Date(),
): Promise<{ name: string; jobs: InviteJob[] }> {
  await lockBoard(tx);
  const check = await checkHacker(tx, input.sponsorId, input.code, { now });
  if (check.kind !== "ok") throw fail("BAD_REQUEST", hackerCheckError(check, input.code.trim())!);
  await tx
    .insert(coffeeChatLine)
    .values({ sponsorId: input.sponsorId, userId: check.userId, kind: "front", addedBy: input.by, createdAt: now })
    .onConflictDoUpdate({
      target: [coffeeChatLine.sponsorId, coffeeChatLine.userId],
      set: { kind: "front", addedBy: input.by, createdAt: now },
    });
  const jobs = await refillSeatsAfterNo(tx, input.sponsorId, { now });
  return { name: check.name, jobs };
}

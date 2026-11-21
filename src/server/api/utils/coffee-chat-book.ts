/**
 * "Book an event" on the organizer coffee board: an organizer books an
 * empty cell (a room and a session) with a description and who on the
 * sponsorship team booked it. A sponsor (any, set up for chats or not), any
 * of its reps and any hackers are optional. The cell is then an organizer
 * booking: taken on the board, blocked for Auto-schedule and other
 * bookings. Each hacker picked gets a normal pending invite (Slack DM with
 * Accept / Decline, or email), answered by 20 minutes before the event; the
 * 15-minute reminder follows an accept. Hackers are picked from the ones the
 * sponsor scanned at their booth, or found by name or hacker ID. Only
 * admitted hackers who agreed to share with sponsors are listed or invited,
 * as everywhere else on the board. docs/decisions.md 2026-11-20.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { admittedStatuses } from "~/lib/admission";
import { currentRound } from "~/lib/coffee-chat-invites";
import { seatFit } from "~/lib/coffee-chat-line";
import {
  coffeeChatExpiresAt,
  coffeeChatTimeOf,
} from "~/lib/coffee-chat-requests";
import { bookRepOf, repBusy } from "~/lib/coffee-chat-book-availability";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { inviteRoomLabel } from "~/server/api/utils/coffee-chat-invite-text";
import {
  busyOf,
  isLive,
  loadChatRows,
  sweepExpired,
  type InviteTx,
} from "~/server/api/utils/coffee-chat-invites";
import { shortName } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import {
  assertCellFree,
  assertWorkshopsKnown,
  type BoardState,
} from "~/server/api/utils/coffee-chat-sessions-board";
import { normalizeHackerId } from "~/server/api/utils/hacker-id";
import type { db } from "~/server/db";
import {
  applications,
  coffeeChatReps,
  coffeeChatRoomBookings,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorScans,
  users,
} from "~/server/db/schema";

const lineErrors = coffeeChatInvitesCopy.line;
const errors = coffeeSessionsCopy.errors;
type Conn = typeof db | InviteTx;

export type BookingHacker = {
  userId: string;
  /** "Ada L.", as on the Invites tab. */
  name: string;
  hackerId: string | null;
};

/** Hackers who may be listed or booked: admitted, and they agreed to share with sponsors. */
const shareable = (now: Date) =>
  and(
    eq(users.type, "hacker"),
    eq(applications.agreeShareWithSponsors, true),
    inArray(applications.status, [...admittedStatuses(now.getTime())]),
  );

const hackerCols = {
  userId: users.id,
  userName: users.name,
  hackerId: users.hackerId,
  firstName: applications.firstName,
  lastName: applications.lastName,
};
const toHacker = (r: {
  userId: string;
  userName: string | null;
  hackerId: string | null;
  firstName: string | null;
  lastName: string | null;
}): BookingHacker => ({
  userId: r.userId,
  name: shortName(r.firstName, r.lastName, r.userName),
  hackerId: r.hackerId,
});

/** `%` and `_` typed by the organizer are literal. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The hackers for step 3: everyone this sponsor scanned (newest scan
 * first: the person they just met is on top), and with `q` (2+ letters)
 * up to 10 hackers whose name or hacker ID matches.
 */
export async function bookingHackers(
  conn: Conn,
  sponsorId: string,
  q = "",
  now = new Date(),
): Promise<{ scanned: BookingHacker[]; found: BookingHacker[] }> {
  const scannedRows = await conn
    .select(hackerCols)
    .from(sponsorScans)
    .innerJoin(users, eq(users.id, sponsorScans.userId))
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(and(eq(sponsorScans.sponsorId, sponsorId), shareable(now)))
    .orderBy(desc(sponsorScans.scannedAt), asc(users.id));
  const text = q.trim();
  if (text.length < 2) return { scanned: scannedRows.map(toHacker), found: [] };
  const like = `%${likeEscape(text)}%`;
  const id = normalizeHackerId(text);
  const foundRows = await conn
    .select(hackerCols)
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(
      and(
        shareable(now),
        or(
          ilike(applications.firstName, like),
          ilike(applications.lastName, like),
          ilike(users.name, like),
          sql`(${applications.firstName} || ' ' || ${applications.lastName}) ilike ${like}`,
          ...(id ? [ilike(users.hackerId, `${likeEscape(id)}%`)] : []),
        ),
      ),
    )
    .orderBy(
      asc(applications.firstName),
      asc(applications.lastName),
      asc(users.id),
    )
    .limit(10);
  return { scanned: scannedRows.map(toHacker), found: foundRows.map(toHacker) };
}

const fail = (code: "BAD_REQUEST" | "CONFLICT", message: string) =>
  new TRPCError({ code, message });

export type BookInput = {
  room: string;
  sessionId: string;
  description: string;
  bookedBy: string;
  sponsorId: string | null;
  repIds: string[];
  userIds: string[];
  /** The organizer signed in (created_by). */
  by: string | null;
};

export type BookResult = {
  bookingId: string;
  /** New pending invites, for delivery after the commit. */
  chatIds: string[];
  /** Hackers who couldn't be invited, each with why (a full sentence). */
  skipped: { userId: string; reason: string }[];
};

/**
 * Book an event inside the board write (`tx` holds the board lock and
 * `state` was read under it): a room booking on an empty cell with a
 * description and who booked it, for any sponsor (or none), any of its reps
 * and any hackers. Each hacker gets a normal pending invite (answer by 20
 * minutes before the event; the usual DM goes out after the commit) for the
 * whole session hour, in this room. Per-hacker rules as everywhere: admitted
 * and shares with sponsors, no chat with this sponsor yet, nothing else
 * then, fewer than 2 live chats. A hacker who fails one is skipped (and
 * reported), not the booking. Hackers need a sponsor. Reps already in a chat
 * or another event this session are refused.
 */
export async function bookEvent(
  tx: InviteTx,
  state: BoardState,
  input: BookInput,
  now = new Date(),
): Promise<BookResult> {
  assertWorkshopsKnown(state);
  assertCellFree(state, input.room, input.sessionId);
  const session = COFFEE_SESSIONS.find((s) => s.id === input.sessionId);
  if (!session) throw fail("BAD_REQUEST", errors.badCell);
  const userIds = [...new Set(input.userIds)];
  const repIds = [...new Set(input.repIds)];
  if (!input.sponsorId && (userIds.length || repIds.length)) {
    throw fail("BAD_REQUEST", errors.bookHackersNeedSponsor);
  }
  let sponsorName = "";
  const repNames: string[] = [];
  if (input.sponsorId) {
    const [sponsor] = await tx
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors)
      .where(eq(sponsorJudgingSponsors.id, input.sponsorId));
    if (!sponsor) throw fail("BAD_REQUEST", errors.unknownSponsor);
    sponsorName = sponsor.name;
    const reps = repIds.length
      ? await tx
          .select({ id: coffeeChatReps.id, name: coffeeChatReps.name })
          .from(coffeeChatReps)
          .where(
            and(
              inArray(coffeeChatReps.id, repIds),
              eq(coffeeChatReps.sponsorId, sponsor.id),
            ),
          )
      : [];
    if (reps.length !== repIds.length) {
      throw fail("BAD_REQUEST", errors.badReference);
    }
    for (const id of repIds) {
      const rep = reps.find((r) => r.id === id)!;
      // The picker's rule (coffee-chat-book-availability.ts): a chat, an
      // event, their workshop, or a session they didn't tick free.
      const busy = repBusy(
        bookRepOf(state, sponsor.id, id),
        input.sessionId,
        state,
      );
      if (busy) {
        throw fail(
          "CONFLICT",
          busy.kind === "chat"
            ? errors.bookRepInChat(rep.name)
            : errors.bookRepBooked(rep.name),
        );
      }
      repNames.push(rep.name);
    }
  }

  const [booking] = await tx
    .insert(coffeeChatRoomBookings)
    .values({
      room: input.room,
      sessionId: input.sessionId,
      forSponsorId: input.sponsorId,
      label: input.description,
      bookedBy: input.bookedBy,
      repIds,
      createdBy: input.by,
    })
    .returning({ id: coffeeChatRoomBookings.id });
  const bookingId = booking!.id;
  const result: BookResult = { bookingId, chatIds: [], skipped: [] };
  if (!input.sponsorId || userIds.length === 0) return result;

  const slotTime = coffeeChatTimeOf(session.start);
  const expiresAt = coffeeChatExpiresAt(slotTime);
  const minutes = session.end - session.start;
  const hackers = await tx
    .select(hackerCols)
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(and(inArray(users.id, userIds), shareable(now)));
  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const seat = { sponsorId: input.sponsorId, start: session.start, minutes };
  for (const userId of userIds) {
    const h = hackers.find((x) => x.userId === userId);
    if (!h) {
      result.skipped.push({ userId, reason: errors.bookNoHacker });
      continue;
    }
    const name = toHacker(h).name;
    if (now >= expiresAt) {
      result.skipped.push({ userId, reason: errors.bookTooLate(name) });
      continue;
    }
    const theirs = rows
      .filter((r) => r.userId === userId && isLive(r))
      .map(busyOf);
    const fit = seatFit(seat, theirs);
    if (fit !== "ok") {
      const withSponsor = theirs.some((b) => b.sponsorId === input.sponsorId);
      result.skipped.push({
        userId,
        reason:
          fit === "full"
            ? lineErrors.full(name)
            : withSponsor
              ? errors.bookSameSponsor(name, sponsorName)
              : lineErrors.busy(name),
      });
      continue;
    }
    const [chat] = await tx
      .insert(coffeeChats)
      .values({
        sponsorId: input.sponsorId,
        userId,
        room: inviteRoomLabel(input.room),
        slotTime,
        durationMinutes: minutes,
        status: "pending",
        repName: repNames.length ? repNames.join(", ") : null,
        bookingId,
        round: currentRound(now),
        expiresAt,
        source: "organizer",
      })
      .onConflictDoNothing()
      .returning({ id: coffeeChats.id });
    // Another chat for them at this time committed after the read.
    if (!chat) {
      result.skipped.push({ userId, reason: lineErrors.busy(name) });
      continue;
    }
    result.chatIds.push(chat.id);
  }
  return result;
}

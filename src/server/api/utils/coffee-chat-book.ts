/**
 * "Book an event" on the organizer coffee board: an organizer picks a
 * sponsor, one of its reps and a hacker for an empty cell (a room and a
 * session). It makes a real chat: a placement for the rep there, already
 * notified (sent, so it's locked like every notified chat), and the
 * hacker's coffee chat at the first time in that hour they can take,
 * accepted (they agreed in person). The hacker is picked from the hackers
 * the sponsor scanned at their booth, or found by name or hacker ID. Only
 * admitted hackers who agreed to share with sponsors are listed or booked,
 * as everywhere else on the board.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { admittedStatuses } from "~/lib/admission";
import { currentRound } from "~/lib/coffee-chat-invites";
import { seatFit } from "~/lib/coffee-chat-line";
import { coffeeChatTimeOf } from "~/lib/coffee-chat-requests";
import { sessionCap } from "~/lib/coffee-chat-schedule";
import {
  busyOf,
  isLive,
  layoutOf,
  loadChatRows,
  sweepExpired,
  type InviteTx,
} from "~/server/api/utils/coffee-chat-invites";
import { shortName } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import {
  assertCellFree,
  assertRepCanChat,
  assertWorkshopsKnown,
  type BoardState,
} from "~/server/api/utils/coffee-chat-sessions-board";
import { normalizeHackerId } from "~/server/api/utils/hacker-id";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPlacements,
  coffeeChats,
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
  sponsorId: string;
  repId: string;
  userId: string;
};

/**
 * Book the event inside the board write (`tx` holds the board lock and
 * `state` was read under it). Same rules as any chat: the rep is free then
 * (ticked, not in their workshop, not elsewhere) and has a session left of
 * the chats they asked for; the cell is empty; the hacker is admitted and
 * shares with sponsors, has no chat with this sponsor yet, no other chat
 * then and fewer than 2 live chats.
 */
export async function bookEvent(
  tx: InviteTx,
  state: BoardState,
  input: BookInput,
  now = new Date(),
): Promise<{
  placementId: string;
  chatId: string;
  name: string;
  slotTime: string;
}> {
  assertWorkshopsKnown(state);
  const sponsor = state.sponsors.find((s) => s.id === input.sponsorId);
  const rep = sponsor?.reps.find((r) => r.id === input.repId);
  if (!sponsor || !rep) throw fail("BAD_REQUEST", errors.badReference);
  assertRepCanChat(state, rep.id, input.sessionId);
  assertCellFree(state, input.room, input.sessionId);
  // Like Undo (placeChat): one more session than the rep's chats need is refused.
  const schedRep = state.sched
    .flatMap((sp) => sp.reps)
    .find((r) => r.id === rep.id);
  const has = state.placements.filter((p) => p.repId === rep.id).length;
  if (schedRep && has >= sessionCap(schedRep)) {
    throw fail("BAD_REQUEST", errors.repAtCap(has));
  }

  const [h] = await tx
    .select(hackerCols)
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(and(eq(users.id, input.userId), shareable(now)));
  if (!h) throw fail("BAD_REQUEST", errors.bookNoHacker);
  const name = toHacker(h).name;

  // The chats this placement holds, as the invites lay them out.
  const placementId = crypto.randomUUID();
  const chats = layoutOf(
    {
      ...state,
      placements: [
        ...state.placements,
        {
          id: placementId,
          repId: rep.id,
          sponsorId: sponsor.id,
          sessionId: input.sessionId,
          room: input.room,
          pinned: true,
          forced: false,
          status: "sent",
          sentAt: now,
          window: null,
        },
      ],
    },
    (p) => p.id === placementId,
  );
  if (chats.length === 0) throw fail("BAD_REQUEST", errors.repAtCap(has));
  // The hacker takes the first chat of the hour they're free for.
  const rows = await sweepExpired(tx, await loadChatRows(tx), now);
  const theirs = rows
    .filter((r) => r.userId === h.userId && isLive(r))
    .map(busyOf);
  const fits = chats.map((c) => ({ c, fit: seatFit(c, theirs) }));
  const pick = fits.find((x) => x.fit === "ok")?.c;
  if (!pick) {
    const fit = fits[0]!.fit;
    const withSponsor = theirs.some((b) => b.sponsorId === sponsor.id);
    throw fail(
      "CONFLICT",
      fit === "full"
        ? lineErrors.full(name)
        : withSponsor
          ? errors.bookSameSponsor(name, sponsor.name)
          : lineErrors.busy(name),
    );
  }

  await tx.insert(coffeeChatPlacements).values({
    id: placementId,
    repId: rep.id,
    room: input.room,
    sessionId: input.sessionId,
    pinned: true,
    status: "sent",
    sentAt: now,
  });
  const slotTime = coffeeChatTimeOf(pick.start);
  const [chat] = await tx
    .insert(coffeeChats)
    .values({
      sponsorId: sponsor.id,
      userId: h.userId,
      room: pick.room,
      slotTime,
      durationMinutes: pick.minutes,
      status: "accepted",
      respondedAt: now,
      repName: pick.repName,
      placementId,
      round: currentRound(now),
      source: "organizer",
    })
    .onConflictDoNothing()
    .returning({ id: coffeeChats.id });
  // Another chat for them at this time committed after the read.
  if (!chat) throw fail("CONFLICT", lineErrors.busy(name));
  return { placementId, chatId: chat.id, name, slotTime };
}

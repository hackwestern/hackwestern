import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { coffeeChatCopy } from "~/content/coffee-chat";
import { admittedStatuses, isAdmittedStatus } from "~/lib/admission";
import {
  chatsInSlot,
  holdAsRoomUse,
  holdClash,
  holdCovers,
  holdFitsChat,
  holdMinutes,
  holdsForSponsor,
  holdTimesProblem,
  ownHoldAt,
  ownHoldOverlap,
  type HoldSpan,
  type RoomUse,
} from "~/lib/coffee-chat-holds";
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  COFFEE_CHAT_ROOMS,
  coffeeChatExpiresAt,
  coffeeChatRoomOf,
  coffeeChatMinutesOf,
  coffeeChatsOverlap,
  coffeeChatTimeOf,
  isActiveCoffeeChat,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import {
  askedAt,
  CHAT_STYLES,
  chatRequestOf,
  MAX_PER_SLOT,
  MIN_PER_SLOT,
  type SlotLimit,
} from "~/lib/coffee-chat-request";
import { formatClock, type CoffeeChatSetup } from "~/lib/run-of-show";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  freeStartTimes,
  normalizeRoom,
  offerProblem,
  offerRoomAt,
  roomTakenByOtherSponsor,
  type OfferProblem,
} from "~/server/api/utils/coffee-chat-capacity";
import { buildChatBoard } from "~/server/api/utils/coffee-chat-board";
import { coffeeChatTimes } from "~/server/api/utils/coffee-chat-expiry";
import { kickDueInviteRounds } from "~/server/api/utils/coffee-chat-invites";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import { respondToCoffeeChat } from "~/server/api/utils/coffee-chat-respond";
import { resolveScannedUserId } from "~/server/api/utils/hacker-id";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  coffeeChatLimits,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

const errors = coffeeChatCopy.errors;

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const sponsorInput = z.string().uuid();
// The /live QR (and the badge) hold the hacker's user id.
const userIdInput = z.string().trim().min(1).max(255);
const slotTimeInput = z.string().regex(/^\d{2}:\d{2}$/);

/** The sponsor behind a private UUID, or 404. */
async function findSponsor(conn: Db | Tx, id: string, lock = false) {
  const query = conn
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
      style: sponsorJudgingSponsors.coffeeChatStyle,
      perSlot: sponsorJudgingSponsors.coffeeChatPerSlot,
      watcher: sponsorJudgingSponsors.coffeeChatWatcher,
    })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, id.toLowerCase()));
  const [sponsor] = lock ? await query.for("update") : await query;
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownSponsor });
  }
  return sponsor;
}

/**
 * Every sponsor's Coffee Chats row (chat type, window), with registered
 * names matched. Rooms come from room blocks, not from this row.
 */
export async function readCoffeeChatSetups(): Promise<CoffeeChatSetup[]> {
  const sponsors = await db
    .select({ name: sponsorJudgingSponsors.name })
    .from(sponsorJudgingSponsors);
  return readSheetCoffeeChatSetups(sponsors.map((s) => s.name));
}

/** The Coffee Chats tab as the sheet has it. */
async function readSheetCoffeeChatSetups(
  sponsorNames: string[],
): Promise<CoffeeChatSetup[]> {
  try {
    const snapshot = await getRunOfShow();
    return applySponsorNames(snapshot, sponsorNames).coffeeChats;
  } catch (error) {
    console.error("run-of-show sheet read failed", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errors.sheetUnavailable,
    });
  }
}

/** One sponsor's Coffee Chats row (window, format, room), or null. */
async function setupFor(sponsorName: string) {
  const setups = await readCoffeeChatSetups();
  return setups.find((s) => s.sponsor === sponsorName) ?? null;
}

/**
 * An admitted hacker (accepted or confirmed, per src/lib/admission.ts), or
 * 404 with no hint of who the id belongs to.
 */
async function findAdmittedHacker(
  userId: string,
  now = new Date(),
  conn: Db | Tx = db,
) {
  const [row] = await conn
    .select({
      id: users.id,
      type: users.type,
      name: users.name,
      status: applications.status,
      firstName: applications.firstName,
      agreeShareWithSponsors: applications.agreeShareWithSponsors,
      resumeLink: applications.resumeLink,
      githubLink: applications.githubLink,
      linkedInLink: applications.linkedInLink,
      devpostLink: applications.devpostLink,
    })
    .from(users)
    .innerJoin(applications, eq(applications.userId, users.id))
    .where(eq(users.id, userId));
  if (
    !row ||
    row.type !== "hacker" ||
    !isAdmittedStatus(row.status, now.getTime())
  ) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.notAHacker });
  }
  // A blank application first name falls back to the account name's first
  // word.
  const firstName =
    [row.firstName, row.name?.trim().split(/\s+/)[0]]
      .map((name) => name?.trim() ?? "")
      .find((name) => name.length > 0) ?? "";
  return {
    userId: row.id,
    firstName,
    // Resume and links only when the hacker agreed to share with sponsors.
    links: row.agreeShareWithSponsors
      ? {
          resume: row.resumeLink,
          github: row.githubLink,
          linkedIn: row.linkedInLink,
          devpost: row.devpostLink,
        }
      : null,
  };
}

/** Chats that still hold a seat right now (pending past cutoff don't). */
async function activeChats(conn: Db | Tx, where: SQL, now: Date) {
  const rows = await conn
    .select({
      id: coffeeChats.id,
      sponsorId: coffeeChats.sponsorId,
      userId: coffeeChats.userId,
      room: coffeeChats.room,
      slotTime: coffeeChats.slotTime,
      expiresAt: coffeeChats.expiresAt,
      durationMinutes: coffeeChats.durationMinutes,
      status: coffeeChats.status,
    })
    .from(coffeeChats)
    .where(
      and(where, inArray(coffeeChats.status, [...ACTIVE_COFFEE_CHAT_STATUSES])),
    );
  return rows.filter((c) => isActiveCoffeeChat(c, now));
}

/**
 * Every active chat that has a room (any sponsor). Rooms are compared
 * normalized in coffee-chat-capacity; there are only ever a few dozen.
 */
async function activeRoomChats(conn: Db | Tx, now: Date) {
  return activeChats(conn, isNotNull(coffeeChats.room), now);
}

/** "Ask for fewer" rows (all, or those matching `where`). */
async function loadLimits(conn: Db | Tx, where?: SQL): Promise<SlotLimit[]> {
  return conn
    .select({
      sponsorId: coffeeChatLimits.sponsorId,
      startTime: coffeeChatLimits.startTime,
      endTime: coffeeChatLimits.endTime,
      hackers: coffeeChatLimits.hackers,
    })
    .from(coffeeChatLimits)
    .where(where)
    .orderBy(asc(coffeeChatLimits.startTime));
}

/** A room block as the pages and rules see it. */
export type RoomHold = HoldSpan & { holdId: string; note: string | null };

/** Room holds, earliest first (all, or those matching `where`). */
async function loadHolds(conn: Db | Tx, where?: SQL): Promise<RoomHold[]> {
  const rows = await conn
    .select({
      holdId: coffeeChatHolds.id,
      sponsorId: coffeeChatHolds.sponsorId,
      room: coffeeChatHolds.room,
      startTime: coffeeChatHolds.startTime,
      endTime: coffeeChatHolds.endTime,
      note: coffeeChatHolds.note,
    })
    .from(coffeeChatHolds)
    .where(where)
    .orderBy(asc(coffeeChatHolds.startTime), asc(coffeeChatHolds.createdAt));
  return rows;
}

/**
 * Everything that takes a room right now: active chats with a room, plus
 * every room hold. Other sponsors' entries block offers, moves and holds.
 */
async function roomUses(conn: Db | Tx, now: Date): Promise<RoomUse[]> {
  const [chats, holds] = await Promise.all([
    activeRoomChats(conn, now),
    loadHolds(conn),
  ]);
  return [...chats, ...holds.map(holdAsRoomUse)];
}

/**
 * Lock coffee chat rooms for the rest of the transaction, so two sponsors
 * can't both claim a room at one time (their sponsor-row locks don't cover
 * each other). One lock for every room: which rooms a write touches is only
 * known after reading rows (moved chats, holds, sheet labels), and a single
 * key taken FIRST, before any row lock, in every transaction that places
 * chats or holds in rooms (offer, Move room, assign room, create or move a
 * hold) means no lock-order cycle is possible. Writes are tiny and there
 * are three rooms, so serializing them costs nothing noticeable.
 */
const ROOM_WRITES_LOCK = "coffee-chat-room-writes";
async function lockRoomWrites(tx: Tx) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${ROOM_WRITES_LOCK}))`,
  );
}

const problemMessage: Record<OfferProblem, string> = {
  noBlock: errors.noBlock,
  notInWindow: errors.notInWindow,
  tooLate: errors.tooLate,
  full: errors.full,
  hackerBusy: errors.hackerBusy,
  roomTaken: errors.roomTaken,
};

export function throwProblem(problem: OfferProblem): never {
  throw new TRPCError({
    code:
      problem === "notInWindow" || problem === "noBlock"
        ? "BAD_REQUEST"
        : "CONFLICT",
    message: problemMessage[problem],
  });
}

/** True for a Postgres unique violation, however the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; ) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export type CoffeeChatOffer = {
  chatId: string;
  firstName: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: CoffeeChatStatus;
  /** ISO time the hacker must answer by. */
  expiresAt: string;
};

/** A hacker's own chat, as /live shows it. */
export type MyCoffeeChat = {
  chatId: string;
  sponsorName: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  repName: string | null;
  /** Effective status: an unanswered request past its cutoff is "expired". */
  status: CoffeeChatStatus;
  startsAt: string;
  /** ISO time a pending request stops being answerable. */
  expiresAt: string;
};

/** One of a sponsor's own chats, as /sponsors/[uuid]/coffee-chats shows it. */
export type SponsorCoffeeChat = {
  chatId: string;
  firstName: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  repName: string | null;
  /** Effective status: an unanswered request past its cutoff is "expired". */
  status: CoffeeChatStatus;
  startsAt: string;
};

/** One booked chat on the organizer page. */
export type OrganizerCoffeeChat = {
  chatId: string;
  sponsorName: string;
  firstName: string;
  lastName: string | null;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: CoffeeChatStatus;
  startsAt: string;
};

/**
 * Lock a chat for an organizer change: its sponsor row first (same order as
 * offers), then the chat. 404 when missing; 409 once it no longer holds a
 * seat (declined, expired, cancelled).
 */
async function lockActiveChat(tx: Tx, chatId: string, now: Date) {
  const [found] = await tx
    .select({ sponsorId: coffeeChats.sponsorId })
    .from(coffeeChats)
    .where(eq(coffeeChats.id, chatId));
  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.chatNotFound });
  }
  await findSponsor(tx, found.sponsorId, true);
  const [chat] = await tx
    .select()
    .from(coffeeChats)
    .where(eq(coffeeChats.id, chatId))
    .for("update");
  if (!chat || !isActiveCoffeeChat(chat, now)) {
    throw new TRPCError({ code: "CONFLICT", message: errors.alreadyOver });
  }
  return chat;
}

/**
 * Move some of a sponsor's live chats into `room` (null = no room yet),
 * with the same rules as offers: the caller holds lockRoomWrites, and no
 * other sponsor may have a chat or hold in `room` overlapping any of them. Returns the ids whose room changed.
 */
async function moveChatsToRoom(
  tx: Tx,
  sponsorId: string,
  moving: {
    id: string;
    room: string | null;
    slotTime: string;
    durationMinutes: number;
  }[],
  room: string | null,
  now: Date,
): Promise<string[]> {
  const roomChats = await roomUses(tx, now);
  if (
    moving.some((c) => roomTakenByOtherSponsor(roomChats, sponsorId, room, c))
  ) {
    throwProblem("roomTaken");
  }
  const changed = moving.filter((c) => c.room !== room).map((c) => c.id);
  if (changed.length > 0) {
    await tx
      .update(coffeeChats)
      .set({ room })
      .where(inArray(coffeeChats.id, changed));
  }
  return changed;
}

/** CONFLICT naming who already has the room, and when. */
function throwRoomUsed(
  room: string,
  use: RoomUse,
  sponsors: { id: string; name: string }[],
): never {
  const start = coffeeChatMinutesOf(use.slotTime) ?? 0;
  throw new TRPCError({
    code: "CONFLICT",
    message: errors.holdClash(
      room,
      sponsors.find((s) => s.id === use.sponsorId)?.name ?? "",
      formatClock(use.slotTime),
      formatClock(coffeeChatTimeOf(start + use.durationMinutes)),
    ),
  });
}

/**
 * Give a sponsor a room block, or change one (`holdId`: new room, start or
 * length). Refused when another sponsor has the room then (chats or
 * blocks), when it overlaps one of the sponsor's own blocks (one room at a
 * time), when it can't fit one of the sponsor's chats, or when a change
 * would leave a booked chat outside it. The sponsor's live chats inside the
 * block move into its room, and each moved hacker is told. Lock order as
 * everywhere: room writes, then the sponsor row, then the block.
 */
async function saveHold(input: {
  holdId?: string;
  sponsorId?: string;
  room: string;
  startTime: string;
  endTime: string;
  note?: string | null;
  createdBy?: string;
}): Promise<{ holdId: string; chatIds: string[] }> {
  const now = new Date();
  const room = coffeeChatRoomOf(input.room);
  if (!room) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.unknownRoom });
  }
  if (holdTimesProblem(input.startTime, input.endTime)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.holdTimes });
  }
  let sponsorId = input.sponsorId;
  if (input.holdId) {
    const [found] = await db
      .select({ sponsorId: coffeeChatHolds.sponsorId })
      .from(coffeeChatHolds)
      .where(eq(coffeeChatHolds.id, input.holdId));
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: errors.holdNotFound });
    }
    sponsorId = found.sponsorId;
  }
  if (!sponsorId) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownSponsor });
  }
  const forSponsor = sponsorId;
  const named = await findSponsor(db, forSponsor);
  const { durationMinutes } = requestWithFallback(
    await setupOrNull(named.name),
    named,
    await activeChats(db, eq(coffeeChats.sponsorId, named.id), new Date()),
  );
  const span: HoldSpan = {
    sponsorId: named.id,
    room,
    startTime: input.startTime,
    endTime: input.endTime,
  };
  if (!holdFitsChat(holdMinutes(span), durationMinutes)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.blockTooShort(durationMinutes),
    });
  }

  const result = await db.transaction(async (tx) => {
    // Lock order everywhere: room writes, sponsor row, block or chat rows.
    await lockRoomWrites(tx);
    const sponsor = await findSponsor(tx, forSponsor, true);
    const own = await loadHolds(tx, eq(coffeeChatHolds.sponsorId, sponsor.id));
    const before = input.holdId
      ? own.find((h) => h.holdId === input.holdId)
      : undefined;
    if (input.holdId) {
      const [held] = await tx
        .select({ id: coffeeChatHolds.id })
        .from(coffeeChatHolds)
        .where(eq(coffeeChatHolds.id, input.holdId))
        .for("update");
      if (!held || !before) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: errors.holdNotFound,
        });
      }
    }
    if (ownHoldOverlap(span, own, input.holdId)) {
      throw new TRPCError({ code: "CONFLICT", message: errors.ownBlockOverlap });
    }
    const live = await activeChats(
      tx,
      eq(coffeeChats.sponsorId, sponsor.id),
      now,
    );
    // A change never strands a booked chat outside its block.
    if (
      before &&
      live.some((c) => holdCovers(before, c) && !holdCovers(span, c))
    ) {
      throw new TRPCError({ code: "CONFLICT", message: errors.blockDropsChats });
    }
    const moving = live.filter((c) => holdCovers(span, c));
    const sponsors = await tx
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors);
    const clash = holdClash(span, await roomUses(tx, now));
    if (clash) throwRoomUsed(room, clash, sponsors);

    let holdId = input.holdId;
    if (holdId) {
      await tx
        .update(coffeeChatHolds)
        .set({
          room,
          startTime: input.startTime,
          endTime: input.endTime,
          ...(input.note !== undefined ? { note: input.note } : {}),
        })
        .where(eq(coffeeChatHolds.id, holdId));
    } else {
      const [row] = await tx
        .insert(coffeeChatHolds)
        .values({
          sponsorId: sponsor.id,
          room,
          startTime: input.startTime,
          endTime: input.endTime,
          note: input.note ?? null,
          createdBy: input.createdBy ?? null,
        })
        .returning({ id: coffeeChatHolds.id });
      holdId = row!.id;
    }
    const chatIds = await moveChatsToRoom(tx, sponsor.id, moving, room, now);
    return { holdId, chatIds };
  });
  await Promise.all(
    result.chatIds.map((id) => notifyCoffeeChat("roomMoved", { id })),
  );
  return result;
}

/** ILIKE pattern for "contains text", with %, _ and \ taken literally. */
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
}

/** An admitted hacker found by an organizer's search. */
export type OrganizerHackerMatch = {
  userId: string;
  name: string;
  email: string;
  /** Badge / wallet pass code ("brave-otter-kite"), once issued. */
  hackerId: string | null;
};

/**
 * Offer a coffee chat: a pending request the hacker accepts or declines on
 * /live, with every capacity, overlap and room rule. Shared by the
 * sponsor's `offer` and the organizer's `organizerOffer`. Locks the sponsor
 * and hacker rows so two offers for the last seat (or two sponsors for one
 * hacker) can't both go through. Notifies the hacker after the commit.
 */
export async function createCoffeeChatOffer(input: {
  sponsorId: string;
  userId: string;
  slotTime: string;
  repName?: string;
}): Promise<CoffeeChatOffer> {
  const now = new Date();
  const sponsor = await findSponsor(db, input.sponsorId);
  const hacker = await findAdmittedHacker(input.userId, now);
  const setup = await setupFor(sponsor.name);

  try {
    const chat = await db.transaction(async (tx) => {
      // Lock order: room writes, sponsor, then hacker. Every writer uses
      // this order (writers that skip a step keep the rest in order).
      await lockRoomWrites(tx);
      const locked = await findSponsor(tx, sponsor.id, true);
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, hacker.userId))
        .for("update");

      // Still admitted now that the hacker row is locked.
      await findAdmittedHacker(hacker.userId, now, tx);

      const sponsorChats = await activeChats(
        tx,
        eq(coffeeChats.sponsorId, sponsor.id),
        now,
      );
      const holds = await loadHolds(
        tx,
        eq(coffeeChatHolds.sponsorId, sponsor.id),
      );
      const request = chatRequestOf(setup, locked);
      const limits = await loadLimits(
        tx,
        eq(coffeeChatLimits.sponsorId, sponsor.id),
      );
      const { durationMinutes } = request;
      // The room of the sponsor's block covering this start (no block =
      // no offer). Room writes are locked, so nobody can take it meanwhile.
      const room = offerRoomAt({
        sponsorId: sponsor.id,
        holds,
        slot: { slotTime: input.slotTime },
      });
      const [hackerChats, roomChats] = await Promise.all([
        activeChats(tx, eq(coffeeChats.userId, hacker.userId), now),
        roomUses(tx, now),
      ]);
      const problem = offerProblem({
        request,
        limits,
        slotTime: input.slotTime,
        sponsorId: sponsor.id,
        sponsorChats,
        hackerChats,
        roomChats,
        holds,
        now,
      });
      if (problem) throwProblem(problem);

      const [row] = await tx
        .insert(coffeeChats)
        .values({
          sponsorId: sponsor.id,
          userId: hacker.userId,
          room,
          slotTime: input.slotTime,
          durationMinutes,
          repName: input.repName ? input.repName : null,
        })
        .returning();
      return row!;
    });
    // After the commit; capped in time, never throws.
    await notifyCoffeeChat("offered", { id: chat.id });

    return {
      chatId: chat.id,
      firstName: hacker.firstName,
      slotTime: chat.slotTime,
      durationMinutes: chat.durationMinutes,
      room: chat.room,
      status: chat.status,
      expiresAt: coffeeChatExpiresAt(chat.slotTime).toISOString(),
    };
  } catch (error) {
    // The partial unique index: the hacker already has a live chat
    // starting then (a race the row lock didn't cover).
    if (isUniqueViolation(error)) throwProblem("hackerBusy");
    throw error;
  }
}

/**
 * The sponsor's sheet row, or null when the sheet can't be read. Writers
 * that only need the chat length use this so a sheet outage never blocks
 * them; the length then falls back to their booked chats', else 15 min.
 */
async function setupOrNull(sponsorName: string) {
  return setupFor(sponsorName).catch(() => null);
}

/** The chat request in force, with the fallback length when needed. */
function requestWithFallback(
  setup: CoffeeChatSetup | null,
  saved: { style: string | null; perSlot: number | null },
  live: readonly { durationMinutes: number }[],
) {
  const request = chatRequestOf(setup, saved);
  return setup
    ? request
    : { ...request, durationMinutes: live[0]?.durationMinutes ?? 15 };
}

/**
 * Hackers booked in each of the sponsor's slots (by slot start), counted
 * with chatsInSlot like offers and block slots.
 */
function bookedBySlot(
  live: readonly { slotTime: string; durationMinutes: number }[],
  durationMinutes: number,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of new Set(live.map((c) => c.slotTime))) {
    out.set(t, chatsInSlot(live, t, durationMinutes).length);
  }
  return out;
}

/**
 * Save a sponsor's chat request (style + hackers per slot). Refused when it
 * would leave a slot asking for fewer hackers than are already booked
 * there. Lock order as everywhere: room writes, then the sponsor row.
 */
async function saveChatRequest(input: {
  sponsorId: string;
  style: (typeof CHAT_STYLES)[number];
  perSlot: number;
}) {
  const now = new Date();
  const named = await findSponsor(db, input.sponsorId);
  const setup = await setupOrNull(named.name);
  return db.transaction(async (tx) => {
    await lockRoomWrites(tx);
    const sponsor = await findSponsor(tx, named.id, true);
    const [live, limits] = await Promise.all([
      activeChats(tx, eq(coffeeChats.sponsorId, sponsor.id), now),
      loadLimits(tx, eq(coffeeChatLimits.sponsorId, sponsor.id)),
    ]);
    const before = requestWithFallback(setup, sponsor, live);
    const next = { perSlot: input.perSlot };
    for (const [slotTime, booked] of bookedBySlot(
      live,
      before.durationMinutes,
    )) {
      const asked = askedAt(next, limits, sponsor.id, slotTime).asked;
      const was = askedAt(before, limits, sponsor.id, slotTime).asked;
      if (booked > asked && asked < was) {
        throw new TRPCError({
          code: "CONFLICT",
          message: errors.requestBelowBooked(formatClock(slotTime), booked),
        });
      }
    }
    const [row] = await tx
      .update(sponsorJudgingSponsors)
      .set({ coffeeChatStyle: input.style, coffeeChatPerSlot: input.perSlot })
      .where(eq(sponsorJudgingSponsors.id, sponsor.id))
      .returning({
        style: sponsorJudgingSponsors.coffeeChatStyle,
        perSlot: sponsorJudgingSponsors.coffeeChatPerSlot,
      });
    return row!;
  });
}

const chatRequestInput = {
  style: z.enum(CHAT_STYLES),
  perSlot: z.number().int().min(MIN_PER_SLOT).max(MAX_PER_SLOT),
};

/** Most "Ask for fewer" rows one sponsor can keep. */
const MAX_LIMITS_PER_SPONSOR = 200;

/**
 * "Ask for fewer": at most `hackers` per slot starting in the span, 0 = no
 * chat then. The span is one slot (one chat length) or part of one clock
 * hour, on the grid, and inside one of the sponsor's own blocks, so a
 * sponsor never touches another sponsor's times. Asking for the full
 * request again clears the ask. Refused when more hackers are booked in a
 * slot than the new number, or past MAX_LIMITS_PER_SPONSOR rows. Lock
 * order as everywhere: room writes, the sponsor row, then chats.
 */
async function saveSlotLimit(input: {
  sponsorId: string;
  startTime: string;
  endTime: string;
  hackers: number;
}) {
  const start = coffeeChatMinutesOf(input.startTime);
  const end = coffeeChatMinutesOf(input.endTime);
  const sameHour =
    start !== null && end !== null && Math.floor(start / 60) * 60 + 60 >= end;
  if (start === null || end === null || end <= start || !sameHour) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.limitTimes });
  }
  const now = new Date();
  const named = await findSponsor(db, input.sponsorId);
  const setup = await setupOrNull(named.name);
  return db.transaction(async (tx) => {
    await lockRoomWrites(tx);
    const sponsor = await findSponsor(tx, named.id, true);
    const [live, holds, limits] = await Promise.all([
      activeChats(tx, eq(coffeeChats.sponsorId, sponsor.id), now),
      loadHolds(tx, eq(coffeeChatHolds.sponsorId, sponsor.id)),
      loadLimits(tx, eq(coffeeChatLimits.sponsorId, sponsor.id)),
    ]);
    const request = requestWithFallback(setup, sponsor, live);
    const oneSlot = end - start === request.durationMinutes;
    const inBlock = holds.some((h) => {
      const hs = coffeeChatMinutesOf(h.startTime);
      const he = coffeeChatMinutesOf(h.endTime);
      return hs !== null && he !== null && start >= hs && end <= he;
    });
    if (!inBlock || (!oneSlot && end - start > 60)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: errors.limitTimes });
    }
    const span = and(
      eq(coffeeChatLimits.sponsorId, sponsor.id),
      eq(coffeeChatLimits.startTime, input.startTime),
      eq(coffeeChatLimits.endTime, input.endTime),
    );
    if (input.hackers >= request.perSlot) {
      await tx.delete(coffeeChatLimits).where(span);
      return { cleared: true };
    }
    for (const [slotTime, booked] of bookedBySlot(
      live,
      request.durationMinutes,
    )) {
      const t = coffeeChatMinutesOf(slotTime);
      if (t === null || t < start || t >= end) continue;
      if (booked > input.hackers) {
        throw new TRPCError({
          code: "CONFLICT",
          message: errors.limitBelowBooked,
        });
      }
    }
    const exists = limits.some(
      (l) => l.startTime === input.startTime && l.endTime === input.endTime,
    );
    if (!exists && limits.length >= MAX_LIMITS_PER_SPONSOR) {
      throw new TRPCError({ code: "BAD_REQUEST", message: errors.tooManyLimits });
    }
    await tx
      .insert(coffeeChatLimits)
      .values({
        sponsorId: sponsor.id,
        startTime: input.startTime,
        endTime: input.endTime,
        hackers: input.hackers,
      })
      .onConflictDoUpdate({
        target: [
          coffeeChatLimits.sponsorId,
          coffeeChatLimits.startTime,
          coffeeChatLimits.endTime,
        ],
        set: { hackers: input.hackers },
      });
    return { cleared: false };
  });
}

export const coffeeChatRequestsRouter = createTRPCRouter({
  /**
   * The sponsor's chat request: 1-on-1 with N reps, or one group of M
   * hackers. Public (sponsor UUID): the UUID only reaches its own row.
   */
  setChatRequest: publicProcedure
    .input(z.object({ sponsor: sponsorInput, ...chatRequestInput }))
    .mutation(({ input }) =>
      saveChatRequest({ ...input, sponsorId: input.sponsor }),
    ),

  /** An organizer edits a sponsor's request for them. Organizers only. */
  organizerSetChatRequest: protectedOrganizerProcedure
    .input(z.object({ sponsorId: sponsorInput, ...chatRequestInput }))
    .mutation(({ input }) => saveChatRequest(input)),

  /**
   * "Ask for fewer" hackers from startTime to endTime (a slot or an hour).
   * Public (sponsor UUID). Rules in saveSlotLimit.
   */
  askForFewer: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        startTime: slotTimeInput,
        endTime: slotTimeInput,
        hackers: z.number().int().min(0).max(MAX_PER_SLOT),
      }),
    )
    .mutation(({ input }) =>
      saveSlotLimit({ ...input, sponsorId: input.sponsor }),
    ),

  /**
   * Who a scanned badge belongs to, for the sponsor's offer card. Public
   * (sponsor UUID). Only the first name, plus links when the hacker agreed
   * to share with sponsors. Anyone but an admitted hacker is a 404.
   */
  hacker: publicProcedure
    .input(z.object({ sponsor: sponsorInput, userId: userIdInput }))
    .query(async ({ input }) => {
      await findSponsor(db, input.sponsor);
      return findAdmittedHacker(input.userId);
    }),

  /**
   * Same as `hacker`, for whatever a sponsor scanned or typed: the hacker
   * ID on badges and wallet passes ("brave-otter-kite", any case or
   * spacing) or the user id in the /live QR. Same rules and errors.
   */
  hackerByCode: publicProcedure
    .input(z.object({ sponsor: sponsorInput, code: userIdInput }))
    .query(async ({ input }) => {
      await findSponsor(db, input.sponsor);
      return findAdmittedHacker(await resolveScannedUserId(input.code));
    }),

  /**
   * Open start times for the sponsor, earliest first. With `userId`, leaves
   * out times that clash with that hacker's chats. Public (sponsor UUID).
   */
  freeTimes: publicProcedure
    .input(z.object({ sponsor: sponsorInput, userId: userIdInput.optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const sponsor = await findSponsor(db, input.sponsor);
      if (input.userId) await findAdmittedHacker(input.userId, now);
      const setup = await setupFor(sponsor.name);
      const [sponsorChats, hackerChats, roomChats, holds, limits] =
        await Promise.all([
          activeChats(db, eq(coffeeChats.sponsorId, sponsor.id), now),
          input.userId
            ? activeChats(db, eq(coffeeChats.userId, input.userId), now)
            : Promise.resolve([]),
          roomUses(db, now),
          loadHolds(db, eq(coffeeChatHolds.sponsorId, sponsor.id)),
          loadLimits(db, eq(coffeeChatLimits.sponsorId, sponsor.id)),
        ]);
      const request = chatRequestOf(setup, sponsor);
      return {
        durationMinutes: request.durationMinutes,
        request,
        /** "Your Hack Western contact for chats": set by organizers. */
        watcherName: sponsor.watcher,
        times: freeStartTimes({
          request,
          limits,
          sponsorId: sponsor.id,
          sponsorChats,
          hackerChats,
          roomChats,
          holds,
          now,
        }),
      };
    }),

  /**
   * Offer a coffee chat to a scanned hacker at a start time. Public (sponsor
   * UUID). Creates a pending request the hacker accepts or declines on
   * /live. Locks the sponsor and hacker rows so two offers for the last
   * seat (or two sponsors for one hacker) can't both go through.
   */
  offer: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        userId: userIdInput,
        slotTime: slotTimeInput,
        repName: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(({ input }) =>
      createCoffeeChatOffer({ ...input, sponsorId: input.sponsor }),
    ),
  /**
   * The sponsor's own chats, earliest first, with expiry computed now.
   * Public (sponsor UUID). Only each hacker's first name, as on scan.
   */
  sponsorChats: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }) => {
      const now = new Date();
      const sponsor = await findSponsor(db, input.sponsor);
      const rows = await db
        .select({
          chatId: coffeeChats.id,
          firstName: applications.firstName,
          userName: users.name,
          slotTime: coffeeChats.slotTime,
          expiresAt: coffeeChats.expiresAt,
          durationMinutes: coffeeChats.durationMinutes,
          room: coffeeChats.room,
          repName: coffeeChats.repName,
          status: coffeeChats.status,
        })
        .from(coffeeChats)
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .where(eq(coffeeChats.sponsorId, sponsor.id))
        .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt));
      const chats: SponsorCoffeeChat[] = rows.map(
        ({ firstName, userName, ...row }) => {
          const { status, startsAt } = coffeeChatTimes(row, now);
          return {
            ...row,
            firstName: firstName?.trim()
              ? firstName.trim()
              : (userName?.trim().split(/\s+/)[0] ?? ""),
            status,
            startsAt,
          };
        },
      );
      // Only this sponsor's blocks (same UUID scoping as their chats). The
      // sheet only adds the chat type; without it, 1-on-1 15 min.
      const [holdRows, live, setup, limits] = await Promise.all([
        loadHolds(db, eq(coffeeChatHolds.sponsorId, sponsor.id)),
        activeChats(db, eq(coffeeChats.sponsorId, sponsor.id), now),
        setupFor(sponsor.name).catch(() => null),
        loadLimits(db, eq(coffeeChatLimits.sponsorId, sponsor.id)),
      ]);
      const request = chatRequestOf(setup, sponsor);
      const holds = holdsForSponsor(
        holdRows,
        sponsor.id,
        live,
        request,
        limits,
        now,
      );
      return {
        sponsorName: sponsor.name,
        watcherName: sponsor.watcher,
        request,
        /** The sheet row's window and chatting hours, for "Your chat setup". */
        sheet: setup
          ? {
              windowStart: setup.windowStart,
              windowEnd: setup.windowEnd,
              chattingHours: setup.chattingHours,
            }
          : null,
        limits,
        chats,
        holds,
      };
    }),

  /**
   * The signed-in hacker's coffee chats, earliest first, with expiry
   * computed now (no background job).
   */
  mine: protectedProcedure.query(async ({ ctx }): Promise<MyCoffeeChat[]> => {
    // Hackers' /live traffic drives the Saturday invite rounds (throttled,
    // no-op unless a round is due and sponsors were sent).
    await kickDueInviteRounds();
    const now = new Date();
    const rows = await db
      .select({
        chatId: coffeeChats.id,
        sponsorName: sponsorJudgingSponsors.name,
        slotTime: coffeeChats.slotTime,
        expiresAt: coffeeChats.expiresAt,
        durationMinutes: coffeeChats.durationMinutes,
        room: coffeeChats.room,
        repName: coffeeChats.repName,
        status: coffeeChats.status,
      })
      .from(coffeeChats)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
      )
      .where(eq(coffeeChats.userId, ctx.session.user.id))
      .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt));
    return rows.map((row) => ({ ...row, ...coffeeChatTimes(row, now) }));
  }),

  /**
   * The signed-in user's own hacker ID ("brave-otter-kite"), for sponsors
   * to type in. Null until one is issued (confirmed hackers get one with
   * their badge or wallet pass). Reads only the caller's row; never creates.
   */
  myHackerId: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ hackerId: users.hackerId })
      .from(users)
      .where(eq(users.id, ctx.session.user.id));
    return { hackerId: row?.hackerId ?? null };
  }),

  /**
   * Accept or decline one of your own requests. Someone else's chat is a
   * 404. Accepting needs a pending request before its cutoff; declining
   * frees the seat (also after accepting, until the chat starts).
   */
  respond: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        answer: z.enum(["accept", "decline"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      respondToCoffeeChat(ctx.session.user.id, input),
    ),
  /** Every booked chat plus the rooms chats can move to. Organizers only. */
  organizerChats: protectedOrganizerProcedure.query(async () => {
    const now = new Date();
    const [rows, rooms] = await Promise.all([
      db
        .select({
          chatId: coffeeChats.id,
          sponsorName: sponsorJudgingSponsors.name,
          firstName: applications.firstName,
          lastName: applications.lastName,
          userName: users.name,
          slotTime: coffeeChats.slotTime,
          expiresAt: coffeeChats.expiresAt,
          durationMinutes: coffeeChats.durationMinutes,
          room: coffeeChats.room,
          status: coffeeChats.status,
        })
        .from(coffeeChats)
        .innerJoin(
          sponsorJudgingSponsors,
          eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
        )
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .orderBy(
          asc(coffeeChats.slotTime),
          asc(sponsorJudgingSponsors.name),
          asc(coffeeChats.createdAt),
        ),
      [...COFFEE_CHAT_ROOMS] as string[],
    ]);
    const chats: OrganizerCoffeeChat[] = rows.map(
      ({ userName, firstName, ...row }) => {
        const { status, startsAt } = coffeeChatTimes(row, now);
        return {
          ...row,
          firstName: firstName?.trim() ? firstName : (userName ?? ""),
          status,
          startsAt,
        };
      },
    );
    return { chats, rooms };
  }),

  /**
   * Cancel a booked chat (pending or accepted); frees its seat. Organizers
   * only, instead of editing the sheet (no two-way sync).
   */
  cancel: protectedOrganizerProcedure
    .input(z.object({ chatId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const chat = await lockActiveChat(tx, input.chatId, now);
        await tx
          .update(coffeeChats)
          .set({ status: "cancelled" })
          .where(eq(coffeeChats.id, chat.id));
        return { chatId: chat.id, status: "cancelled" as const };
      });
      await notifyCoffeeChat("cancelled", { id: result.chatId });
      return result;
    }),

  /**
   * Move a chat's room block (with every chat in it) to another room, so a
   * chat never sits in a room without its block. Same rules as giving a
   * room: a coffee chat room nobody else has then. A chat with no block
   * (booked before blocks) moves with the sponsor's chats overlapping it.
   * Organizers only.
   */
  moveRoom: protectedOrganizerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        room: z.string().trim().min(1).max(64),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const room = coffeeChatRoomOf(input.room);
      if (!room) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.unknownRoom,
        });
      }
      const result = await db.transaction(async (tx) => {
        await lockRoomWrites(tx);
        const chat = await lockActiveChat(tx, input.chatId, now);
        const live = await activeChats(
          tx,
          eq(coffeeChats.sponsorId, chat.sponsorId),
          now,
        );
        const block = ownHoldAt(
          await loadHolds(tx, eq(coffeeChatHolds.sponsorId, chat.sponsorId)),
          chat.sponsorId,
          chat,
        );
        const moving = block
          ? live.filter((c) => holdCovers(block, c))
          : live.filter((c) => coffeeChatsOverlap(c, chat));
        if (block && normalizeRoom(block.room) !== normalizeRoom(room)) {
          if (holdClash({ ...block, room }, await roomUses(tx, now))) {
            throwProblem("roomTaken");
          }
          await tx
            .update(coffeeChatHolds)
            .set({ room })
            .where(eq(coffeeChatHolds.id, block.holdId));
        }
        await moveChatsToRoom(tx, chat.sponsorId, moving, room, now);
        return { room, chatIds: moving.map((c) => c.id) };
      });
      // Every moved chat is notified (in parallel, each under the same cap).
      await Promise.all(
        result.chatIds.map((id) => notifyCoffeeChat("roomMoved", { id })),
      );
      return result;
    }),

  /**
   * The Saturday board: every sponsor (setup, room, watcher, reps) by every
   * 15-minute slot, with all chats and the seats used at each start time.
   * Also the rooms chats can move to and watcher suggestions. Organizers
   * only.
   */
  organizerChatBoard: protectedOrganizerProcedure.query(async () => {
    const now = new Date();
    const sponsors = await db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
        style: sponsorJudgingSponsors.coffeeChatStyle,
        perSlot: sponsorJudgingSponsors.coffeeChatPerSlot,
        watcher: sponsorJudgingSponsors.coffeeChatWatcher,
      })
      .from(sponsorJudgingSponsors);
    const [setups, rows, rooms, organizers, holds, limits] = await Promise.all([
      readSheetCoffeeChatSetups(sponsors.map((s) => s.name)),
      db
        .select({
          chatId: coffeeChats.id,
          sponsorId: coffeeChats.sponsorId,
          firstName: applications.firstName,
          lastName: applications.lastName,
          userName: users.name,
          hackerId: users.hackerId,
          share: applications.agreeShareWithSponsors,
          githubLink: applications.githubLink,
          slotTime: coffeeChats.slotTime,
          expiresAt: coffeeChats.expiresAt,
          durationMinutes: coffeeChats.durationMinutes,
          room: coffeeChats.room,
          repName: coffeeChats.repName,
          status: coffeeChats.status,
        })
        .from(coffeeChats)
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt)),
      [...COFFEE_CHAT_ROOMS] as string[],
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.type, "organizer"))
        .orderBy(asc(users.name)),
      loadHolds(db),
      loadLimits(db),
    ]);
    const board = buildChatBoard({
      holds,
      limits,
      sponsors,
      setups,
      // GitHub (the avatar photo) only for hackers who agreed to share.
      chats: rows.map(({ userName, firstName, share, githubLink, ...row }) => ({
        ...row,
        firstName: firstName?.trim() ? firstName : (userName ?? ""),
        github: share ? (githubLink ?? null) : null,
      })),
      now,
    });
    const watchers = [
      ...new Set(
        organizers.map((o) => o.name?.trim() ?? "").filter((n) => n.length > 0),
      ),
    ];
    return {
      ...board,
      rooms,
      assignableRooms: [...COFFEE_CHAT_ROOMS] as string[],
      /** Every registered sponsor, for stable sponsor colours. */
      colorNames: sponsors.map((s) => s.name),
      watchers,
      readAt: now.toISOString(),
    };
  }),

  /**
   * Give a sponsor a room block: one coffee chat room for a stretch of
   * Saturday time (15 min to 1 hr 30) that hackers are booked into.
   * Rules in saveHold. Organizers only.
   */
  createHold: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: sponsorInput,
        room: z.string().trim().min(1).max(64),
        startTime: slotTimeInput,
        endTime: slotTimeInput,
        note: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      saveHold({
        ...input,
        sponsorId: input.sponsorId.toLowerCase(),
        note: input.note ? input.note : null,
        createdBy: ctx.session.user.id,
      }),
    ),

  /**
   * Change a block's room, start or length (same sponsor), with the same
   * rules as giving one. Organizers only.
   */
  moveHold: protectedOrganizerProcedure
    .input(
      z.object({
        holdId: z.string().uuid(),
        room: z.string().trim().min(1).max(64),
        startTime: slotTimeInput,
        endTime: slotTimeInput,
      }),
    )
    .mutation(({ input }) => saveHold(input)),

  /**
   * Release a block. Refused while live chats are booked in it (cancel
   * them first), so a chat never sits in a room without its block.
   * Organizers only.
   */
  deleteHold: protectedOrganizerProcedure
    .input(z.object({ holdId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      return db.transaction(async (tx) => {
        await lockRoomWrites(tx);
        const [hold] = await loadHolds(tx, eq(coffeeChatHolds.id, input.holdId));
        if (!hold) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.holdNotFound,
          });
        }
        await findSponsor(tx, hold.sponsorId, true);
        const live = await activeChats(
          tx,
          eq(coffeeChats.sponsorId, hold.sponsorId),
          now,
        );
        if (live.some((c) => holdCovers(hold, c))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: errors.blockHasChats,
          });
        }
        await tx
          .delete(coffeeChatHolds)
          .where(eq(coffeeChatHolds.id, hold.holdId));
        return { holdId: hold.holdId };
      });
    }),

  /**
   * Who on the sponsor team watches a sponsor's coffee chats (and so their
   * room): a name, or null to clear. Sponsors see it as their Hack Western
   * contact for chats. Organizers only.
   */
  setCoffeeChatWatcher: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: sponsorInput,
        watcher: z.string().trim().max(255).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const watcher = input.watcher ? input.watcher : null;
      const [row] = await db
        .update(sponsorJudgingSponsors)
        .set({ coffeeChatWatcher: watcher })
        .where(eq(sponsorJudgingSponsors.id, input.sponsorId.toLowerCase()))
        .returning({ id: sponsorJudgingSponsors.id });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: errors.unknownSponsor,
        });
      }
      return { sponsorId: row.id, watcher };
    }),

  /**
   * Admitted hackers matching a name, email or hacker ID, for adding a
   * chat by hand. Organizers only (emails stay off sponsor pages).
   */
  searchHackers: protectedOrganizerProcedure
    .input(z.object({ query: z.string().trim().min(2).max(100) }))
    .query(async ({ input }): Promise<OrganizerHackerMatch[]> => {
      const like = containsPattern(input.query);
      // Hacker IDs are words joined by dashes ("brave otter" -> "brave-otter").
      const codeLike = containsPattern(
        input.query.toLowerCase().replace(/\s+/g, "-"),
      );
      const rows = await db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          hackerId: users.hackerId,
          firstName: applications.firstName,
          lastName: applications.lastName,
          status: applications.status,
        })
        .from(users)
        .innerJoin(applications, eq(applications.userId, users.id))
        .where(
          and(
            eq(users.type, "hacker"),
            inArray(applications.status, [...admittedStatuses()]),
            or(
              ilike(users.name, like),
              ilike(users.email, like),
              ilike(users.hackerId, codeLike),
              ilike(
                sql`coalesce(${applications.firstName}, '') || ' ' || coalesce(${applications.lastName}, '')`,
                like,
              ),
            ),
          ),
        )
        .orderBy(asc(applications.firstName), asc(users.email))
        .limit(10);
      return rows.map((r) => {
        const fromApplication = [r.firstName, r.lastName]
          .map((part) => part?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        return {
          userId: r.userId,
          // First non-blank of: application name, account name, email.
          name:
            [fromApplication, r.name?.trim() ?? ""].find(
              (name) => name.length > 0,
            ) ?? r.email,
          email: r.email,
          hackerId: r.hackerId,
        };
      });
    }),

  /**
   * Add a coffee chat by hand for any sponsor: same rules as the sponsor's
   * offer (capacity, overlaps, rooms), still pending so the hacker accepts
   * on /live, and the same notification. Organizers only.
   */
  organizerOffer: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: sponsorInput,
        userId: userIdInput,
        slotTime: slotTimeInput,
        repName: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(({ input }) => createCoffeeChatOffer(input)),
});

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
  holdAsRoomUse,
  holdClash,
  holdCovers,
  holdsForSponsor,
  holdTimesProblem,
  type HoldSpan,
  type RoomUse,
} from "~/lib/coffee-chat-holds";
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  applyAssignedRooms,
  COFFEE_CHAT_ROOMS,
  coffeeChatExpiresAt,
  coffeeChatRoomClash,
  coffeeChatRoomOf,
  coffeeChatMinutesOf,
  coffeeChatsOverlap,
  coffeeChatTimeOf,
  isActiveCoffeeChat,
  resolveCoffeeChatRoom,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
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
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import { respondToCoffeeChat } from "~/server/api/utils/coffee-chat-respond";
import { resolveScannedUserId } from "~/server/api/utils/hacker-id";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
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
      reps: sponsorJudgingSponsors.coffeeChatReps,
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
 * Every sponsor's Coffee Chats row, with registered names matched and each
 * sponsor's organizer-assigned room applied (assignment > sheet ROOM).
 */
export async function readCoffeeChatSetups(): Promise<CoffeeChatSetup[]> {
  const sponsors = await db
    .select({
      name: sponsorJudgingSponsors.name,
      coffeeChatRoom: sponsorJudgingSponsors.coffeeChatRoom,
    })
    .from(sponsorJudgingSponsors);
  return applyAssignedRooms(
    await readSheetCoffeeChatSetups(sponsors.map((s) => s.name)),
    sponsors,
  );
}

/** The Coffee Chats tab as the sheet has it (no assignments applied). */
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

/** A room hold as the pages and rules see it. */
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
 * Lock rooms for the rest of the transaction, so two sponsors can't both
 * claim one room at the same time (their sponsor-row locks don't cover
 * each other). Taken after any row locks, in sorted order, so two writers
 * that need two rooms can't deadlock.
 */
async function lockRooms(tx: Tx, rooms: (string | null | undefined)[]) {
  const keys = [...new Set(rooms.map(normalizeRoom).filter(Boolean))].sort();
  for (const key of keys) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }
}

const problemMessage: Record<OfferProblem, string> = {
  notSetUp: errors.notSetUp,
  notInWindow: errors.notInWindow,
  tooLate: errors.tooLate,
  full: errors.full,
  hackerBusy: errors.hackerBusy,
  roomTaken: errors.roomTaken,
};

export function throwProblem(problem: OfferProblem): never {
  throw new TRPCError({
    code:
      problem === "notInWindow" || problem === "notSetUp"
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
 * Rooms an organizer can move a chat to: the coffee chat rooms plus any
 * room named in the Coffee Chats tab. The sheet is optional here, so a
 * failed read still leaves the standard rooms.
 */
async function knownRooms(): Promise<string[]> {
  const rooms: string[] = [...COFFEE_CHAT_ROOMS];
  const setups = await readCoffeeChatSetups().catch(() => []);
  for (const { room } of setups) {
    if (room && !rooms.some((r) => normalizeRoom(r) === normalizeRoom(room))) {
      rooms.push(room);
    }
  }
  return rooms;
}

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
 * with the same rules as offers: the rooms involved are locked (call after
 * locking the sponsor row), and no other sponsor may have a chat in `room`
 * overlapping any of them. Returns the ids whose room changed.
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
  await lockRooms(tx, [room, ...moving.map((c) => c.room)]);
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

/**
 * Every sponsor's coffee chat window as a room use in their effective room
 * (assignment, else sheet ROOM). Sponsors without a window or room take
 * no room this way.
 */
function windowRoomUses(
  sponsors: { id: string; name: string; assigned: string | null }[],
  setups: CoffeeChatSetup[],
): RoomUse[] {
  return sponsors.flatMap((s) => {
    const setup = setups.find((c) => c.sponsor === s.name);
    const room = resolveCoffeeChatRoom(s.assigned, setup?.room);
    const start = setup?.windowStart
      ? coffeeChatMinutesOf(setup.windowStart)
      : null;
    const end = setup?.windowEnd ? coffeeChatMinutesOf(setup.windowEnd) : null;
    if (!room || start === null || end === null || end <= start) return [];
    return [
      {
        sponsorId: s.id,
        room,
        slotTime: setup!.windowStart!,
        durationMinutes: end - start,
      },
    ];
  });
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
 * Create a hold, or move one (`holdId`), after checking no other sponsor
 * has the room then (chats, holds or room window). The sponsor's live chats
 * starting inside the hold move into its room (hold room comes first), and
 * each moved hacker is told. Lock order as everywhere: sponsor row, then
 * the hold, then rooms.
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
  const names = await db
    .select({ name: sponsorJudgingSponsors.name })
    .from(sponsorJudgingSponsors);
  const setups = await readSheetCoffeeChatSetups(names.map((s) => s.name));

  const result = await db.transaction(async (tx) => {
    const sponsor = await findSponsor(tx, forSponsor, true);
    let previousRoom: string | null = null;
    if (input.holdId) {
      const [held] = await tx
        .select({ room: coffeeChatHolds.room })
        .from(coffeeChatHolds)
        .where(eq(coffeeChatHolds.id, input.holdId))
        .for("update");
      if (!held) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: errors.holdNotFound,
        });
      }
      previousRoom = held.room;
    }
    const span: HoldSpan = {
      sponsorId: sponsor.id,
      room,
      startTime: input.startTime,
      endTime: input.endTime,
    };
    const moving = (
      await activeChats(tx, eq(coffeeChats.sponsorId, sponsor.id), now)
    ).filter((c) => holdCovers(span, c));
    await lockRooms(tx, [room, previousRoom, ...moving.map((c) => c.room)]);
    const sponsors = await tx
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
        assigned: sponsorJudgingSponsors.coffeeChatRoom,
      })
      .from(sponsorJudgingSponsors);
    const uses = [
      ...(await roomUses(tx, now)),
      ...windowRoomUses(sponsors, setups),
    ];
    const clash = holdClash(span, uses);
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

/** One sponsor's coffee chat setup and room, on the organizer page. */
export type OrganizerCoffeeChatRoom = {
  /** Null when the sheet names a sponsor that isn't registered. */
  sponsorId: string | null;
  sponsor: string;
  windowStart: string | null;
  windowEnd: string | null;
  durationMinutes: number;
  groupSize: number;
  hackers: number | null;
  /** Organizer assignment (one of COFFEE_CHAT_ROOMS), or null. */
  assignedRoom: string | null;
  /** The sheet's ROOM value, used when nothing is assigned. */
  sheetRoom: string | null;
  /** Sponsor-team member watching this sponsor's chats (free text). */
  watcher: string | null;
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
      // Lock order: sponsor, then hacker. Every writer uses this order.
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
      const durationMinutes = setup?.durationMinutes ?? 15;
      // The sponsor's room at this start: their hold's, else where their
      // chats then already are (organizer moves), else assigned or sheet
      // room. Locked before checking who else is in it.
      const room = offerRoomAt({
        sponsorId: sponsor.id,
        sponsorChats,
        setupRoom: setup?.room ?? null,
        holds,
        slot: { slotTime: input.slotTime, durationMinutes },
      });
      await lockRooms(tx, [room]);
      const [hackerChats, roomChats] = await Promise.all([
        activeChats(tx, eq(coffeeChats.userId, hacker.userId), now),
        roomUses(tx, now),
      ]);
      const problem = offerProblem({
        setup,
        slotTime: input.slotTime,
        reps: locked.reps,
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

export const coffeeChatRequestsRouter = createTRPCRouter({
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
      const [sponsorChats, hackerChats, roomChats, holds] = await Promise.all([
        activeChats(db, eq(coffeeChats.sponsorId, sponsor.id), now),
        input.userId
          ? activeChats(db, eq(coffeeChats.userId, input.userId), now)
          : Promise.resolve([]),
        roomUses(db, now),
        loadHolds(db, eq(coffeeChatHolds.sponsorId, sponsor.id)),
      ]);
      return {
        room: setup?.room ?? null,
        durationMinutes: setup?.durationMinutes ?? 15,
        groupSize: setup?.groupSize ?? 1,
        reps: sponsor.reps,
        /** "Your Hack Western contact for chats": set by organizers. */
        watcherName: sponsor.watcher,
        times: freeStartTimes({
          setup,
          reps: sponsor.reps,
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
      // Only this sponsor's holds (same UUID scoping as their chats).
      const [holdRows, live] = await Promise.all([
        loadHolds(db, eq(coffeeChatHolds.sponsorId, sponsor.id)),
        activeChats(db, eq(coffeeChats.sponsorId, sponsor.id), now),
      ]);
      const holds = holdsForSponsor(holdRows, sponsor.id, live);
      return {
        sponsorName: sponsor.name,
        watcherName: sponsor.watcher,
        chats,
        holds,
      };
    }),

  /**
   * The signed-in hacker's coffee chats, earliest first, with expiry
   * computed now (no background job).
   */
  mine: protectedProcedure.query(async ({ ctx }): Promise<MyCoffeeChat[]> => {
    const now = new Date();
    const rows = await db
      .select({
        chatId: coffeeChats.id,
        sponsorName: sponsorJudgingSponsors.name,
        slotTime: coffeeChats.slotTime,
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
      knownRooms(),
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
   * Move a sponsor's room for one slot: the chosen chat and every other live
   * chat of that sponsor overlapping it move together, so a sponsor is never
   * in two rooms at once, and later offers at that start use the new room.
   * Same rules as offering: a known coffee chat room, and no other sponsor
   * in it at an overlapping time. Organizers only.
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
      const room = (await knownRooms()).find(
        (known) => normalizeRoom(known) === normalizeRoom(input.room),
      );
      if (!room) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.unknownRoom,
        });
      }
      const result = await db.transaction(async (tx) => {
        const chat = await lockActiveChat(tx, input.chatId, now);
        const moving = (
          await activeChats(tx, eq(coffeeChats.sponsorId, chat.sponsorId), now)
        ).filter((c) => coffeeChatsOverlap(c, chat));
        await moveChatsToRoom(tx, chat.sponsorId, moving, room, now);
        // The sponsor's holds around those chats follow them, so later
        // offers there land in the new room too (hold room comes first).
        const holds = (
          await loadHolds(tx, eq(coffeeChatHolds.sponsorId, chat.sponsorId))
        ).filter(
          (h) =>
            normalizeRoom(h.room) !== normalizeRoom(room) &&
            moving.some((c) => holdCovers(h, c)),
        );
        if (holds.length > 0) {
          const uses = await roomUses(tx, now);
          if (holds.some((h) => holdClash({ ...h, room }, uses))) {
            throwProblem("roomTaken");
          }
          await tx
            .update(coffeeChatHolds)
            .set({ room })
            .where(
              inArray(
                coffeeChatHolds.id,
                holds.map((h) => h.holdId),
              ),
            );
        }
        return { room, chatIds: moving.map((c) => c.id) };
      });
      // A move takes the sponsor's whole slot, so every moved chat is notified
      // (in parallel, each under the same time cap).
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
        reps: sponsorJudgingSponsors.coffeeChatReps,
        assignedRoom: sponsorJudgingSponsors.coffeeChatRoom,
        watcher: sponsorJudgingSponsors.coffeeChatWatcher,
      })
      .from(sponsorJudgingSponsors);
    const [setups, rows, rooms, organizers, holds] = await Promise.all([
      readSheetCoffeeChatSetups(sponsors.map((s) => s.name)),
      db
        .select({
          chatId: coffeeChats.id,
          sponsorId: coffeeChats.sponsorId,
          firstName: applications.firstName,
          lastName: applications.lastName,
          userName: users.name,
          hackerId: users.hackerId,
          slotTime: coffeeChats.slotTime,
          durationMinutes: coffeeChats.durationMinutes,
          room: coffeeChats.room,
          repName: coffeeChats.repName,
          status: coffeeChats.status,
        })
        .from(coffeeChats)
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt)),
      knownRooms(),
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.type, "organizer"))
        .orderBy(asc(users.name)),
      loadHolds(db),
    ]);
    const board = buildChatBoard({
      holds,
      sponsors,
      setups,
      chats: rows.map(({ userName, firstName, ...row }) => ({
        ...row,
        firstName: firstName?.trim() ? firstName : (userName ?? ""),
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
      watchers,
      readAt: now.toISOString(),
    };
  }),

  /**
   * Every sponsor's Saturday coffee chat window, format and room, for the
   * organizer's room assignment. Registered sponsors without a sheet row
   * are listed too (no window yet). Organizers only.
   */
  organizerRooms: protectedOrganizerProcedure.query(async () => {
    const sponsors = await db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
        coffeeChatRoom: sponsorJudgingSponsors.coffeeChatRoom,
        watcher: sponsorJudgingSponsors.coffeeChatWatcher,
      })
      .from(sponsorJudgingSponsors)
      .orderBy(asc(sponsorJudgingSponsors.name));
    const setups = await readSheetCoffeeChatSetups(sponsors.map((s) => s.name));
    const rows: OrganizerCoffeeChatRoom[] = sponsors.map((s) => {
      const setup = setups.find((c) => c.sponsor === s.name);
      return {
        sponsorId: s.id,
        sponsor: s.name,
        windowStart: setup?.windowStart ?? null,
        windowEnd: setup?.windowEnd ?? null,
        durationMinutes: setup?.durationMinutes ?? 15,
        groupSize: setup?.groupSize ?? 1,
        hackers: setup?.hackers ?? null,
        assignedRoom: s.coffeeChatRoom,
        sheetRoom: setup?.room ?? null,
        watcher: s.watcher,
      };
    });
    for (const setup of setups) {
      if (sponsors.some((s) => s.name === setup.sponsor)) continue;
      rows.push({
        sponsorId: null,
        sponsor: setup.sponsor,
        windowStart: setup.windowStart,
        windowEnd: setup.windowEnd,
        durationMinutes: setup.durationMinutes,
        groupSize: setup.groupSize,
        hackers: setup.hackers,
        assignedRoom: null,
        sheetRoom: setup.room,
        watcher: null,
      });
    }
    // Organizer names, suggested for the watcher field (free text).
    const organizers = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.type, "organizer"))
      .orderBy(asc(users.name));
    const watchers = [
      ...new Set(
        organizers
          .map((o) => o.name?.trim() ?? "")
          .filter((name) => name.length > 0),
      ),
    ];
    return { rooms: [...COFFEE_CHAT_ROOMS], sponsors: rows, watchers };
  }),

  /**
   * Assign a sponsor's Saturday coffee chat room (one of 2241-2243), or
   * clear it (null: back to the sheet's ROOM, if any). Refused when another
   * sponsor has that room with an overlapping window. The sponsor's live
   * chats move with it, under the same rules as Move room, and each moved
   * hacker is told. Organizers only.
   */
  assignCoffeeChatRoom: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: sponsorInput,
        room: z.string().trim().min(1).max(64).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const room = input.room === null ? null : coffeeChatRoomOf(input.room);
      if (input.room !== null && !room) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.unknownRoom,
        });
      }
      const names = await db
        .select({ name: sponsorJudgingSponsors.name })
        .from(sponsorJudgingSponsors);
      const setups = await readSheetCoffeeChatSetups(names.map((s) => s.name));

      const result = await db.transaction(async (tx) => {
        // Lock order as everywhere: sponsor row, then rooms.
        const sponsor = await findSponsor(tx, input.sponsorId, true);
        // Live chats follow the sponsor's room (assignment, else sheet).
        const sheetRoom =
          setups.find((c) => c.sponsor === sponsor.name)?.room ?? null;
        const target = resolveCoffeeChatRoom(room, sheetRoom);
        const moving = await activeChats(
          tx,
          eq(coffeeChats.sponsorId, sponsor.id),
          now,
        );
        // Every room involved, locked once in sorted order (no deadlocks).
        await lockRooms(tx, [room, target, ...moving.map((c) => c.room)]);
        const sponsors = await tx
          .select({
            id: sponsorJudgingSponsors.id,
            name: sponsorJudgingSponsors.name,
            assigned: sponsorJudgingSponsors.coffeeChatRoom,
          })
          .from(sponsorJudgingSponsors);
        // Other sponsors count with their effective room (assignment, else
        // the sheet's ROOM).
        const windows = sponsors.map(({ assigned, ...s }) => {
          const setup = setups.find((c) => c.sponsor === s.name);
          return {
            ...s,
            room: resolveCoffeeChatRoom(assigned, setup?.room),
            windowStart: setup?.windowStart ?? null,
            windowEnd: setup?.windowEnd ?? null,
          };
        });
        const clash = room
          ? coffeeChatRoomClash(sponsor.id, room, windows)
          : null;
        // Another sponsor's room hold inside this sponsor's window.
        const mine = windows.find((w) => w.id === sponsor.id);
        if (room && !clash && mine?.windowStart && mine.windowEnd) {
          const start = coffeeChatMinutesOf(mine.windowStart);
          const end = coffeeChatMinutesOf(mine.windowEnd);
          if (start !== null && end !== null && end > start) {
            const window: RoomUse = {
              sponsorId: sponsor.id,
              room,
              slotTime: mine.windowStart,
              durationMinutes: end - start,
            };
            const held = (await loadHolds(tx))
              .map(holdAsRoomUse)
              .find(
                (h) =>
                  h.sponsorId !== sponsor.id &&
                  normalizeRoom(h.room) === normalizeRoom(room) &&
                  coffeeChatsOverlap(h, window),
              );
            if (held) throwRoomUsed(room, held, sponsors);
          }
        }
        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: errors.roomClash(
              room!,
              clash.name,
              formatClock(clash.windowStart!),
              formatClock(clash.windowEnd!),
            ),
          });
        }
        await tx
          .update(sponsorJudgingSponsors)
          .set({ coffeeChatRoom: room })
          .where(eq(sponsorJudgingSponsors.id, sponsor.id));
        const chatIds = await moveChatsToRoom(
          tx,
          sponsor.id,
          moving,
          target,
          now,
        );
        return { sponsorId: sponsor.id, room, chatIds };
      });
      await Promise.all(
        result.chatIds.map((id) => notifyCoffeeChat("roomMoved", { id })),
      );
      return result;
    }),
  /**
   * Hold a coffee chat room for a sponsor at a Saturday time, before any
   * hacker is booked ("Needs a hacker"). Refused when another sponsor has
   * that room then (chat, hold or room window). Organizers only.
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
   * Move a hold to another room or time (same sponsor), with the same
   * rules as creating one. Organizers only.
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
   * Remove a hold. Chats already booked inside it keep their room.
   * Organizers only.
   */
  deleteHold: protectedOrganizerProcedure
    .input(z.object({ holdId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [row] = await db
        .delete(coffeeChatHolds)
        .where(eq(coffeeChatHolds.id, input.holdId))
        .returning({ id: coffeeChatHolds.id });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: errors.holdNotFound,
        });
      }
      return { holdId: row.id };
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

import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import { z } from "zod";

import { coffeeChatCopy } from "~/content/coffee-chat";
import { isAdmittedStatus } from "~/lib/admission";
import {
  ACTIVE_COFFEE_CHAT_STATUSES,
  coffeeChatExpiresAt,
  isActiveCoffeeChat,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  freeStartTimes,
  offerProblem,
  type OfferProblem,
} from "~/server/api/utils/coffee-chat-capacity";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  applications,
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
    })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, id.toLowerCase()));
  const [sponsor] = lock ? await query.for("update") : await query;
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownSponsor });
  }
  return sponsor;
}

/** Every sponsor's Coffee Chats row, with registered names matched. */
export async function readCoffeeChatSetups(): Promise<CoffeeChatSetup[]> {
  const names = await db
    .select({ name: sponsorJudgingSponsors.name })
    .from(sponsorJudgingSponsors);
  try {
    const snapshot = await getRunOfShow();
    return applySponsorNames(
      snapshot,
      names.map((n) => n.name),
    ).coffeeChats;
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
async function findAdmittedHacker(userId: string, now = new Date()) {
  const [row] = await db
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

/** Active chats in a room (any sponsor); none when the room is unknown. */
async function activeRoomChats(conn: Db | Tx, room: string | null, now: Date) {
  if (!room) return [];
  // Rooms are compared normalized in coffee-chat-capacity, so load every
  // active chat that has a room; there are only ever a few dozen.
  return activeChats(conn, isNotNull(coffeeChats.room), now);
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
      const [sponsorChats, hackerChats, roomChats] = await Promise.all([
        activeChats(db, eq(coffeeChats.sponsorId, sponsor.id), now),
        input.userId
          ? activeChats(db, eq(coffeeChats.userId, input.userId), now)
          : Promise.resolve([]),
        activeRoomChats(db, setup?.room ?? null, now),
      ]);
      return {
        room: setup?.room ?? null,
        durationMinutes: setup?.durationMinutes ?? 15,
        groupSize: setup?.groupSize ?? 1,
        reps: sponsor.reps,
        times: freeStartTimes({
          setup,
          reps: sponsor.reps,
          sponsorId: sponsor.id,
          sponsorChats,
          hackerChats,
          roomChats,
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
    .mutation(async ({ input }): Promise<CoffeeChatOffer> => {
      const now = new Date();
      const sponsor = await findSponsor(db, input.sponsor);
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

          const [sponsorChats, hackerChats, roomChats] = await Promise.all([
            activeChats(tx, eq(coffeeChats.sponsorId, sponsor.id), now),
            activeChats(tx, eq(coffeeChats.userId, hacker.userId), now),
            activeRoomChats(tx, setup?.room ?? null, now),
          ]);
          const problem = offerProblem({
            setup,
            slotTime: input.slotTime,
            reps: locked.reps,
            sponsorId: sponsor.id,
            sponsorChats,
            hackerChats,
            roomChats,
            now,
          });
          if (problem) throwProblem(problem);

          const [row] = await tx
            .insert(coffeeChats)
            .values({
              sponsorId: sponsor.id,
              userId: hacker.userId,
              room: setup!.room,
              slotTime: input.slotTime,
              durationMinutes: setup!.durationMinutes,
              repName: input.repName ? input.repName : null,
            })
            .returning();
          return row!;
        });

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
    }),
});

export { activeChats, activeRoomChats, findSponsor };

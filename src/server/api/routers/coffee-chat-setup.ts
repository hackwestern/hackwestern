import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";

import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { isAdmittedStatus } from "~/lib/admission";
import {
  DEFAULT_CHATS_WANTED,
  MAX_SETUP_CHATS,
  MAX_SETUP_REPS,
  MIN_PHONE_DIGITS,
  availableFree,
  phoneDigits,
} from "~/lib/coffee-chat-setup";
import {
  COFFEE_SESSIONS,
  COFFEE_SESSION_IDS,
  MAX_HACKERS_PER_CHAT,
  MIN_HACKERS_PER_CHAT,
  buildingOf,
  chatsBySession,
} from "~/lib/coffee-chat-sessions";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  findSponsor,
  loadSponsorSetup,
  type SponsorSetup,
} from "~/server/api/utils/coffee-chat-setup";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorScans,
  users,
} from "~/server/db/schema";

const errors = sponsorSetupCopy.errors;

const sponsorInput = z.string().uuid();
const repName = z.string().trim().min(1).max(255);
const repPhone = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((p) => phoneDigits(p) >= MIN_PHONE_DIGITS, errors.shortPhone);
const sessionId = z.enum(COFFEE_SESSION_IDS);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One chat in "Your chats": a rep in a room for (part of) a session. */
export type YourChat = {
  placementId: string;
  repId: string;
  sessionId: string;
  room: string;
  building: "near" | "ivey";
  /** Chats this rep runs in this session (the last one may be partial). */
  chats: number;
  /** "HH:MM": session start, and where their chats end inside it. */
  start: string;
  end: string;
  /** Invited hackers so far (track B's invites), first names only. */
  hackers: { firstName: string; status: "pending" | "accepted" }[];
};

const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Hackers holding a live invite (pending or accepted) to this sponsor's sent chats. */
async function invitedHackers(conn: Pick<typeof db, "select">, sponsorId: string) {
  const [row] = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(coffeeChats)
    .innerJoin(coffeeChatPlacements, eq(coffeeChatPlacements.id, coffeeChats.placementId))
    .innerJoin(coffeeChatReps, eq(coffeeChatReps.id, coffeeChatPlacements.repId))
    .where(
      and(
        eq(coffeeChatReps.sponsorId, sponsorId),
        eq(coffeeChatPlacements.status, "sent"),
        inArray(coffeeChats.status, ["pending", "accepted"]),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Inside a write: lock the sponsor row (so two tabs can't both take the
 * crown or pass a cap). Once organizers sent the sponsor's schedule, a
 * change is allowed only with `confirmAfterInvites` (the page shows the
 * "Invites are already out" warning first); otherwise PRECONDITION_FAILED.
 * Every write bumps coffee_chat_pref.updated_at, so updated_at later than
 * the latest placement sent_at means "the sponsor changed something after
 * Send" (track B reconfirms; docs/handoff/build-a-cc-setup.md).
 */
async function lockForWrite(tx: Tx, sponsorId: string, confirmAfterInvites = false) {
  const sponsor = await findSponsor(sponsorId, tx);
  await tx
    .select({ id: sponsorJudgingSponsors.id })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, sponsor.id))
    .for("update");
  const [sent] = await tx
    .select({ id: coffeeChatPlacements.id })
    .from(coffeeChatPlacements)
    .innerJoin(coffeeChatReps, eq(coffeeChatReps.id, coffeeChatPlacements.repId))
    .where(
      and(
        eq(coffeeChatReps.sponsorId, sponsor.id),
        eq(coffeeChatPlacements.status, "sent"),
      ),
    )
    .limit(1);
  if (sent && !confirmAfterInvites) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: errors.afterInvites(await invitedHackers(tx, sponsor.id)),
    });
  }
  const now = new Date();
  await tx
    .insert(coffeeChatPrefs)
    .values({ sponsorId: sponsor.id, updatedAt: now })
    .onConflictDoUpdate({ target: coffeeChatPrefs.sponsorId, set: { updatedAt: now } });
  return sponsor;
}

const confirmInput = { confirmAfterInvites: z.boolean().optional() };

async function repOf(tx: Tx, sponsorId: string, repId: string) {
  const [rep] = await tx
    .select()
    .from(coffeeChatReps)
    .where(and(eq(coffeeChatReps.id, repId), eq(coffeeChatReps.sponsorId, sponsorId)));
  if (!rep) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownRep });
  return rep;
}

/** Sent chats for this sponsor's reps, with invited hackers. */
async function yourChats(setup: SponsorSetup): Promise<YourChat[]> {
  if (!setup.confirmed || setup.reps.length === 0) return [];
  const rows = await db
    .select()
    .from(coffeeChatPlacements)
    .where(
      and(
        inArray(
          coffeeChatPlacements.repId,
          setup.reps.map((r) => r.id),
        ),
        eq(coffeeChatPlacements.status, "sent"),
      ),
    )
    .orderBy(asc(coffeeChatPlacements.sessionId), asc(coffeeChatPlacements.id));
  const hackerRows = rows.length
    ? await db
        .select({
          placementId: coffeeChats.placementId,
          status: coffeeChats.status,
          firstName: applications.firstName,
          accountName: users.name,
        })
        .from(coffeeChats)
        .innerJoin(users, eq(users.id, coffeeChats.userId))
        .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
        .where(
          and(
            inArray(
              coffeeChats.placementId,
              rows.map((r) => r.id),
            ),
            inArray(coffeeChats.status, ["pending", "accepted"]),
          ),
        )
        .orderBy(asc(coffeeChats.createdAt))
    : [];

  return rows.flatMap((p): YourChat[] => {
    const rep = setup.reps.find((r) => r.id === p.repId);
    const session = COFFEE_SESSIONS.find((s) => s.id === p.sessionId);
    const building = buildingOf(p.room);
    if (!rep || !session || !building) return [];
    // A rep's chats fill their sessions in time order; the last may be partial.
    const mine = rows.filter((x) => x.repId === rep.id).map((x) => x.sessionId);
    const chats =
      chatsBySession(mine, rep.chatsWanted, setup.chatsPerSession).get(p.sessionId) ?? 0;
    return [
      {
        placementId: p.id,
        repId: p.repId,
        sessionId: p.sessionId,
        room: p.room,
        building,
        chats,
        start: clock(session.start),
        end: clock(session.start + Math.max(1, chats) * setup.chatMinutes),
        hackers: hackerRows
          .filter((h) => h.placementId === p.id)
          .map((h) => ({
            firstName:
              [h.firstName, h.accountName?.trim().split(/\s+/)[0]]
                .map((n) => n?.trim() ?? "")
                .find((n) => n.length > 0) ?? "",
            status: h.status as "pending" | "accepted",
          })),
      },
    ];
  });
}

/**
 * Sponsor portal coffee chat setup (track A of the 8-hour build): Your
 * team, chatting preferences, "Your chats" after Send, and recording booth
 * scans. Public procedures keyed by the sponsor's private portal UUID, like
 * sponsorPortal. The shortlist lives in sponsorShortlist. Every write is
 * refused once organizers sent the sponsor's schedule (Send on the board):
 * removing a rep would delete their sent chats.
 */
export const coffeeChatSetupRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ sponsor: sponsorInput }))
    .query(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const setup = await loadSponsorSetup(sponsor);
      const [scanned, chats] = await Promise.all([
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(sponsorScans)
          .where(eq(sponsorScans.sponsorId, sponsor.id)),
        yourChats(setup),
      ]);
      const sentTimes = await db
        .select({ at: max(coffeeChatPlacements.sentAt) })
        .from(coffeeChatPlacements)
        .innerJoin(coffeeChatReps, eq(coffeeChatReps.id, coffeeChatPlacements.repId))
        .where(
          and(
            eq(coffeeChatReps.sponsorId, sponsor.id),
            eq(coffeeChatPlacements.status, "sent"),
          ),
        );
      const sentAt = sentTimes[0]?.at ?? null;
      const hackers = chats.flatMap((c) => c.hackers);
      return {
        ...setup,
        scannedCount: scanned[0]?.n ?? 0,
        chats,
        /** Latest Send by organizers that covers this sponsor, or null. */
        sentAt,
        /** The sponsor changed something after organizers sent. */
        editedAfterSend: !!(sentAt && setup.updatedAt && setup.updatedAt > sentAt),
        seats: {
          total: chats.reduce((n, c) => n + c.chats * setup.hackersPerChat, 0),
          accepted: hackers.filter((h) => h.status === "accepted").length,
          invited: hackers.length,
        },
      };
    }),

  /**
   * Add a rep (name + phone, both required; no email). The first rep gets
   * the crown. New reps start with every open session ticked and the
   * default number of chats.
   */
  addRep: publicProcedure
    .input(z.object({ sponsor: sponsorInput, name: repName, phone: repPhone, ...confirmInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const setup = await loadSponsorSetup(sponsor);
      const added = await db.transaction(async (tx) => {
        await lockForWrite(tx, sponsor.id, input.confirmAfterInvites);
        const existing = await tx
          .select({ id: coffeeChatReps.id, isPrimary: coffeeChatReps.isPrimary })
          .from(coffeeChatReps)
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        if (existing.length >= MAX_SETUP_REPS) {
          throw new TRPCError({ code: "BAD_REQUEST", message: errors.tooManyReps(MAX_SETUP_REPS) });
        }
        const [pos] = await tx
          .select({ n: max(coffeeChatReps.position) })
          .from(coffeeChatReps)
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        const [rep] = await tx
          .insert(coffeeChatReps)
          .values({
            sponsorId: sponsor.id,
            name: input.name,
            phone: input.phone,
            isPrimary: !existing.some((r) => r.isPrimary),
            chatsWanted: DEFAULT_CHATS_WANTED,
            position: (pos?.n ?? -1) + 1,
          })
          .returning({ id: coffeeChatReps.id, isPrimary: coffeeChatReps.isPrimary });
        const open = COFFEE_SESSIONS.map((s) => s.id as string).filter(
          (id) => !setup.blocked.includes(id),
        );
        if (open.length) {
          await tx
            .insert(coffeeChatRepSessions)
            .values(open.map((id) => ({ repId: rep!.id, sessionId: id })));
        }
        return { id: rep!.id, isPrimary: rep!.isPrimary };
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return added;
    }),

  updateRep: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        repId: z.string().uuid(),
        name: repName,
        phone: repPhone,
        ...confirmInput,
      }),
    )
    .mutation(async ({ input }) => {
      const result = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(tx, input.sponsor, input.confirmAfterInvites);
        await repOf(tx, sponsor.id, input.repId);
        await tx
          .update(coffeeChatReps)
          .set({ name: input.name, phone: input.phone })
          .where(eq(coffeeChatReps.id, input.repId));
        return { ok: true };
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return result;
    }),

  /** Remove a rep (and their ticks). The crown moves to the first rep left. */
  removeRep: publicProcedure
    .input(z.object({ sponsor: sponsorInput, repId: z.string().uuid(), ...confirmInput }))
    .mutation(async ({ input }) => {
      const result = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(tx, input.sponsor, input.confirmAfterInvites);
        const rep = await repOf(tx, sponsor.id, input.repId);
        await tx.delete(coffeeChatReps).where(eq(coffeeChatReps.id, rep.id));
        if (rep.isPrimary) {
          const [next] = await tx
            .select({ id: coffeeChatReps.id })
            .from(coffeeChatReps)
            .where(eq(coffeeChatReps.sponsorId, sponsor.id))
            .orderBy(asc(coffeeChatReps.position), asc(coffeeChatReps.createdAt), asc(coffeeChatReps.id))
            .limit(1);
          if (next) {
            await tx
              .update(coffeeChatReps)
              .set({ isPrimary: true })
              .where(eq(coffeeChatReps.id, next.id));
          }
          return { primaryId: next?.id ?? null };
        }
        return { primaryId: null };
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return result;
    }),

  /** Move the crown: exactly one primary contact per sponsor. */
  setPrimary: publicProcedure
    .input(z.object({ sponsor: sponsorInput, repId: z.string().uuid(), ...confirmInput }))
    .mutation(async ({ input }) => {
      const result = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(tx, input.sponsor, input.confirmAfterInvites);
        await repOf(tx, sponsor.id, input.repId);
        await tx
          .update(coffeeChatReps)
          .set({ isPrimary: false })
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        await tx
          .update(coffeeChatReps)
          .set({ isPrimary: true })
          .where(eq(coffeeChatReps.id, input.repId));
        return { ok: true };
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return result;
    }),

  /**
   * Save the chatting preferences step: hackers per chat (1-5; 1-on-1s are
   * always 15 min), and for every rep the sessions they're free and how
   * many chats they want (0 = doesn't chat). Sessions blocked by their
   * workshop are dropped. Doesn't change whether they've submitted.
   */
  savePrefs: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        hackersPerChat: z.number().int().min(MIN_HACKERS_PER_CHAT).max(MAX_HACKERS_PER_CHAT),
        reps: z
          .array(
            z.object({
              id: z.string().uuid(),
              chatsWanted: z.number().int().min(0).max(MAX_SETUP_CHATS),
              free: z.array(sessionId).max(COFFEE_SESSIONS.length),
            }),
          )
          .max(MAX_SETUP_REPS),
        ...confirmInput,
      }),
    )
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const setup = await loadSponsorSetup(sponsor);
      const result = await db.transaction(async (tx) => {
        await lockForWrite(tx, sponsor.id, input.confirmAfterInvites);
        const reps = await tx
          .select({ id: coffeeChatReps.id })
          .from(coffeeChatReps)
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        const mine = new Set(reps.map((r) => r.id));
        if (input.reps.some((r) => !mine.has(r.id))) {
          throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownRep });
        }
        await tx
          .insert(coffeeChatPrefs)
          .values({
            sponsorId: sponsor.id,
            hackersPerChat: input.hackersPerChat,
            longerOneOnOne: false,
          })
          .onConflictDoUpdate({
            target: coffeeChatPrefs.sponsorId,
            set: {
              hackersPerChat: input.hackersPerChat,
              longerOneOnOne: false,
              updatedAt: new Date(),
            },
          });
        for (const r of input.reps) {
          await tx
            .update(coffeeChatReps)
            .set({ chatsWanted: r.chatsWanted })
            .where(eq(coffeeChatReps.id, r.id));
          await tx.delete(coffeeChatRepSessions).where(eq(coffeeChatRepSessions.repId, r.id));
          const free = [...new Set(availableFree(r.free, setup.blocked))];
          if (free.length) {
            await tx
              .insert(coffeeChatRepSessions)
              .values(free.map((s) => ({ repId: r.id, sessionId: s })));
          }
        }
        return { ok: true };
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return result;
    }),

  /**
   * Review & submit: needs a rep, a primary contact, and at least one rep
   * with a chat at a time they're free. Sets coffee_chat_pref.submitted_at
   * (re-submitting after changes moves it forward).
   */
  submitPrefs: publicProcedure
    .input(z.object({ sponsor: sponsorInput, ...confirmInput }))
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const setup = await loadSponsorSetup(sponsor);
      if (setup.reps.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: errors.noReps });
      }
      if (!setup.reps.some((r) => r.isPrimary)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: errors.noPrimary });
      }
      if (setup.totals.chats === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: errors.noChats });
      }
      const now = new Date();
      await db.transaction(async (tx) => {
        await lockForWrite(tx, sponsor.id, input.confirmAfterInvites);
        await tx
          .insert(coffeeChatPrefs)
          .values({ sponsorId: sponsor.id, submittedAt: now })
          .onConflictDoUpdate({
            target: coffeeChatPrefs.sponsorId,
            set: { submittedAt: now, updatedAt: now },
          });
      });
      // after merge with build-e-sheet: void mirrorCoffeeChatSetup();
      return { submittedAt: now };
    }),

  /**
   * A sponsor scanned a hacker at their booth ("Met at Hacker Fair"):
   * record it so they're invited first. Scanning twice keeps the first
   * time; picking a rep later updates who wants to talk to them.
   */
  recordScan: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        userId: z.string().trim().min(1).max(255),
        repName: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const [hacker] = await db
        .select({ type: users.type, status: applications.status })
        .from(users)
        .innerJoin(applications, eq(applications.userId, users.id))
        .where(eq(users.id, input.userId));
      if (!hacker || hacker.type !== "hacker" || !isAdmittedStatus(hacker.status)) {
        throw new TRPCError({ code: "NOT_FOUND", message: errors.notAHacker });
      }
      const rep = input.repName ? input.repName : null;
      const insert = db
        .insert(sponsorScans)
        .values({ sponsorId: sponsor.id, userId: input.userId, repName: rep });
      await (rep
        ? insert.onConflictDoUpdate({
            target: [sponsorScans.sponsorId, sponsorScans.userId],
            set: { repName: rep },
          })
        : insert.onConflictDoNothing());
      return { ok: true };
    }),
});

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
  invitesOutOfLine,
  phoneDigits,
  setupWindows,
} from "~/lib/coffee-chat-setup";
import { effectiveCoffeeChatStatus } from "~/lib/coffee-chat-requests";
import {
  COFFEE_SESSIONS,
  COFFEE_SESSION_IDS,
  MAX_HACKERS_PER_CHAT,
  MIN_HACKERS_PER_CHAT,
  buildingOf,
  chatMinutes,
  chatsBySession,
} from "~/lib/coffee-chat-sessions";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  deliverInviteNotices,
  reconcileInvitesAfterChange,
  type InviteJob,
} from "~/server/api/utils/coffee-chat-invites";
import { mirrorCoffeeInvitesLater } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import {
  assertWithinTier,
  findSponsor,
  loadSponsorSetup,
  type SponsorSetup,
} from "~/server/api/utils/coffee-chat-setup";
import { BOARD_LOCK_KEY } from "~/server/api/utils/coffee-chat-sessions-board";
import { mirrorCoffeeChatSetupLater } from "~/server/api/utils/coffee-chat-setup-sheet-mirror";
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
  /**
   * "HH:MM": when their first chat starts and their last one ends, inside
   * the session's usable window (a session cut by their workshop starts
   * late or ends early). Same times as the hackers' invites.
   */
  start: string;
  end: string;
  /** Invited hackers so far (track B's invites), first names only. */
  hackers: { firstName: string; status: "pending" | "accepted" }[];
};

const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Inside a write: lock the sponsor row (so two tabs can't both take the
 * crown or pass a cap). Once organizers sent the sponsor's schedule, a
 * change is allowed only with `confirmAfterInvites` (the page shows the
 * "Invites are already out" warning first); otherwise PRECONDITION_FAILED.
 * Every rep or preference edit bumps coffee_chat_pref.updated_at (submits
 * pass bump: false), so updated_at later than
 * the latest placement sent_at means "the sponsor changed something after
 * Send" (docs/handoff/build-a-cc-setup.md). `sent` says whether invites may
 * exist, so the caller reconciles them (reconcileIfSent).
 */
async function lockForWrite(
  tx: Tx,
  sponsorId: string,
  confirmAfterInvites = false,
  { bump = true } = {},
) {
  const sponsor = await findSponsor(sponsorId, tx);
  // Board lock first, then the sponsor row: the same order as every
  // organizer board write (boardWrite), so a sponsor save and an
  // organizer fix can't deadlock. Reconcile re-takes it (re-entrant).
  await tx.execute(
    sql`select pg_advisory_xact_lock(${sql.raw(BOARD_LOCK_KEY)})`,
  );
  await tx
    .select({ id: sponsorJudgingSponsors.id })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, sponsor.id))
    .for("update");
  const [sent] = await tx
    .select({ id: coffeeChatPlacements.id })
    .from(coffeeChatPlacements)
    .innerJoin(
      coffeeChatReps,
      eq(coffeeChatReps.id, coffeeChatPlacements.repId),
    )
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
      message: errors.afterInvites,
    });
  }
  if (bump) {
    const now = new Date();
    await tx
      .insert(coffeeChatPrefs)
      .values({ sponsorId: sponsor.id, updatedAt: now })
      .onConflictDoUpdate({
        target: coffeeChatPrefs.sponsorId,
        set: { updatedAt: now },
      });
  }
  return { ...sponsor, sent: !!sent };
}

/**
 * Once invites may be out, bring them in line with the change just made,
 * in the same transaction (docs/ship/decisions-log.md, Integration 3):
 * invites to a chat that moved or shrank are re-asked or cancelled. For a
 * delete, call it BEFORE the delete with the placements going away (the
 * delete cascades their invites). Deliver the jobs after the commit.
 */
async function reconcileIfSent(
  tx: Tx,
  sponsor: { id: string; sent: boolean },
  removingPlacementIds?: string[],
): Promise<InviteJob[]> {
  if (!sponsor.sent) return [];
  const result = await reconcileInvitesAfterChange(tx, sponsor.id, {
    removingPlacementIds,
  });
  if (result.status === "workshopsUnknown") {
    // Invites can't be checked without workshop times, and a removed rep
    // would drop theirs silently: refuse (the whole change rolls back).
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: errors.scheduleUnknown,
    });
  }
  return result.jobs;
}

/** After the commit: tell hackers about re-asked or cancelled invites; the Invites tab follows. */
async function deliver(jobs: InviteJob[]): Promise<void> {
  if (!jobs.length) return;
  await deliverInviteNotices(jobs);
  mirrorCoffeeInvitesLater();
}

const confirmInput = { confirmAfterInvites: z.boolean().optional() };

async function repOf(tx: Tx, sponsorId: string, repId: string) {
  const [rep] = await tx
    .select()
    .from(coffeeChatReps)
    .where(
      and(
        eq(coffeeChatReps.id, repId),
        eq(coffeeChatReps.sponsorId, sponsorId),
      ),
    );
  if (!rep)
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownRep });
  return rep;
}

/** Sent chats for this sponsor's reps, with invited hackers. */
async function yourChats(setup: SponsorSetup): Promise<YourChat[]> {
  if (!setup.confirmed || setup.reps.length === 0) return [];
  // Usable part of each session: the same rule as the board and the invites.
  const windows = setupWindows(setup.workshops, setup.chatMinutes);
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
          slotTime: coffeeChats.slotTime,
          expiresAt: coffeeChats.expiresAt,
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
    // A rep's chats fill their sessions in time order, each up to the whole
    // chats its usable window holds; the last may hold fewer.
    const mine = rows.filter((x) => x.repId === rep.id).map((x) => x.sessionId);
    const chats =
      chatsBySession(mine, rep.chatsWanted, (id) => windows.chats[id] ?? 0).get(
        p.sessionId,
      ) ?? 0;
    const start = (windows.partial[p.sessionId] ?? session).start;
    return [
      {
        placementId: p.id,
        repId: p.repId,
        sessionId: p.sessionId,
        room: p.room,
        building,
        chats,
        start: clock(start),
        end: clock(start + Math.max(1, chats) * setup.chatMinutes),
        // Waiting and accepted only: an invite past its answer-by (not yet
        // written back as expired) is replaced, not shown.
        hackers: hackerRows
          .filter(
            (h) =>
              h.placementId === p.id &&
              effectiveCoffeeChatStatus(h, new Date()) !== "expired",
          )
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
 * sponsorPortal. The shortlist lives in sponsorShortlist. Once organizers
 * sent the sponsor's schedule, a team or preferences write needs
 * `confirmAfterInvites` (the "Invites are already out" warning), and
 * removeRep, savePrefs and a rename in updateRep reconcile the hackers'
 * invites in the same transaction.
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
        .innerJoin(
          coffeeChatReps,
          eq(coffeeChatReps.id, coffeeChatPlacements.repId),
        )
        .where(
          and(
            eq(coffeeChatReps.sponsorId, sponsor.id),
            eq(coffeeChatPlacements.status, "sent"),
          ),
        );
      const sentAt = sentTimes[0]?.at ?? null;
      const hackers = chats.flatMap((c) => c.hackers);
      // Invites in sent chats the sponsor's current setup changes: the
      // dialog's rule (invitesAffected), from what the sent chats imply.
      const changedInvites = invitesOutOfLine(chats, setup.workshops, {
        hackersPerChat: setup.hackersPerChat,
        reps: setup.reps,
      });
      return {
        ...setup,
        scannedCount: scanned[0]?.n ?? 0,
        chats,
        /** Latest Send by organizers that covers this sponsor, or null. */
        sentAt,
        /** The sponsor changed something after organizers sent. */
        editedAfterSend: !!(
          sentAt &&
          setup.updatedAt &&
          setup.updatedAt > sentAt
        ),
        seats: {
          total: chats.reduce((n, c) => n + c.chats * setup.hackersPerChat, 0),
          accepted: hackers.filter((h) => h.status === "accepted").length,
          invited: hackers.length,
          /** Live invites in sent chats that no longer fit the setup. */
          changed: changedInvites,
        },
      };
    }),

  /**
   * Add a rep (name + phone, both required; no email). The first rep gets
   * the crown. New reps start with every open session ticked and the
   * default number of chats.
   */
  addRep: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        name: repName,
        phone: repPhone,
        ...confirmInput,
      }),
    )
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const setup = await loadSponsorSetup(sponsor);
      const added = await db.transaction(async (tx) => {
        await lockForWrite(tx, sponsor.id, input.confirmAfterInvites);
        const existing = await tx
          .select({
            id: coffeeChatReps.id,
            isPrimary: coffeeChatReps.isPrimary,
          })
          .from(coffeeChatReps)
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        if (existing.length >= MAX_SETUP_REPS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errors.tooManyReps(MAX_SETUP_REPS),
          });
        }
        // A new rep starts with the default chats, or none when that would
        // go past the tier's chatting hours (they can still be listed).
        const used =
          setup.reps.reduce((n, r) => n + r.chatsWanted, 0) * setup.chatMinutes;
        const startingChats =
          setup.maxChatMinutes !== null &&
          used + DEFAULT_CHATS_WANTED * setup.chatMinutes > setup.maxChatMinutes
            ? 0
            : DEFAULT_CHATS_WANTED;
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
            chatsWanted: startingChats,
            position: (pos?.n ?? -1) + 1,
          })
          .returning({
            id: coffeeChatReps.id,
            isPrimary: coffeeChatReps.isPrimary,
          });
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
      mirrorCoffeeChatSetupLater();
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
      const { jobs, ...result } = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(
          tx,
          input.sponsor,
          input.confirmAfterInvites,
        );
        const rep = await repOf(tx, sponsor.id, input.repId);
        await tx
          .update(coffeeChatReps)
          .set({ name: input.name, phone: input.phone })
          .where(eq(coffeeChatReps.id, input.repId));
        // Invites carry the rep's name: a rename re-asks their hackers.
        const jobs =
          rep.name !== input.name ? await reconcileIfSent(tx, sponsor) : [];
        return { ok: true, jobs };
      });
      await deliver(jobs);
      mirrorCoffeeChatSetupLater();
      return result;
    }),

  /**
   * Remove a rep (and their ticks and chats). The crown moves to the first
   * rep left. After Send, their hackers' invites are moved to another open
   * seat or cancelled first, and those hackers are told.
   */
  removeRep: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        repId: z.string().uuid(),
        ...confirmInput,
      }),
    )
    .mutation(async ({ input }) => {
      const { jobs, ...result } = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(
          tx,
          input.sponsor,
          input.confirmAfterInvites,
        );
        const rep = await repOf(tx, sponsor.id, input.repId);
        const placements = await tx
          .select({ id: coffeeChatPlacements.id })
          .from(coffeeChatPlacements)
          .where(eq(coffeeChatPlacements.repId, rep.id));
        // Before the delete: it cascades the placements and their invites.
        const jobs = await reconcileIfSent(
          tx,
          sponsor,
          placements.map((p) => p.id),
        );
        await tx.delete(coffeeChatReps).where(eq(coffeeChatReps.id, rep.id));
        if (rep.isPrimary) {
          const [next] = await tx
            .select({ id: coffeeChatReps.id })
            .from(coffeeChatReps)
            .where(eq(coffeeChatReps.sponsorId, sponsor.id))
            .orderBy(
              asc(coffeeChatReps.position),
              asc(coffeeChatReps.createdAt),
              asc(coffeeChatReps.id),
            )
            .limit(1);
          if (next) {
            await tx
              .update(coffeeChatReps)
              .set({ isPrimary: true })
              .where(eq(coffeeChatReps.id, next.id));
          }
          return { primaryId: next?.id ?? null, jobs };
        }
        return { primaryId: null, jobs };
      });
      await deliver(jobs);
      mirrorCoffeeChatSetupLater();
      return result;
    }),

  /** Move the crown: exactly one primary contact per sponsor. */
  setPrimary: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        repId: z.string().uuid(),
        ...confirmInput,
      }),
    )
    .mutation(async ({ input }) => {
      const result = await db.transaction(async (tx) => {
        const sponsor = await lockForWrite(
          tx,
          input.sponsor,
          input.confirmAfterInvites,
        );
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
      mirrorCoffeeChatSetupLater();
      return result;
    }),

  /**
   * Save the chatting preferences step: hackers per chat (1-5; 1-on-1s are
   * always 15 min), and for every rep the sessions they're free and how
   * many chats they want (0 = doesn't chat). Sessions their workshop
   * blocks (no whole chat left) are dropped; sessions it only cuts stay. Doesn't change whether they've submitted. After
   * Send, invites are reconciled with fewer chats or a new chat length.
   */
  savePrefs: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        hackersPerChat: z
          .number()
          .int()
          .min(MIN_HACKERS_PER_CHAT)
          .max(MAX_HACKERS_PER_CHAT),
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
      // Every rep's chats (the ones sent, else what's saved) can't add up to
      // more than the tier's chatting hours.
      const sentChats = new Map(input.reps.map((r) => [r.id, r.chatsWanted]));
      assertWithinTier(
        setup.reps.map((r) => sentChats.get(r.id) ?? r.chatsWanted),
        chatMinutes({ hackersPerChat: input.hackersPerChat }),
        setup.maxChatMinutes,
      );
      const { jobs, ...result } = await db.transaction(async (tx) => {
        const locked = await lockForWrite(
          tx,
          sponsor.id,
          input.confirmAfterInvites,
        );
        const reps = await tx
          .select({ id: coffeeChatReps.id })
          .from(coffeeChatReps)
          .where(eq(coffeeChatReps.sponsorId, sponsor.id));
        // A rep removed in another tab is skipped, not an error: the page
        // refetches and drops it.
        const mine = new Set(reps.map((r) => r.id));
        const known = input.reps.filter((r) => mine.has(r.id));
        const skipped = input.reps.length - known.length;
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
        // Blocked for the chat length being saved: a session the buffer
        // only cuts stays (its usable part), one with no whole chat left goes.
        const { blocked } = setupWindows(
          setup.workshops,
          chatMinutes({ hackersPerChat: input.hackersPerChat }),
        );
        for (const r of known) {
          await tx
            .update(coffeeChatReps)
            .set({ chatsWanted: r.chatsWanted })
            .where(eq(coffeeChatReps.id, r.id));
          await tx
            .delete(coffeeChatRepSessions)
            .where(eq(coffeeChatRepSessions.repId, r.id));
          const free = [...new Set(availableFree(r.free, blocked))];
          if (free.length) {
            await tx
              .insert(coffeeChatRepSessions)
              .values(free.map((s) => ({ repId: r.id, sessionId: s })));
          }
        }
        return { ok: true, skipped, jobs: await reconcileIfSent(tx, locked) };
      });
      await deliver(jobs);
      mirrorCoffeeChatSetupLater();
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
      const now = new Date();
      await db.transaction(async (tx) => {
        // A submit isn't an edit: updated_at stays (organizer board's
        // "Changed after invites" flag).
        await lockForWrite(tx, sponsor.id, input.confirmAfterInvites, {
          bump: false,
        });
        // Checked under the lock, so a rep edit in another tab can't slip in.
        const setup = await loadSponsorSetup(sponsor, tx);
        if (setup.reps.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: errors.noReps });
        }
        if (!setup.reps.some((r) => r.isPrimary)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errors.noPrimary,
          });
        }
        if (setup.totals.chats === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: errors.noChats });
        }
        await tx
          .insert(coffeeChatPrefs)
          .values({ sponsorId: sponsor.id, submittedAt: now })
          .onConflictDoUpdate({
            target: coffeeChatPrefs.sponsorId,
            set: { submittedAt: now },
          });
      });
      mirrorCoffeeChatSetupLater();
      return { submittedAt: now };
    }),

  /** Is this hacker already on the sponsor's "Met at your booth" list? */
  scanOf: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        userId: z.string().trim().min(1).max(255),
      }),
    )
    .query(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const [row] = await db
        .select({
          scannedAt: sponsorScans.scannedAt,
          repName: sponsorScans.repName,
        })
        .from(sponsorScans)
        .where(
          and(
            eq(sponsorScans.sponsorId, sponsor.id),
            eq(sponsorScans.userId, input.userId),
          ),
        );
      return row ?? null;
    }),

  /**
   * A sponsor scanned a hacker at their booth ("Met at your booth"):
   * record it so they're invited first. Scanning twice keeps the first
   * time; picking a rep later updates who wants to talk to them. The rep
   * is chosen by id from Your team; the name is looked up here.
   */
  recordScan: publicProcedure
    .input(
      z.object({
        sponsor: sponsorInput,
        userId: z.string().trim().min(1).max(255),
        /** A rep from Your team, or null/absent for "Anyone". */
        repId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sponsor = await findSponsor(input.sponsor);
      const [hacker] = await db
        .select({ type: users.type, status: applications.status })
        .from(users)
        .innerJoin(applications, eq(applications.userId, users.id))
        .where(eq(users.id, input.userId));
      if (
        !hacker ||
        hacker.type !== "hacker" ||
        !isAdmittedStatus(hacker.status)
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: errors.notAHacker });
      }
      let rep: string | null = null;
      if (input.repId) {
        const [row] = await db
          .select({ name: coffeeChatReps.name })
          .from(coffeeChatReps)
          .where(
            and(
              eq(coffeeChatReps.id, input.repId),
              eq(coffeeChatReps.sponsorId, sponsor.id),
            ),
          );
        if (!row)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownRep,
          });
        rep = row.name;
      }
      const insert = db
        .insert(sponsorScans)
        .values({ sponsorId: sponsor.id, userId: input.userId, repName: rep });
      // The card pre-selects the rep already credited, so whatever is sent
      // (including "Anyone") is the sponsor's current choice.
      await insert.onConflictDoUpdate({
        target: [sponsorScans.sponsorId, sponsorScans.userId],
        set: { repName: rep },
      });
      return { ok: true };
    }),
});

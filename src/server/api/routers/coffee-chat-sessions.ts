import { TRPCError } from "@trpc/server";
import { sessionCap } from "~/lib/coffee-chat-schedule";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  applySuggestion,
  autoApplyFixes,
  boardFixes,
  cellKey,
  parseKey,
  schedule,
} from "~/lib/coffee-chat-schedule";
import {
  COFFEE_ROOMS,
  COFFEE_ROOM_IDS,
  COFFEE_SESSIONS,
  COFFEE_SESSION_IDS,
} from "~/lib/coffee-chat-sessions";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { mirrorRoomGrid } from "~/server/api/utils/coffee-chat-room-grid-mirror";
import { mirrorCoffeeInvitesLater } from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import { syncAllCoffeeChatReminders } from "~/server/api/utils/coffee-chat-reminder";
import {
  deliverInviteNotices,
  invitesDeliveryLive,
  invitesEnabled,
  layoutOf,
  reconcileInvitesAfterChange,
  sendRoundOneInvites,
  type InviteJob,
  type InviteTx,
} from "~/server/api/utils/coffee-chat-invites";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";
import { bookEvent, bookingHackers } from "~/server/api/utils/coffee-chat-book";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import {
  assertCellFree,
  assertRepCanChat,
  assertWorkshopsKnown,
  boardWrite,
  loadBoardState,
  pinsOf,
  sessionBoardOf,
  type BoardState,
  type SessionBoard,
} from "~/server/api/utils/coffee-chat-sessions-board";
import {
  coffeeChatPlacements,
  coffeeChatReps,
  coffeeChatRoomBookings,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

const errors = coffeeSessionsCopy.errors;

/**
 * Re-mirror the Room Grid tab after a change to something already sent
 * (after the write commits). Only when sheet writes are on.
 */
async function remirrorIf(changedSent: boolean): Promise<void> {
  if (!changedSent || !sheetWritesEnabled()) return;
  await mirrorRoomGrid(await loadBoardState());
}

const anySent = (state: { placements: { status: string }[] }) =>
  state.placements.some((p) => p.status === "sent");

/** This sponsor has a sent chat, so hackers may hold invites to it. */
const sponsorSent = (state: BoardState, sponsorId: string) =>
  state.placements.some(
    (p) => p.sponsorId === sponsorId && p.status === "sent",
  );

/**
 * After a change to a sent sponsor's chats, in the same transaction:
 * invites follow the chat (re-asked) or are cancelled. For a delete, call
 * it BEFORE the delete with the placements going away (the delete cascades
 * their invites). Deliver the jobs after the commit.
 */
async function reconcileSent(
  tx: InviteTx,
  state: BoardState,
  sponsorId: string,
  removingPlacementIds?: string[],
): Promise<InviteJob[]> {
  if (!sponsorSent(state, sponsorId)) return [];
  // Without workshop times invites can't be checked, and a delete would drop them silently.
  assertWorkshopsKnown(state);
  return (
    await reconcileInvitesAfterChange(tx, sponsorId, { removingPlacementIds })
  ).jobs;
}

/** After the commit: hackers hear about the change, and the Room Grid and Invites tabs follow. */
async function afterSentChange(r: {
  jobs: InviteJob[];
  sent: boolean;
}): Promise<void> {
  if (r.jobs.length) await deliverInviteNotices(r.jobs);
  if (r.sent) mirrorCoffeeInvitesLater();
  await remirrorIf(r.sent);
}

/**
 * How many chats these placements hold (a cell is one rep for one hour: 2
 * group chats or 4 1-on-1s, fewer in a partial session or past the rep's
 * wanted chats), as the invites count them.
 */
function chatCount(
  state: BoardState,
  placements: BoardState["placements"],
): number {
  return layoutOf({ ...state, placements }, () => true).length;
}

/**
 * Once hackers were notified (Notify hackers marked the chat sent), the
 * chat is locked: nobody can move or remove it from the board, and
 * Auto-schedule and fixes never touch it (Jazz, 2026-11-20).
 */
function assertNotSent(p: { status: string }): void {
  if (p.status === "sent") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: errors.sentLocked,
    });
  }
}

const room = z.enum(COFFEE_ROOM_IDS);
const sessionId = z.enum(COFFEE_SESSION_IDS);

/**
 * The organizer coffee chat board, session model (docs/specs/coffee-chat-
 * sessions.md; UI: Coffee chats tab of /internal/sponsors). Organizers only.
 * Auto-schedule writes drafts nobody else sees; Send marks them sent and
 * mirrors the Room Grid tab (when sheet writes are on). Every write goes
 * through boardWrite(): one board lock, then checks on a fresh read.
 */
export const coffeeChatSessionsRouter = createTRPCRouter({
  getBoard: protectedOrganizerProcedure.query(
    async (): Promise<SessionBoard> => sessionBoardOf(await loadBoardState()),
  ),

  /**
   * Run the scheduler, then apply every suggested fix it safely can
   * (autoApplyFixes): keeps sent and booked cells, and pinned chats unless
   * a fix moves them; replaces the other drafts. Sent chats never change.
   * What's left needs the organizer ("fewer chats", or a sent chat that
   * breaks a rule now).
   */
  autoSchedule: protectedOrganizerProcedure.mutation(async () => {
    return boardWrite(async (tx, state) => {
      assertWorkshopsKnown(state);
      const result = schedule(
        state.sched,
        COFFEE_ROOMS,
        COFFEE_SESSIONS,
        pinsOf(state),
      );
      const keyOf = (p: { room: string; sessionId: string }) =>
        cellKey(p.room, p.sessionId);
      const locked = new Set(
        state.placements.filter((p) => p.status === "sent").map(keyOf),
      );
      const fixed = autoApplyFixes(
        state.sched,
        COFFEE_ROOMS,
        COFFEE_SESSIONS,
        result.board,
        locked,
      );
      // Sent chats always stay; a pinned draft stays unless a fix moved or removed it.
      const kept = new Set(
        state.placements
          .filter((p) => {
            if (p.status === "sent") return true;
            const cell = fixed.board[keyOf(p)];
            return p.pinned && cell?.type === "chat" && cell.rep === p.repId;
          })
          .map((p) => p.id),
      );
      const keptKeys = new Set(
        state.placements.filter((p) => kept.has(p.id)).map(keyOf),
      );
      const drop = state.placements
        .filter((p) => !kept.has(p.id))
        .map((p) => p.id);
      if (drop.length) {
        await tx
          .delete(coffeeChatPlacements)
          .where(inArray(coffeeChatPlacements.id, drop));
      }
      // Everything else on the board is new: a draft the scheduler owns (re-run replaces it).
      const fresh = Object.entries(fixed.board).flatMap(([key, cell]) => {
        if (cell.type !== "chat" || keptKeys.has(key)) return [];
        const at = parseKey(key);
        return [{ repId: cell.rep, room: at.room, sessionId: at.session }];
      });
      if (fresh.length) await tx.insert(coffeeChatPlacements).values(fresh);
      for (const [repId, maxSessions] of Object.entries(fixed.maxSessions)) {
        await tx
          .update(coffeeChatReps)
          .set({ maxSessions })
          .where(eq(coffeeChatReps.id, repId));
      }
      // "Placed N chats." counts the chats this run added (after minus before).
      const sponsorOfRep = new Map(
        state.sponsors.flatMap((sp) => sp.reps.map((r) => [r.id, sp.id])),
      );
      const after = [
        ...state.placements.filter((p) => kept.has(p.id)),
        ...fresh.map((f, i) => ({
          id: `new-${i}`,
          repId: f.repId,
          sponsorId: sponsorOfRep.get(f.repId) ?? "",
          sessionId: f.sessionId,
          room: f.room,
          pinned: false,
          forced: false,
          status: "draft" as const,
          sentAt: null,
          window: null,
        })),
      ];
      const chats = Math.max(
        0,
        chatCount(state, after) - chatCount(state, state.placements),
      );
      return {
        placed: fresh.length,
        chats,
        fixed: fixed.applied.length,
        fixes: fixed.left.length,
      };
    });
  }),

  /**
   * Apply a suggested fix by id (recomputed from the board now). A fix
   * that would move, remove or replace a sent chat is refused: sent chats
   * are locked (assertNotSent).
   */
  applyFix: protectedOrganizerProcedure
    .input(z.object({ fixId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const { kind, ...after } = await boardWrite(async (tx, state) => {
        assertWorkshopsKnown(state);
        const fix = boardFixes(
          state.sched,
          COFFEE_ROOMS,
          COFFEE_SESSIONS,
          state.board,
        ).find((f) => f.id === input.fixId);
        if (!fix)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownFix,
          });
        const sug = fix.suggestion;
        try {
          applySuggestion(state.sched, COFFEE_SESSIONS, state.board, {}, sug);
        } catch {
          throw new TRPCError({ code: "CONFLICT", message: errors.unknownFix });
        }
        // Only a fix that moves or removes chats can touch invites.
        const untouched = {
          kind: sug.kind,
          jobs: [] as InviteJob[],
          sent: false,
        };
        const changed = (jobs: InviteJob[], sent: boolean) => ({
          kind: sug.kind,
          jobs,
          sent,
        });
        if (sug.kind === "fewer") {
          for (const c of sug.caps) {
            await tx
              .update(coffeeChatReps)
              .set({ maxSessions: c.sessions })
              .where(eq(coffeeChatReps.id, c.rep));
          }
          return untouched;
        }
        if (sug.kind === "extra") {
          // A partial session left the rep short: one more session, and a cap that fits it.
          await tx.insert(coffeeChatPlacements).values({
            repId: sug.place.rep,
            room: sug.place.room,
            sessionId: sug.place.session,
            pinned: true,
          });
          await tx
            .update(coffeeChatReps)
            .set({ maxSessions: sug.cap.sessions })
            .where(eq(coffeeChatReps.id, sug.cap.rep));
          return untouched;
        }
        if (sug.kind === "move") {
          // A chat that breaks a rule now: move it (pinned, same status) or remove it.
          const from = parseKey(sug.from);
          const p = state.placements.find(
            (x) => x.room === from.room && x.sessionId === from.session,
          );
          if (!p)
            throw new TRPCError({
              code: "CONFLICT",
              message: errors.unknownFix,
            });
          assertNotSent(p);
          if (sug.to) {
            await tx
              .update(coffeeChatPlacements)
              .set({
                room: sug.to.room,
                sessionId: sug.to.session,
                pinned: true,
                forced: false,
              })
              .where(eq(coffeeChatPlacements.id, p.id));
            return changed(
              await reconcileSent(tx, state, fix.sponsor),
              p.status === "sent",
            );
          }
          // Before the delete: it cascades the invites.
          const jobs = await reconcileSent(tx, state, fix.sponsor, [p.id]);
          await tx
            .delete(coffeeChatPlacements)
            .where(eq(coffeeChatPlacements.id, p.id));
          return changed(jobs, p.status === "sent");
        }
        if (sug.kind === "ivey") {
          // Only unpinned chats move to Ivey, and a sent chat counts as
          // pinned on the board, so these are drafts: no invites to follow.
          const moving = sug.remove.flatMap((key) => {
            const { room: r, session } = parseKey(key);
            return state.placements.filter(
              (p) => p.room === r && p.sessionId === session,
            );
          });
          moving.forEach(assertNotSent);
          const ids = moving.map((p) => p.id);
          if (ids.length) {
            await tx
              .delete(coffeeChatPlacements)
              .where(inArray(coffeeChatPlacements.id, ids));
          }
        }
        await tx.insert(coffeeChatPlacements).values(
          sug.places.map((p) => ({
            repId: p.rep,
            room: p.room,
            sessionId: p.session,
            pinned: true,
          })),
        );
        return untouched;
      });
      await afterSentChange(after);
      return { kind };
    }),

  /**
   * Move a draft chat by hand. Pins it. A sent chat is locked and can't be
   * moved (assertNotSent). `force` (after the
   * organizer contacted the rep): a session the rep didn't tick is allowed
   * and the chat is marked forced; never their workshop window or two places
   * at once. A move to a ticked session clears the mark.
   */
  movePlacement: protectedOrganizerProcedure
    .input(
      z.object({
        placementId: z.string().uuid(),
        room,
        sessionId,
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const after = await boardWrite(async (tx, state) => {
        const p = state.placements.find((x) => x.id === input.placementId);
        if (!p)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownPlacement,
          });
        assertNotSent(p);
        const forced = assertRepCanChat(state, p.repId, input.sessionId, p.id, {
          allowNotFree: input.force,
        });
        assertCellFree(state, input.room, input.sessionId, {
          placementId: p.id,
        });
        await tx
          .update(coffeeChatPlacements)
          .set({
            room: input.room,
            sessionId: input.sessionId,
            pinned: true,
            forced,
          })
          .where(eq(coffeeChatPlacements.id, p.id));
        return {
          jobs: await reconcileSent(tx, state, p.sponsorId),
          sent: p.status === "sent",
        };
      });
      await afterSentChange(after);
      return { ok: true };
    }),

  /**
   * Remove a draft chat. It shows up as a suggested fix until it's placed
   * again. A sent chat is locked and can't be removed (assertNotSent).
   */
  removePlacement: protectedOrganizerProcedure
    .input(z.object({ placementId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const after = await boardWrite(async (tx, state) => {
        const p = state.placements.find((x) => x.id === input.placementId);
        if (p) assertNotSent(p);
        // Before the delete: it cascades the invites.
        const jobs = p
          ? await reconcileSent(tx, state, p.sponsorId, [p.id])
          : [];
        const gone = await tx
          .delete(coffeeChatPlacements)
          .where(eq(coffeeChatPlacements.id, input.placementId))
          .returning({ status: coffeeChatPlacements.status });
        if (!gone.length)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownPlacement,
          });
        return { jobs, sent: gone[0]!.status === "sent" };
      });
      await afterSentChange(after);
      return { ok: true };
    }),

  /**
   * Put a draft chat back by hand: the "Undo" after removing one. Pinned,
   * like a move. Same checks as a move (rep free, cell empty).
   */
  placeChat: protectedOrganizerProcedure
    .input(
      z.object({
        repId: z.string().uuid(),
        room,
        sessionId,
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      // Undo after Remove. It always places a NEW draft chat: invites of a
      // removed sent chat were cancelled by reconcile and aren't restored
      // (the board only offers Undo for draft chats). A draft needs no
      // reconcile; it reaches hackers on the next Send.
      return boardWrite(async (tx, state) => {
        // Undo of a forced chat puts it back forced (same rules as a forced move).
        const forced = assertRepCanChat(
          state,
          input.repId,
          input.sessionId,
          undefined,
          {
            allowNotFree: input.force,
          },
        );
        assertCellFree(state, input.room, input.sessionId);
        // Adding a chat, unlike a move, can push a rep past their cap.
        const rep = state.sched
          .flatMap((sp) => sp.reps)
          .find((r) => r.id === input.repId);
        const has = state.placements.filter(
          (p) => p.repId === input.repId,
        ).length;
        if (rep && has >= sessionCap(rep)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errors.repAtCap(has),
          });
        }
        const [row] = await tx
          .insert(coffeeChatPlacements)
          .values({
            repId: input.repId,
            room: input.room,
            sessionId: input.sessionId,
            pinned: true,
            forced,
          })
          .returning({ id: coffeeChatPlacements.id });
        return { id: row!.id };
      });
    }),

  /**
   * Book an event, step 3: the hackers this sponsor scanned (newest first),
   * and with `q` the hackers whose name or hacker ID matches. Admitted
   * hackers who share with sponsors only.
   */
  bookingHackers: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        q: z.string().max(100).default(""),
      }),
    )
    .query(({ input }) => bookingHackers(db, input.sponsorId, input.q)),

  /**
   * Book an event on an empty cell: a rep of a sponsor and a hacker. Makes
   * a sent (locked) placement and the hacker's accepted chat at the first
   * time in that hour they can take (coffee-chat-book.ts). After the
   * commit: the confirmed-chat notice path (bookings tab), the Invites tab
   * and the Room Grid tab follow.
   */
  bookEvent: protectedOrganizerProcedure
    .input(
      z.object({
        room,
        sessionId,
        sponsorId: z.string().uuid(),
        repId: z.string().uuid(),
        userId: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ input }) => {
      const out = await boardWrite((tx, state) => bookEvent(tx, state, input));
      await notifyCoffeeChat("accepted", { id: out.chatId });
      mirrorCoffeeInvitesLater();
      await remirrorIf(true);
      return out;
    }),

  /**
   * Make every accepted chat's 15-minute Slack reminder match the chat
   * (backfill for chats accepted before reminders shipped; the Saturday
   * invite-round workflow runs the same sweep). Idempotent: never a second
   * reminder. Stops after 45 s; run again until `left` is 0.
   */
  syncReminders: protectedOrganizerProcedure.mutation(() =>
    syncAllCoffeeChatReminders({ budgetMs: 45_000 }),
  ),

  /**
   * An organizer room booking (who it's for) on an empty cell. The board
   * books events now (bookEvent); this stays for Undo after removing an
   * older booking.
   */
  bookRoom: protectedOrganizerProcedure
    .input(
      z.object({
        room,
        sessionId,
        forSponsorId: z.string().uuid().nullable().default(null),
        label: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return boardWrite(async (tx, state) => {
        assertWorkshopsKnown(state);
        assertCellFree(state, input.room, input.sessionId);
        if (input.forSponsorId) {
          const [sponsor] = await tx
            .select({ id: sponsorJudgingSponsors.id })
            .from(sponsorJudgingSponsors)
            .where(eq(sponsorJudgingSponsors.id, input.forSponsorId));
          if (!sponsor)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: errors.unknownSponsor,
            });
        }
        const [row] = await tx
          .insert(coffeeChatRoomBookings)
          .values({
            room: input.room,
            sessionId: input.sessionId,
            forSponsorId: input.forSponsorId,
            label: input.label,
            createdBy: ctx.session.user.id,
          })
          .returning({ id: coffeeChatRoomBookings.id });
        return { id: row!.id };
      });
    }),

  /** Once the schedule was sent, booking changes re-mirror the Room Grid tab. */
  moveBooking: protectedOrganizerProcedure
    .input(z.object({ bookingId: z.string().uuid(), room, sessionId }))
    .mutation(async ({ input }) => {
      const sent = await boardWrite(async (tx, state) => {
        assertWorkshopsKnown(state);
        if (!state.bookings.some((b) => b.id === input.bookingId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownBooking,
          });
        }
        assertCellFree(state, input.room, input.sessionId, {
          bookingId: input.bookingId,
        });
        await tx
          .update(coffeeChatRoomBookings)
          .set({ room: input.room, sessionId: input.sessionId })
          .where(eq(coffeeChatRoomBookings.id, input.bookingId));
        return anySent(state);
      });
      await remirrorIf(sent);
      return { ok: true };
    }),

  removeBooking: protectedOrganizerProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const sent = await boardWrite(async (tx, state) => {
        const gone = await tx
          .delete(coffeeChatRoomBookings)
          .where(eq(coffeeChatRoomBookings.id, input.bookingId))
          .returning({ id: coffeeChatRoomBookings.id });
        if (!gone.length)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errors.unknownBooking,
          });
        return anySent(state);
      });
      await remirrorIf(sent);
      return { ok: true };
    }),

  /**
   * Send ("Notify hackers"; any organizer, can't be undone): every draft
   * chat becomes sent and locked, changed sponsors are re-confirmed, then
   * hackers are invited. A chat placed later stays a draft until the next
   * Send, which notifies only the new ones.
   */
  send: protectedOrganizerProcedure.mutation(async () => {
    const now = new Date();
    // One transaction: mark every draft chat sent, then invite hackers to
    // their seats (scanned → shortlist → interested). Both take the same
    // board lock, so a page-load round can't run in between. Messages go
    // out after the commit (deliverInviteNotices never throws).
    const { sent, chats, reconfirmed, round } = await boardWrite(
      async (tx, state) => {
        assertWorkshopsKnown(state);
        // "Sent N chats." counts chats, not cells.
        const chats = chatCount(
          state,
          state.placements.filter((p) => p.status === "draft"),
        );
        // Stamp after the lock and the state read, so a sponsor save that
        // committed while Send waited is older than this sentAt (else their
        // "Changed after invites" flag would never clear).
        const stamp = new Date();
        const sent = await tx
          .update(coffeeChatPlacements)
          .set({ status: "sent", sentAt: stamp })
          .where(eq(coffeeChatPlacements.status, "draft"))
          .returning({ id: coffeeChatPlacements.id });
        // Sponsors who changed after invites: their invites were already
        // updated when they saved, so Send re-confirms their sent chats (new
        // sent time), which clears "Changed after invites".
        const changed = state.sponsors.filter((s) => s.changedAfterSend);
        const repIds = changed.flatMap((s) => s.reps.map((r) => r.id));
        const sentIds = new Set(sent.map((r) => r.id));
        const touched = repIds.length
          ? await tx
              .update(coffeeChatPlacements)
              .set({ sentAt: stamp })
              .where(
                and(
                  eq(coffeeChatPlacements.status, "sent"),
                  inArray(coffeeChatPlacements.repId, repIds),
                ),
              )
              .returning({
                id: coffeeChatPlacements.id,
                repId: coffeeChatPlacements.repId,
              })
          : [];
        // Count sponsors whose already-sent chats this Send re-stamped (not
        // ones whose drafts alone cleared the flag).
        const repSponsor = new Map(
          changed.flatMap((s) => s.reps.map((r) => [r.id, s.id] as const)),
        );
        const reconfirmed = new Set(
          touched
            .filter((t) => !sentIds.has(t.id))
            .map((t) => repSponsor.get(t.repId)),
        ).size;
        const round = await sendRoundOneInvites(tx, { now: stamp });
        return { sent, chats, reconfirmed, round };
      },
    );
    const delivery = await deliverInviteNotices(round.jobs);
    mirrorCoffeeInvitesLater();
    const mirror = await mirrorRoomGrid(await loadBoardState(), { now });
    return {
      sent: sent.length,
      /** Chats in the placements this Send marked sent. */
      chats,
      /** Sponsors who changed after invites, re-confirmed by this Send. */
      reconfirmed,
      sheet: mirror.ok
        ? ("written" as const)
        : mirror.error === "disabled"
          ? ("disabled" as const)
          : ("failed" as const),
      invites: {
        status: round.status,
        created: round.status === "ok" ? round.created.length : 0,
        /** Seats no eligible hacker could fill (the board flags them). */
        unfilledSeats:
          round.status === "ok"
            ? round.unfilled.reduce((n, u) => n + u.open, 0)
            : 0,
        // Messages actually handed to Slack or email (0 while invites are off).
        delivered: delivery.slack + delivery.email,
        /**
         * COFFEE_INVITES_ENABLED=dry: invites were saved but nobody was
         * messaged. The toast says so.
         */
        dryRun: invitesEnabled() && !invitesDeliveryLive(),
      },
    };
  }),
});

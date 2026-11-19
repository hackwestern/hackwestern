import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  applySuggestion,
  boardFixes,
  parseKey,
  schedule,
} from "~/lib/coffee-chat-schedule";
import {
  COFFEE_ROOMS,
  COFFEE_ROOM_IDS,
  COFFEE_SESSIONS,
  COFFEE_SESSION_IDS,
} from "~/lib/coffee-chat-sessions";
import { createTRPCRouter, protectedOrganizerProcedure } from "~/server/api/trpc";
import { mirrorRoomGrid } from "~/server/api/utils/coffee-chat-room-grid-mirror";
import { checkCoffeeSender, type SenderCheck } from "~/server/api/utils/coffee-chat-sender";
import {
  deliverInviteNotices,
  reconcileInvitesAfterChange,
  sendRoundOneInvites,
  type InviteJob,
  type InviteTx,
} from "~/server/api/utils/coffee-chat-invites";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";
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
  state.placements.some((p) => p.sponsorId === sponsorId && p.status === "sent");

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
  return (await reconcileInvitesAfterChange(tx, sponsorId, { removingPlacementIds })).jobs;
}

/** After the commit: hackers hear about the change, and the Room Grid tab follows. */
async function afterSentChange(r: { jobs: InviteJob[]; sent: boolean }): Promise<void> {
  if (r.jobs.length) await deliverInviteNotices(r.jobs);
  await remirrorIf(r.sent);
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
  /** The board, plus whether this organizer may press Send (Noah only). */
  getBoard: protectedOrganizerProcedure.query(
    async ({ ctx }): Promise<SessionBoard & { sender: SenderCheck }> => {
      const [state, sender] = await Promise.all([
        loadBoardState(),
        checkCoffeeSender(ctx.session.user.email),
      ]);
      return { ...sessionBoardOf(state), sender };
    },
  ),

  /** Run the scheduler: keeps pinned, sent and booked cells; replaces drafts. */
  autoSchedule: protectedOrganizerProcedure.mutation(async () => {
    return boardWrite(async (tx, state) => {
      assertWorkshopsKnown(state);
      const result = schedule(state.sched, COFFEE_ROOMS, COFFEE_SESSIONS, pinsOf(state));
      const kept = new Set(
        state.placements.filter((p) => p.pinned || p.status === "sent").map((p) => p.id),
      );
      const drop = state.placements.filter((p) => !kept.has(p.id)).map((p) => p.id);
      if (drop.length) {
        await tx.delete(coffeeChatPlacements).where(inArray(coffeeChatPlacements.id, drop));
      }
      const fresh = Object.entries(result.board).flatMap(([key, cell]) => {
        if (cell.type !== "chat" || cell.pinned) return [];
        const at = parseKey(key);
        return [{ repId: cell.rep, room: at.room, sessionId: at.session }];
      });
      if (fresh.length) await tx.insert(coffeeChatPlacements).values(fresh);
      return { placed: fresh.length, fixes: result.fixes.length };
    });
  }),

  /**
   * Apply a suggested fix by id (recomputed from the board now). A moved
   * chat keeps its status: a sent chat stays sent and its invited hackers
   * are asked to reconfirm (docs/ship/decisions-log.md, Integration 1).
   */
  applyFix: protectedOrganizerProcedure
    .input(z.object({ fixId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const { kind, ...after } = await boardWrite(async (tx, state) => {
        assertWorkshopsKnown(state);
        const fix = boardFixes(state.sched, COFFEE_ROOMS, COFFEE_SESSIONS, state.board).find(
          (f) => f.id === input.fixId,
        );
        if (!fix) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownFix });
        const sug = fix.suggestion;
        try {
          applySuggestion(state.sched, COFFEE_SESSIONS, state.board, {}, sug);
        } catch {
          throw new TRPCError({ code: "CONFLICT", message: errors.unknownFix });
        }
        // Only a fix that moves or removes chats can touch invites.
        const untouched = { kind: sug.kind, jobs: [] as InviteJob[], sent: false };
        const changed = (jobs: InviteJob[], sent: boolean) => ({ kind: sug.kind, jobs, sent });
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
          const p = state.placements.find((x) => x.room === from.room && x.sessionId === from.session);
          if (!p) throw new TRPCError({ code: "CONFLICT", message: errors.unknownFix });
          if (sug.to) {
            await tx
              .update(coffeeChatPlacements)
              .set({ room: sug.to.room, sessionId: sug.to.session, pinned: true })
              .where(eq(coffeeChatPlacements.id, p.id));
            return changed(await reconcileSent(tx, state, fix.sponsor), p.status === "sent");
          }
          // Before the delete: it cascades the invites.
          const jobs = await reconcileSent(tx, state, fix.sponsor, [p.id]);
          await tx.delete(coffeeChatPlacements).where(eq(coffeeChatPlacements.id, p.id));
          return changed(jobs, p.status === "sent");
        }
        if (sug.kind === "ivey") {
          // Only unpinned chats move to Ivey, and a sent chat counts as
          // pinned on the board, so these are drafts: no invites to follow.
          const ids = sug.remove.flatMap((key) => {
            const { room: r, session } = parseKey(key);
            return state.placements
              .filter((p) => p.room === r && p.sessionId === session)
              .map((p) => p.id);
          });
          if (ids.length) {
            await tx.delete(coffeeChatPlacements).where(inArray(coffeeChatPlacements.id, ids));
          }
        }
        await tx.insert(coffeeChatPlacements).values(
          sug.places.map((p) => ({ repId: p.rep, room: p.room, sessionId: p.session, pinned: true })),
        );
        return untouched;
      });
      await afterSentChange(after);
      return { kind };
    }),

  /**
   * Move a chat by hand. Pins it and keeps its status: a sent chat stays
   * sent, and its invited hackers are asked to reconfirm the new room or
   * time (docs/ship/decisions-log.md, Integration 1).
   */
  movePlacement: protectedOrganizerProcedure
    .input(z.object({ placementId: z.string().uuid(), room, sessionId }))
    .mutation(async ({ input }) => {
      const after = await boardWrite(async (tx, state) => {
        const p = state.placements.find((x) => x.id === input.placementId);
        if (!p) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownPlacement });
        assertRepCanChat(state, p.repId, input.sessionId, p.id);
        assertCellFree(state, input.room, input.sessionId, { placementId: p.id });
        await tx
          .update(coffeeChatPlacements)
          .set({ room: input.room, sessionId: input.sessionId, pinned: true })
          .where(eq(coffeeChatPlacements.id, p.id));
        return { jobs: await reconcileSent(tx, state, p.sponsorId), sent: p.status === "sent" };
      });
      await afterSentChange(after);
      return { ok: true };
    }),

  /**
   * Remove a chat. It shows up as a suggested fix until it's placed again.
   * A sent chat's hackers move to another open seat of the sponsor or have
   * their invite cancelled (and are told); the Room Grid tab is re-mirrored.
   */
  removePlacement: protectedOrganizerProcedure
    .input(z.object({ placementId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const after = await boardWrite(async (tx, state) => {
        const p = state.placements.find((x) => x.id === input.placementId);
        // Before the delete: it cascades the invites.
        const jobs = p ? await reconcileSent(tx, state, p.sponsorId, [p.id]) : [];
        const gone = await tx
          .delete(coffeeChatPlacements)
          .where(eq(coffeeChatPlacements.id, input.placementId))
          .returning({ status: coffeeChatPlacements.status });
        if (!gone.length) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownPlacement });
        return { jobs, sent: gone[0]!.status === "sent" };
      });
      await afterSentChange(after);
      return { ok: true };
    }),

  /** Ad hoc room booking on an empty cell (a sponsor, mentors, organizers). */
  bookRoom: protectedOrganizerProcedure
    .input(
      z.object({
        room,
        sessionId,
        forSponsorId: z.string().uuid().nullable().default(null),
        label: z.string().trim().min(1).max(255),
        note: z.string().trim().max(255).nullable().default(null),
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
          if (!sponsor) throw new TRPCError({ code: "BAD_REQUEST", message: errors.unknownSponsor });
        }
        const [row] = await tx
          .insert(coffeeChatRoomBookings)
          .values({
            room: input.room,
            sessionId: input.sessionId,
            forSponsorId: input.forSponsorId,
            label: input.label,
            note: input.note === "" ? null : input.note,
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
          throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownBooking });
        }
        assertCellFree(state, input.room, input.sessionId, { bookingId: input.bookingId });
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
        if (!gone.length) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownBooking });
        return anySent(state);
      });
      await remirrorIf(sent);
      return { ok: true };
    }),

  /**
   * Send: only Noah Medland (matched by login email on HW Contacts, read
   * fresh). Every draft chat becomes sent (sentAt now), sponsors who changed
   * after invites get their sent chats re-confirmed (sentAt now), then the Room Grid
   * tab is mirrored (only when sheetWritesEnabled(); locally nothing is
   * written). If HW Contacts can't be read, nobody can send.
   */
  send: protectedOrganizerProcedure.mutation(async ({ ctx }) => {
    const sender = await checkCoffeeSender(ctx.session.user.email, { fresh: true });
    if (!sender.canSend) {
      throw new TRPCError({
        code: sender.reason === "notSender" ? "FORBIDDEN" : "PRECONDITION_FAILED",
        message: errors.sender[sender.reason],
      });
    }
    const now = new Date();
    // One transaction: mark every draft chat sent, then invite hackers to
    // their seats (scanned → shortlist → interested). Both take the same
    // board lock, so a page-load round can't run in between. Messages go
    // out after the commit (deliverInviteNotices never throws).
    const { sent, reconfirmed, round } = await boardWrite(async (tx, state) => {
      assertWorkshopsKnown(state);
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
              and(eq(coffeeChatPlacements.status, "sent"), inArray(coffeeChatPlacements.repId, repIds)),
            )
            .returning({ id: coffeeChatPlacements.id, repId: coffeeChatPlacements.repId })
        : [];
      // Count sponsors whose already-sent chats this Send re-stamped (not
      // ones whose drafts alone cleared the flag).
      const repSponsor = new Map(changed.flatMap((s) => s.reps.map((r) => [r.id, s.id] as const)));
      const reconfirmed = new Set(
        touched.filter((t) => !sentIds.has(t.id)).map((t) => repSponsor.get(t.repId)),
      ).size;
      const round = await sendRoundOneInvites(tx, { now: stamp });
      return { sent, reconfirmed, round };
    });
    const delivery = await deliverInviteNotices(round.jobs);
    const mirror = await mirrorRoomGrid(await loadBoardState(), { now });
    return {
      sent: sent.length,
      /** Sponsors who changed after invites, re-confirmed by this Send. */
      reconfirmed,
      sheet: mirror.ok ? ("written" as const) : mirror.error === "disabled" ? ("disabled" as const) : ("failed" as const),
      invites: {
        status: round.status,
        created: round.status === "ok" ? round.created.length : 0,
        openSeats:
          round.status === "ok" ? round.unfilled.reduce((n, u) => n + u.open, 0) : 0,
        // Messages actually handed to Slack or email (0 while invites are off).
        delivered: delivery.slack + delivery.email,
      },
    };
  }),
});

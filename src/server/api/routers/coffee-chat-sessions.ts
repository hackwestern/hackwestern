import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  applySuggestion,
  findFixes,
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
import {
  assertCellFree,
  assertRepCanChat,
  assertWorkshopsKnown,
  loadBoardState,
  pinsOf,
  sessionBoardOf,
  type SessionBoard,
} from "~/server/api/utils/coffee-chat-sessions-board";
import { db } from "~/server/db";
import {
  coffeeChatPlacements,
  coffeeChatReps,
  coffeeChatRoomBookings,
} from "~/server/db/schema";

const errors = coffeeSessionsCopy.errors;

const room = z.enum(COFFEE_ROOM_IDS);
const sessionId = z.enum(COFFEE_SESSION_IDS);

/**
 * The organizer coffee chat board, session model (docs/specs/coffee-chat-
 * sessions.md; UI: Coffee chats tab of /internal/sponsors). Organizers only.
 * Auto-schedule writes drafts nobody else sees; Send marks them sent and
 * mirrors the Room Grid tab (when sheet writes are on).
 */
export const coffeeChatSessionsRouter = createTRPCRouter({
  getBoard: protectedOrganizerProcedure.query(
    async (): Promise<SessionBoard> => sessionBoardOf(await loadBoardState()),
  ),

  /** Run the scheduler: keeps pinned, sent and booked cells; replaces drafts. */
  autoSchedule: protectedOrganizerProcedure.mutation(async () => {
    return db.transaction(async (tx) => {
      const state = await loadBoardState(tx);
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

  /** Apply a suggested fix by id (recomputed from the board now). */
  applyFix: protectedOrganizerProcedure
    .input(z.object({ fixId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const state = await loadBoardState(tx);
        assertWorkshopsKnown(state);
        const fix = findFixes(state.sched, COFFEE_ROOMS, COFFEE_SESSIONS, state.board).find(
          (f) => f.id === input.fixId,
        );
        if (!fix) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownFix });
        const sug = fix.suggestion;
        try {
          applySuggestion(state.sched, COFFEE_SESSIONS, state.board, {}, sug);
        } catch {
          throw new TRPCError({ code: "CONFLICT", message: errors.unknownFix });
        }
        if (sug.kind === "fewer") {
          for (const c of sug.caps) {
            await tx
              .update(coffeeChatReps)
              .set({ maxSessions: c.sessions })
              .where(eq(coffeeChatReps.id, c.rep));
          }
          return { kind: sug.kind };
        }
        if (sug.kind === "ivey") {
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
        return { kind: sug.kind };
      });
    }),

  /** Move a chat by hand. Pins it, and a sent chat goes back to draft. */
  movePlacement: protectedOrganizerProcedure
    .input(z.object({ placementId: z.string().uuid(), room, sessionId }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const state = await loadBoardState(tx);
        const p = state.placements.find((x) => x.id === input.placementId);
        if (!p) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownPlacement });
        assertRepCanChat(state, p.repId, input.sessionId, p.id);
        assertCellFree(state, input.room, input.sessionId, { placementId: p.id });
        await tx
          .update(coffeeChatPlacements)
          .set({ room: input.room, sessionId: input.sessionId, pinned: true, status: "draft", sentAt: null })
          .where(eq(coffeeChatPlacements.id, p.id));
        return { ok: true };
      });
    }),

  /** Remove a chat. It shows up as a suggested fix until it's placed again. */
  removePlacement: protectedOrganizerProcedure
    .input(z.object({ placementId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const gone = await db
        .delete(coffeeChatPlacements)
        .where(eq(coffeeChatPlacements.id, input.placementId))
        .returning({ id: coffeeChatPlacements.id });
      if (!gone.length) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownPlacement });
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
      return db.transaction(async (tx) => {
        const state = await loadBoardState(tx);
        assertWorkshopsKnown(state);
        assertCellFree(state, input.room, input.sessionId);
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

  moveBooking: protectedOrganizerProcedure
    .input(z.object({ bookingId: z.string().uuid(), room, sessionId }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const state = await loadBoardState(tx);
        assertWorkshopsKnown(state);
        if (!state.bookings.some((b) => b.id === input.bookingId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownBooking });
        }
        assertCellFree(state, input.room, input.sessionId, { bookingId: input.bookingId });
        await tx
          .update(coffeeChatRoomBookings)
          .set({ room: input.room, sessionId: input.sessionId })
          .where(eq(coffeeChatRoomBookings.id, input.bookingId));
        return { ok: true };
      });
    }),

  removeBooking: protectedOrganizerProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const gone = await db
        .delete(coffeeChatRoomBookings)
        .where(eq(coffeeChatRoomBookings.id, input.bookingId))
        .returning({ id: coffeeChatRoomBookings.id });
      if (!gone.length) throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownBooking });
      return { ok: true };
    }),

  /**
   * Send: every draft chat becomes sent (sentAt now), then the Room Grid tab
   * is mirrored (only when sheetWritesEnabled(); locally nothing is written).
   */
  send: protectedOrganizerProcedure.mutation(async () => {
    assertWorkshopsKnown(await loadBoardState());
    const now = new Date();
    const sent = await db
      .update(coffeeChatPlacements)
      .set({ status: "sent", sentAt: now })
      .where(and(eq(coffeeChatPlacements.status, "draft")))
      .returning({ id: coffeeChatPlacements.id });
    // TODO(coffee chat invites): send each sponsor's primary contact their
    // confirmed schedule and invite hackers for each sent chat (scanned →
    // shortlist → interested; 20-min expiry, 35 for Ivey). Not built yet:
    // the old invite flow (coffee-chat-requests) is per 15-min slot and
    // needs porting to sessions. See docs/decisions.md 2026-11-19.
    const mirror = await mirrorRoomGrid(await loadBoardState(), { now });
    return {
      sent: sent.length,
      sheet: mirror.ok ? ("written" as const) : mirror.error === "disabled" ? ("disabled" as const) : ("failed" as const),
      invites: "not-built" as const,
    };
  }),
});

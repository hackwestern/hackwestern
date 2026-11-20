import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import {
  chatKey,
  currentRound,
  nextRoundAt,
  roundClosesAt,
  seatStillOfferable,
} from "~/lib/coffee-chat-invites";
import {
  coffeeChatTimeOf,
  effectiveCoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import { minutesOfClock } from "~/lib/coffee-chat-sessions";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import {
  mirrorCoffeeInvitesLater,
  shortName,
} from "~/server/api/utils/coffee-chat-invites-sheet-mirror";
import {
  checkHacker,
  hackerCheckError,
  putFirstInLine,
  replaceInvite,
  sponsorLineView,
} from "~/server/api/utils/coffee-chat-line";
import { db } from "~/server/db";
import {
  deliverInviteNotices,
  invitesEnabled,
  layoutOf,
  runAndDeliver,
  kickDueInviteRounds,
  runInviteRound,
  sessionInviteRows,
} from "~/server/api/utils/coffee-chat-invites";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";
import { coffeeChats } from "~/server/db/schema";

export type InviteSeat = {
  chatId: string;
  /** First name and last initial ("Ada L."), as on the Invites sheet tab. */
  name: string;
  /** Only live invites are listed: declined and expired ones are replaced. */
  status: "pending" | "accepted";
  round: number | null;
  source: string | null;
  /** ISO answer-by time. */
  expiresAt: string | null;
};

export type InviteChatStatus = {
  placementId: string;
  repName: string;
  room: string;
  /** "HH:MM" Saturday. */
  slotTime: string;
  minutes: number;
  seats: number;
  /** Seats held now (pending or accepted). */
  filled: number;
  accepted: number;
  /**
   * Seats no eligible hacker could fill. Seats are re-offered at once, so
   * this is a problem to show, not a normal count. Always 0 while invites
   * are off (kill switch, previews) or the run of show is unreadable (no
   * round runs then), and for a chat too close to offer any more.
   */
  unfilled: number;
  /** The live invites (waiting or accepted), oldest first. */
  invites: InviteSeat[];
};

export type InviteSponsorStatus = {
  sponsorId: string;
  name: string;
  chats: InviteChatStatus[];
  totals: {
    seats: number;
    accepted: number;
    pending: number;
    unfilled: number;
  };
};

export type InviteStatus = {
  /** False while the kill switch is off: nothing is sent. */
  enabled: boolean;
  round: number;
  /** ISO time the current round's answers close. */
  roundClosesAt: string;
  /** ISO time the next automatic round opens, or null. */
  nextRoundAt: string | null;
  sponsors: InviteSponsorStatus[];
};

// Hacker invites from the confirmed coffee chat schedule (track B of the
// 8-hour build): one invite per seat, round 1 Fri 10 PM, then automatic
// 30-minute rounds on Saturday from 10 AM. A declined seat is re-offered at
// once. Organizers only. The server code and its
// contract: src/server/api/utils/coffee-chat-invites.ts and
// docs/handoff/build-b-cc-invites.md.
export const coffeeChatInvitesRouter = createTRPCRouter({
  /**
   * Invite status per sponsor and chat (sent placements only). Also starts
   * a due Saturday round and the delivery sweep, without waiting for them
   * (throttled; no-op when nothing is due).
   */
  status: protectedOrganizerProcedure
    .input(z.object({ sponsorId: z.string().uuid().optional() }).optional())
    .query(async ({ input }): Promise<InviteStatus> => {
      kickDueInviteRounds();
      const now = new Date();
      const [state, rows] = await Promise.all([
        loadBoardState(),
        sessionInviteRows(),
      ]);
      // Only a seat a round could still fill but didn't is a problem.
      const flagUnfilled = invitesEnabled() && state.workshopsAvailable;
      const layout = layoutOf(
        state,
        (p) =>
          p.status === "sent" &&
          (!input?.sponsorId || p.sponsorId === input.sponsorId),
      );
      const byChat = new Map<string, InviteSeat[]>();
      for (const r of rows) {
        const key = chatKey({
          placementId: r.placementId!,
          start: minutesOfClock(r.slotTime) ?? 0,
        });
        const name = shortName(r.firstName, r.lastName, r.userName);
        const status = effectiveCoffeeChatStatus(r, now);
        // Declined and expired invites aren't shown: their seat was offered
        // to the next hacker.
        if (status !== "pending" && status !== "accepted") continue;
        byChat.set(key, [
          ...(byChat.get(key) ?? []),
          {
            chatId: r.id,
            name,
            status,
            round: r.round,
            source: r.source,
            expiresAt: r.expiresAt?.toISOString() ?? null,
          },
        ]);
      }
      const sponsors: InviteSponsorStatus[] = [];
      for (const s of state.sponsors) {
        const chats = layout
          .filter((c) => c.sponsorId === s.id)
          .map((c): InviteChatStatus => {
            const invites = byChat.get(chatKey(c)) ?? [];
            const filled = invites.filter(
              (i) => i.status === "pending" || i.status === "accepted",
            ).length;
            const accepted = invites.filter(
              (i) => i.status === "accepted",
            ).length;
            const slotTime = coffeeChatTimeOf(c.start);
            const flag =
              flagUnfilled && seatStillOfferable(c.start, c.building, now);
            return {
              placementId: c.placementId,
              repName: c.repName,
              room: c.room,
              slotTime,
              minutes: c.minutes,
              seats: c.seats,
              filled,
              accepted,
              unfilled: flag ? Math.max(0, c.seats - filled) : 0,
              invites,
            };
          });
        if (chats.length === 0) continue;
        const sum = (f: (c: InviteChatStatus) => number) =>
          chats.reduce((n, c) => n + f(c), 0);
        sponsors.push({
          sponsorId: s.id,
          name: s.name,
          chats,
          totals: {
            seats: sum((c) => c.seats),
            accepted: sum((c) => c.accepted),
            pending: sum((c) => c.filled - c.accepted),
            unfilled: sum((c) => c.unfilled),
          },
        });
      }
      const round = currentRound(now);
      return {
        enabled: invitesEnabled(),
        round,
        roundClosesAt: roundClosesAt(round).toISOString(),
        nextRoundAt: nextRoundAt(now)?.toISOString() ?? null,
        sponsors,
      };
    }),

  /**
   * Run the current round now for every sponsor with sent placements (or
   * one sponsor): the safety net if no traffic triggered the timed round.
   * Fills only empty seats.
   */
  runRoundNow: protectedOrganizerProcedure
    .input(z.object({ sponsorId: z.string().uuid().optional() }).optional())
    .mutation(async ({ input }) => {
      const out = await runAndDeliver((tx) =>
        runInviteRound(
          tx,
          input?.sponsorId ? { sponsorIds: [input.sponsorId] } : {},
        ),
      );
      if (out.status === "workshopsUnknown") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: coffeeChatInvitesCopy.errors.workshopsUnknown,
        });
      }
      return {
        status: out.status,
        round: out.round,
        created: out.status === "ok" ? out.created.length : 0,
        delivery: out.delivery,
      };
    }),

  /**
   * A sponsor's line (coffee board v12): the next few hackers who'd get a
   * free seat, and with `chatId` (a live invite) who'd get that seat.
   */
  line: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        chatId: z.string().uuid().optional(),
      }),
    )
    .query(({ input }) =>
      sponsorLineView(input.sponsorId, { chatId: input.chatId }),
    ),

  /**
   * Check a scanned or typed hacker ID for this sponsor, before an organizer
   * gives them a seat or puts them first in line. With `chatId`, also free
   * at that invite's time. Returns their name, or why not.
   */
  checkHacker: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        code: z.string().trim().min(1).max(255),
        chatId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input }) => {
      const [row] = input.chatId
        ? await db
            .select({
              sponsorId: coffeeChats.sponsorId,
              slotTime: coffeeChats.slotTime,
              minutes: coffeeChats.durationMinutes,
            })
            .from(coffeeChats)
            .where(eq(coffeeChats.id, input.chatId))
        : [];
      const check = await checkHacker(db, input.sponsorId, input.code, {
        seat: row
          ? {
              sponsorId: row.sponsorId,
              start: minutesOfClock(row.slotTime) ?? 0,
              minutes: row.minutes,
            }
          : undefined,
      });
      return check.kind === "ok"
        ? { ok: true as const, name: check.name }
        : { ok: false as const, error: hackerCheckError(check, input.code)! };
    }),

  /**
   * Remove a hacker from a sent chat: they're told it's cancelled and never
   * offered this sponsor again. Their seat goes to the next person in line
   * who can take it, or to a hacker picked by ID ("Added by organizer").
   */
  replace: protectedOrganizerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        pick: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("next") }),
          z.object({
            kind: z.literal("code"),
            code: z.string().trim().min(1).max(255),
          }),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const out = await db.transaction((tx) =>
        replaceInvite(tx, { ...input, by: ctx.session.user.id }),
      );
      await deliverInviteNotices(out.jobs);
      mirrorCoffeeInvitesLater();
      return { removed: out.removed, invited: out.invited };
    }),

  /** Put a hacker first in a sponsor's line (newest pick first). */
  putFirst: protectedOrganizerProcedure
    .input(
      z.object({
        sponsorId: z.string().uuid(),
        code: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const out = await db.transaction((tx) =>
        putFirstInLine(tx, { ...input, by: ctx.session.user.id }),
      );
      if (out.jobs.length) {
        await deliverInviteNotices(out.jobs);
        mirrorCoffeeInvitesLater();
      }
      return { name: out.name };
    }),
});

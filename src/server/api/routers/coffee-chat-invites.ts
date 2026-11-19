import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import {
  chatKey,
  currentRound,
  nextRoundAt,
  roundClosesAt,
} from "~/lib/coffee-chat-invites";
import {
  coffeeChatTimeOf,
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import { minutesOfClock } from "~/lib/coffee-chat-sessions";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import {
  invitesEnabled,
  layoutOf,
  runAndDeliver,
  kickDueInviteRounds,
  runInviteRound,
  sessionInviteRows,
} from "~/server/api/utils/coffee-chat-invites";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";

export type InviteSeat = {
  chatId: string;
  name: string;
  status: CoffeeChatStatus;
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
  open: number;
  /** Every invite this chat has had, newest round last. */
  invites: InviteSeat[];
};

export type InviteSponsorStatus = {
  sponsorId: string;
  name: string;
  chats: InviteChatStatus[];
  totals: { seats: number; accepted: number; pending: number; open: number };
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
// 30-minute rounds on Saturday. Organizers only. The server code and its
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
        const name =
          [r.firstName, r.lastName].filter((x) => x?.trim()).join(" ") ||
          (r.userName ?? "");
        byChat.set(key, [
          ...(byChat.get(key) ?? []),
          {
            chatId: r.id,
            name,
            status: effectiveCoffeeChatStatus(r, now),
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
            return {
              placementId: c.placementId,
              repName: c.repName,
              room: c.room,
              slotTime: coffeeChatTimeOf(c.start),
              minutes: c.minutes,
              seats: c.seats,
              filled,
              accepted,
              open: Math.max(0, c.seats - filled),
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
            open: sum((c) => c.open),
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
   * Fills only seats not offered this round yet.
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
});

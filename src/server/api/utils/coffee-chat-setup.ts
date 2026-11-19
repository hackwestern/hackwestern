/**
 * One sponsor's coffee chat setup, read from the session-model tables
 * (coffee_chat_pref, coffee_chat_rep, coffee_chat_rep_session) and the run
 * of show (their Saturday workshop). Used by the coffeeChatSetup and
 * sponsorShortlist routers on the sponsor portal. The organizer board reads
 * the same tables (coffee-chat-sessions-board.ts).
 */
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { blockedSessions, workshopWindows } from "~/lib/coffee-chat-schedule";
import { availableFree, setupTotals } from "~/lib/coffee-chat-setup";
import {
  COFFEE_SESSIONS,
  chatMinutes,
  chatsPerSession,
  isSessionId,
} from "~/lib/coffee-chat-sessions";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

const errors = sponsorSetupCopy.errors;

type Conn = Pick<typeof db, "select">;

export type SetupRep = {
  id: string;
  name: string;
  phone: string;
  isPrimary: boolean;
  chatsWanted: number;
  /** Ticked free, in session order. */
  free: string[];
};

export type SetupWorkshop = {
  /** "HH:MM" */
  start: string;
  end: string;
  title: string;
  location: string | null;
};

export type SponsorSetup = {
  sponsorId: string;
  sponsorName: string;
  hackersPerChat: number;
  longerOneOnOne: boolean;
  chatMinutes: 15 | 30;
  chatsPerSession: number;
  submittedAt: Date | null;
  shortlistSubmittedAt: Date | null;
  /** Last time the sponsor saved anything (any team or preferences write). */
  updatedAt: Date | null;
  reps: SetupRep[];
  /** False when the run of show couldn't be read (nothing blocked). */
  workshopsKnown: boolean;
  workshops: SetupWorkshop[];
  /** Sessions their workshop (with 15-min travel buffers) blocks. */
  blocked: string[];
  /** "Up to N chats · up to N hackers"; hackers = shortlist seats. */
  totals: { chats: number; hackers: number };
  /** Organizers sent this sponsor's schedule (any chat is sent). */
  confirmed: boolean;
};

export async function findSponsor(
  id: string,
  conn: Conn = db,
): Promise<{ id: string; name: string }> {
  const [sponsor] = await conn
    .select({ id: sponsorJudgingSponsors.id, name: sponsorJudgingSponsors.name })
    .from(sponsorJudgingSponsors)
    .where(eq(sponsorJudgingSponsors.id, id.toLowerCase()));
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: errors.unknownSponsor });
  }
  return sponsor;
}

/** Their Saturday workshop blocks, or null when the run of show can't be read. */
async function workshopsOf(
  sponsorName: string,
  conn: Conn,
): Promise<SetupWorkshop[] | null> {
  try {
    const [snapshot, registered] = await Promise.all([
      getRunOfShow(),
      conn.select({ name: sponsorJudgingSponsors.name }).from(sponsorJudgingSponsors),
    ]);
    const sheet = applySponsorNames(
      snapshot,
      registered.map((s) => s.name),
    );
    return sheet.items
      .filter(
        (i) =>
          i.day === "Saturday" &&
          i.column === "sponsor-workshop" &&
          i.sponsors.includes(sponsorName),
      )
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((i) => ({
        start: i.start,
        end: i.end,
        title: i.title,
        location: i.location,
      }));
  } catch (error) {
    console.error("coffee chat setup: run-of-show read failed", error);
    return null;
  }
}

/** Blocked session ids for these workshops (same rule as the board). */
export function blockedFor(
  sponsorName: string,
  workshops: readonly SetupWorkshop[],
): string[] {
  const windows = workshopWindows(
    workshops.map((w) => ({
      day: "Saturday",
      column: "sponsor-workshop",
      start: w.start,
      end: w.end,
      sponsors: [sponsorName],
    })),
    sponsorName,
  );
  return [...blockedSessions({ workshops: windows }, COFFEE_SESSIONS)];
}

/** Everything the portal's coffee chat setup pages show, in one read. */
export async function loadSponsorSetup(
  sponsor: { id: string; name: string },
  conn: Conn = db,
): Promise<SponsorSetup> {
  const [prefRows, repRows, workshops] = await Promise.all([
    conn
      .select()
      .from(coffeeChatPrefs)
      .where(eq(coffeeChatPrefs.sponsorId, sponsor.id)),
    conn
      .select()
      .from(coffeeChatReps)
      .where(eq(coffeeChatReps.sponsorId, sponsor.id))
      .orderBy(
        asc(coffeeChatReps.position),
        asc(coffeeChatReps.createdAt),
        asc(coffeeChatReps.id),
      ),
    workshopsOf(sponsor.name, conn),
  ]);
  const repIds = repRows.map((r) => r.id);
  const [sessionRows, sent] = repIds.length
    ? await Promise.all([
        conn
          .select()
          .from(coffeeChatRepSessions)
          .where(inArray(coffeeChatRepSessions.repId, repIds)),
        conn
          .select({ id: coffeeChatPlacements.id })
          .from(coffeeChatPlacements)
          .where(
            and(
              inArray(coffeeChatPlacements.repId, repIds),
              eq(coffeeChatPlacements.status, "sent"),
            ),
          )
          .limit(1),
      ])
    : [[], []];

  const pref = prefRows[0];
  const format = {
    hackersPerChat: pref?.hackersPerChat ?? 1,
    longerOneOnOne: pref?.longerOneOnOne ?? false,
  };
  const blocked = workshops ? blockedFor(sponsor.name, workshops) : [];
  const reps: SetupRep[] = repRows.map((r) => {
    const ticked = new Set(
      sessionRows.filter((s) => s.repId === r.id).map((s) => s.sessionId),
    );
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      isPrimary: r.isPrimary,
      chatsWanted: r.chatsWanted,
      free: COFFEE_SESSIONS.map((s) => s.id as string).filter(
        (id) => isSessionId(id) && ticked.has(id),
      ),
    };
  });

  return {
    sponsorId: sponsor.id,
    sponsorName: sponsor.name,
    ...format,
    chatMinutes: chatMinutes(format),
    chatsPerSession: chatsPerSession(format),
    submittedAt: pref?.submittedAt ?? null,
    shortlistSubmittedAt: pref?.shortlistSubmittedAt ?? null,
    updatedAt: pref?.updatedAt ?? null,
    reps,
    workshopsKnown: workshops !== null,
    workshops: workshops ?? [],
    blocked,
    totals: setupTotals(
      format,
      reps.map((r) => ({
        chatsWanted: r.chatsWanted,
        availSessions: availableFree(r.free, blocked).length,
      })),
    ),
    confirmed: sent.length > 0,
  };
}

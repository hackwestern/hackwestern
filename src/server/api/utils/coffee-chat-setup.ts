/**
 * One sponsor's coffee chat setup, read from the session-model tables
 * (coffee_chat_pref, coffee_chat_rep, coffee_chat_rep_session) and the run
 * of show (their Saturday workshop). Used by the coffeeChatSetup and
 * sponsorShortlist routers on the sponsor portal. The organizer board reads
 * the same tables (coffee-chat-sessions-board.ts).
 */
import { effectiveChatMinutes } from "~/lib/coffee-chat-tiers";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { availChats, setupTotals, setupWindows } from "~/lib/coffee-chat-setup";
import {
  COFFEE_SESSIONS,
  chatMinutes,
  chatsPerSession,
  isSessionId,
} from "~/lib/coffee-chat-sessions";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import {
  createCachedLoader,
  getRunOfShow,
} from "~/server/api/utils/run-of-show-sheet";
import {
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
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
  /**
   * Most minutes of chats the sponsor's tier allows across all reps
   * (Sponsor Day-Of's Chatting hours); null = no tier or unreadable, no limit.
   */
  maxChatMinutes: number | null;
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
  /**
   * Sessions the buffer only cuts, with the part left ("1:00-1:30 only").
   * Tickable; for the saved chat length.
   */
  partial: Record<string, { start: number; end: number }>;
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
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
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
      conn
        .select({ name: sponsorJudgingSponsors.name })
        .from(sponsorJudgingSponsors),
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

/**
 * Each sponsor's chatting time in minutes, by lowercased name, from
 * Sponsor Day-Of: the Chatting hours cell, else the tier's default
 * (src/lib/coffee-chat-tiers.ts). Cached a minute (setup pages poll and the Sheets quota is
 * tight). A failed read is an empty map: no limit, so a Google outage never
 * stops a sponsor from saving.
 */
const allowanceCache = createCachedLoader(async () => {
  try {
    const info = await fetchAllSponsorInfo(
      await getSheetsClient(),
      getSpreadsheetId(),
    );
    return new Map(
      // The sheet's Chatting hours, else the tier's default (in code).
      [...info].map(([name, r]) => [
        name.toLowerCase(),
        effectiveChatMinutes({ sheetMinutes: r.chattingMinutes, tier: r.tier }),
      ]),
    );
  } catch (error) {
    console.error("coffee chat setup: tier allowance read failed", error);
    return new Map<string, number | null>();
  }
}, 60_000);

/** The sponsor's tier allowance in minutes; null = no limit. */
export async function chatAllowanceMinutes(name: string) {
  return (await allowanceCache.get()).get(name.toLowerCase()) ?? null;
}

/**
 * Refuse a coffee chat setup whose chats add up to more time than the tier
 * allows (Jazz, 2026-11-20): every rep's chats x the chat length.
 */
export function assertWithinTier(
  chatsPerRep: readonly number[],
  minutesPerChat: number,
  maxMinutes: number | null,
) {
  if (maxMinutes === null) return;
  const total = chatsPerRep.reduce((n, c) => n + c, 0) * minutesPerChat;
  if (total > maxMinutes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: sponsorSetupCopy.errors.overTier(maxMinutes, total),
    });
  }
}

/** Everything the portal's coffee chat setup pages show, in one read. */
export async function loadSponsorSetup(
  sponsor: { id: string; name: string },
  conn: Conn = db,
): Promise<SponsorSetup> {
  const [prefRows, repRows, workshops, maxChatMinutes] = await Promise.all([
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
    chatAllowanceMinutes(sponsor.name),
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
  const minutes = chatMinutes(format);
  const windows = setupWindows(workshops ?? [], minutes);
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
    maxChatMinutes,
    ...format,
    chatMinutes: minutes,
    chatsPerSession: chatsPerSession(format),
    submittedAt: pref?.submittedAt ?? null,
    shortlistSubmittedAt: pref?.shortlistSubmittedAt ?? null,
    updatedAt: pref?.updatedAt ?? null,
    reps,
    workshopsKnown: workshops !== null,
    workshops: workshops ?? [],
    blocked: windows.blocked,
    partial: windows.partial,
    totals: setupTotals(
      format,
      reps.map((r) => ({
        chatsWanted: r.chatsWanted,
        availChats: availChats(r.free, windows),
      })),
    ),
    confirmed: sent.length > 0,
  };
}

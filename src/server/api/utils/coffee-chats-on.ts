import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { coffeeChatSponsorNames } from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import { coffeeChatPrefs, coffeeChatReps } from "~/server/db/schema";

// Does this sponsor do coffee chats? (decisions 2026-11-20, "Sponsors
// without coffee chats"). Two things turn them off:
//  - Sponsor Day-Of's "Coffee Chats & Interviews" checkbox isn't ticked.
//    Fails open: the sheet unreadable, or no such column, counts as ticked,
//    so a Google hiccup never hides a paying sponsor's chats.
//  - The sponsor told us they're not doing chats (optOut): availability
//    submitted with every rep at 0 chats (or no reps). No new column: it's
//    read from what's saved. An organizer adding chats turns it back on.

/** Pure: the checkbox, failing open (null = unreadable/no column). */
export function sheetSaysChats(
  ticked: ReadonlySet<string> | null,
  sponsorName: string,
): boolean {
  return ticked === null || ticked.has(sponsorName.toLowerCase());
}

/** Pure: "not doing chats" from what's saved. */
export function isOptedOut(
  submittedAt: Date | null | undefined,
  chatsWanted: readonly number[],
): boolean {
  return !!submittedAt && chatsWanted.every((n) => n === 0);
}

/**
 * Pure: does this sponsor do coffee chats at all? Ticked (failing open) and
 * not opted out. Off = no Chats tab, no availability to chase, and not on
 * the organizers' coffee board or "no availability" flags.
 */
export function doesChats(
  ticked: ReadonlySet<string> | null,
  sponsorName: string,
  submittedAt: Date | null | undefined,
  chatsWanted: readonly number[],
): boolean {
  return (
    sheetSaysChats(ticked, sponsorName) && !isOptedOut(submittedAt, chatsWanted)
  );
}

/** The Sponsor Day-Of checkbox for one sponsor (fails open). */
export async function sheetChatsOn(sponsorName: string): Promise<boolean> {
  return sheetSaysChats(await coffeeChatSponsorNames(), sponsorName);
}

/** Whether the sponsor opted out of chats in the portal. */
export async function chatsOptedOut(sponsorId: string): Promise<boolean> {
  const [pref, reps] = await Promise.all([
    db
      .select({ submittedAt: coffeeChatPrefs.submittedAt })
      .from(coffeeChatPrefs)
      .where(eq(coffeeChatPrefs.sponsorId, sponsorId)),
    db
      .select({ chatsWanted: coffeeChatReps.chatsWanted })
      .from(coffeeChatReps)
      .where(eq(coffeeChatReps.sponsorId, sponsorId)),
  ]);
  return isOptedOut(
    pref[0]?.submittedAt,
    reps.map((r) => r.chatsWanted),
  );
}

/**
 * Refuse a sponsor's coffee chat write when they aren't signed up for chats
 * (checkbox unticked). Organizers on the portal link are never refused.
 */
export async function assertChatsOn(
  sponsorName: string,
  organizer: boolean,
): Promise<void> {
  if (organizer) return;
  if (!(await sheetChatsOn(sponsorName))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: sponsorSetupCopy.errors.notSignedUp,
    });
  }
}

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

// Submitted once (decisions 2026-11-20, "Sponsor setup locks after
// submit"): a sponsor's chatting preferences and hacker shortlist can't be
// edited or un-submitted from the portal after they submit them. Sponsors
// aren't signed in (their private link is the credential); a signed-in
// organizer opening the same portal link can still change them on the
// sponsor's behalf.

/** Whether the caller is a signed-in organizer (never true for sponsors,
 * who have no session). */
export async function isOrganizerCaller(ctx: {
  session: Session | null;
}): Promise<boolean> {
  const id = ctx.session?.user?.id;
  if (!id) return false;
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { type: true },
  });
  return user?.type === "organizer";
}

/** Whether a submitted step is closed to this caller. */
export function isLockedFor(
  submittedAt: Date | null | undefined,
  organizer: boolean,
): boolean {
  return !!submittedAt && !organizer;
}

/** Refuse a sponsor's write to a step they already submitted. */
export function assertNotLocked(
  submittedAt: Date | null | undefined,
  organizer: boolean,
  message: string,
): void {
  if (isLockedFor(submittedAt, organizer)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

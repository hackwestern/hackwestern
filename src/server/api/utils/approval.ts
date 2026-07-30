import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";

/**
 * Application statuses that mean a hacker has been admitted to the event and is
 * therefore allowed to hold a hacker pass / QR code and be scanned.
 *
 * This mirrors the "approved" check in `check-in.ts` (`checkIsHackerApproved`)
 * and is the single source of truth for "is this hacker allowed in".
 */
export const APPROVED_APPLICATION_STATUSES = ["ACCEPTED", "CONFIRMED"] as const;

/**
 * Roles that are always allowed a pass regardless of application status.
 * Organizers and sponsors don't submit hacker applications but still need a
 * badge/QR to be identified on the day of.
 */
const ALWAYS_ALLOWED_ROLES = ["organizer", "sponsor"] as const;

/**
 * Returns whether the given user is allowed to participate in day-of flows
 * (generate a hacker pass / QR code, be scanned for points, meals, etc.).
 *
 * A user is allowed if they are an organizer/sponsor, or if they are a hacker
 * whose application has been ACCEPTED or CONFIRMED. Unapproved hackers
 * (IN_PROGRESS, PENDING_REVIEW, REJECTED, WAITLISTED, DECLINED, ...) are not.
 */
export async function isUserApprovedForEvent(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { type: true },
  });

  if (!user) {
    return false;
  }

  if (
    user.type &&
    (ALWAYS_ALLOWED_ROLES as readonly string[]).includes(user.type)
  ) {
    return true;
  }

  const application = await db.query.applications.findFirst({
    where: eq(applications.userId, userId),
    columns: { status: true },
  });

  return (
    !!application &&
    (APPROVED_APPLICATION_STATUSES as readonly string[]).includes(
      application.status,
    )
  );
}

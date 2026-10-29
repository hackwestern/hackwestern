import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import { RSVP_DEADLINE } from "~/lib/date";

export type TeamFinderAccess =
  | { ok: true; role: "hacker" | "organizer" }
  | { ok: false; reason: "not-allowed" | "not-confirmed" | "not-open" };

/**
 * Who may use the team finder board. Organizers always; hackers only with a
 * CONFIRMED application, and only once RSVP has closed. Sponsors and unknown
 * users never. Checked at read time, so a hacker who declines loses access
 * with no extra write.
 */
export async function getTeamFinderAccess(
  userId: string,
  now = Date.now(),
): Promise<TeamFinderAccess> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { type: true },
  });

  if (user?.type === "organizer") {
    return { ok: true, role: "organizer" };
  }
  if (user?.type !== "hacker") {
    return { ok: false, reason: "not-allowed" };
  }

  const application = await db.query.applications.findFirst({
    where: eq(applications.userId, userId),
    columns: { status: true },
  });

  if (application?.status !== "CONFIRMED") {
    return { ok: false, reason: "not-confirmed" };
  }
  if (now < RSVP_DEADLINE.getTime()) {
    return { ok: false, reason: "not-open" };
  }
  return { ok: true, role: "hacker" };
}

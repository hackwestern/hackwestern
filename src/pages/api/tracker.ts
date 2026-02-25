import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { visitors, visits } from "~/server/db/schema";
import { getServerAuthSession } from "~/server/auth";
import { sql, and, eq, gte } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only accept POST from our middleware fire-and-forget
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const file = req.query.file as string;
    const visitorId = req.query.vid as string;
    const referer = (req.query.ref as string) ?? null;

    if (!file || !visitorId) {
      return res.status(400).json({ error: "Missing file or vid" });
    }

    // Extract headers forwarded from middleware
    const ipAddress = req.headers["x-forwarded-for"]?.toString() ?? null;
    const userAgent = req.headers["user-agent"] ?? null;

    const city = req.headers["x-vercel-ip-city"]?.toString() ?? null;
    const region =
      req.headers["x-vercel-ip-country-region"]?.toString() ?? null;
    const country = req.headers["x-vercel-ip-country"]?.toString() ?? null;
    const latitude = req.headers["x-vercel-ip-latitude"]?.toString() ?? null;
    const longitude = req.headers["x-vercel-ip-longitude"]?.toString() ?? null;

    // Get userId if signed in
    const session = await getServerAuthSession({ req, res });
    const userId = session?.user?.id ?? null;

    console.log(userId, "hi there");

    // Atomic transaction: upsert visitor, then insert visit
    await db.transaction(async (tx) => {
      // Check for immediate dedup (same visitor, same URL, within last 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentVisits = await tx
        .select({ id: visits.id })
        .from(visits)
        .where(
          and(
            eq(visits.visitorId, visitorId),
            eq(visits.url, file),
            gte(visits.createdAt, fiveSecondsAgo),
          ),
        )
        .limit(1);

      if (recentVisits.length > 0) {
        // Duplicate visit detected, skip insertion
        return;
      }

      await tx
        .insert(visitors)
        .values({
          id: visitorId,
          totalVisits: 1,
          lastVisitAt: new Date(),
          firstVisitAt: new Date(),
          userId,
          ipAddress,
          userAgent,
          city,
          region,
          country,
        })
        .onConflictDoUpdate({
          target: visitors.id,
          set: {
            totalVisits: sql`${visitors.totalVisits} + 1`,
            lastVisitAt: new Date(),
            userId,
            ipAddress,
            userAgent,
            city,
            region,
            country,
          },
        });

      await tx.insert(visits).values({
        visitorId,
        url: file,
        userId,
        ipAddress,
        userAgent,
        referer,
        city,
        region,
        country,
        latitude,
        longitude,
      });
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Tracker error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}

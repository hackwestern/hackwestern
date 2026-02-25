import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
} from "~/server/api/trpc";
import { visitors, visits, users } from "~/server/db/schema";
import { db } from "~/server/db";
import { desc, eq, ilike, and, or, gte, lte, sql } from "drizzle-orm";

export const analyticsRouter = createTRPCRouter({
  getVisitors: protectedOrganizerProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          country: z.string().optional(),
          sortBy: z
            .enum(["totalVisits", "lastVisitAt", "firstVisitAt"])
            .optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filters = input ?? {};
      const conditions = [];

      if (filters.country) {
        conditions.push(eq(visitors.country, filters.country));
      }
      if (filters.search) {
        const searchPattern = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(visitors.id, searchPattern),
            ilike(users.name, searchPattern),
            ilike(users.email, searchPattern),
          ),
        );
      }

      const sortCol =
        filters.sortBy === "firstVisitAt"
          ? visitors.firstVisitAt
          : filters.sortBy === "lastVisitAt"
            ? visitors.lastVisitAt
            : visitors.totalVisits;

      const rows = await db
        .select({
          id: visitors.id,
          totalVisits: visitors.totalVisits,
          lastVisitAt: visitors.lastVisitAt,
          firstVisitAt: visitors.firstVisitAt,
          userId: visitors.userId,
          ipAddress: visitors.ipAddress,
          userAgent: visitors.userAgent,
          city: visitors.city,
          region: visitors.region,
          country: visitors.country,
          // Join user info when available
          userName: users.name,
          userEmail: users.email,
          userImage: users.image,
        })
        .from(visitors)
        .leftJoin(users, eq(visitors.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(filters.sortOrder === "asc" ? sortCol : desc(sortCol))
        .limit(500);

      return rows;
    }),

  getVisits: protectedOrganizerProcedure
    .input(
      z
        .object({
          visitorId: z.string().optional(),
          url: z.string().optional(),
          country: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filters = input ?? {};
      const conditions = [];

      if (filters.visitorId) {
        conditions.push(eq(visits.visitorId, filters.visitorId));
      }
      if (filters.url) {
        conditions.push(eq(visits.url, filters.url));
      }
      if (filters.country) {
        conditions.push(eq(visits.country, filters.country));
      }
      if (filters.from) {
        conditions.push(gte(visits.createdAt, filters.from));
      }
      if (filters.to) {
        conditions.push(lte(visits.createdAt, filters.to));
      }

      const rows = await db
        .select({
          id: visits.id,
          visitorId: visits.visitorId,
          url: visits.url,
          userId: visits.userId,
          ipAddress: visits.ipAddress,
          userAgent: visits.userAgent,
          referer: visits.referer,
          city: visits.city,
          region: visits.region,
          country: visits.country,
          latitude: visits.latitude,
          longitude: visits.longitude,
          createdAt: visits.createdAt,
          // Join user info
          userName: users.name,
          userEmail: users.email,
          userImage: users.image,
        })
        .from(visits)
        .leftJoin(users, eq(visits.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(visits.createdAt))
        .limit(1000);

      return rows;
    }),

  getStats: protectedOrganizerProcedure.query(async () => {
    const [visitorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visitors);
    const [visitCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visits);
    const [todayCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visits)
      .where(gte(visits.createdAt, sql`now() - interval '24 hours'`));

    const uniqueUrls = await db
      .select({ url: visits.url, count: sql<number>`count(*)` })
      .from(visits)
      .groupBy(visits.url)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return {
      totalVisitors: visitorCount?.count ?? 0,
      totalVisits: visitCount?.count ?? 0,
      visitsToday: todayCount?.count ?? 0,
      topUrls: uniqueUrls,
    };
  }),

  getClicksOverTime: protectedOrganizerProcedure
    .input(
      z
        .object({
          from: z.date().optional(),
          to: z.date().optional(),
          url: z.string().optional(),
          visitorId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filters = input ?? {};
      const conditions = [];

      // Default to last 30 days if no range
      const fromDate =
        filters.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = filters.to ?? new Date();

      conditions.push(gte(visits.createdAt, fromDate));
      conditions.push(lte(visits.createdAt, toDate));

      if (filters.url) {
        conditions.push(eq(visits.url, filters.url));
      }
      if (filters.visitorId) {
        conditions.push(eq(visits.visitorId, filters.visitorId));
      }

      const rows = await db
        .select({
          date: sql<string>`DATE(${visits.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(visits)
        .where(and(...conditions))
        .groupBy(sql`DATE(${visits.createdAt})`)
        .orderBy(sql`DATE(${visits.createdAt})`);

      return rows;
    }),
});

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { notificationsCopy } from "~/content/notifications";
import { effectiveCoffeeChatStatus } from "~/lib/coffee-chat-requests";
import {
  buildHackerNotices,
  unreadCount,
  type NoticeSources,
} from "~/lib/hacker-notifications";
import { slackEmailInput, slackEmailToStore } from "~/lib/slack-email";
import { teamPresentationsFor } from "~/server/api/routers/sponsor-presentations";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { coffeeChats, sponsorJudgingSponsors, users } from "~/server/db/schema";

/** Everything the notification center lists for one user. */
async function noticeSources(userId: string): Promise<NoticeSources> {
  const now = new Date();
  const [chats, presentations] = await Promise.all([
    db
      .select({
        chatId: coffeeChats.id,
        sponsorName: sponsorJudgingSponsors.name,
        status: coffeeChats.status,
        slotTime: coffeeChats.slotTime,
        durationMinutes: coffeeChats.durationMinutes,
        room: coffeeChats.room,
        createdAt: coffeeChats.createdAt,
        respondedAt: coffeeChats.respondedAt,
      })
      .from(coffeeChats)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
      )
      .where(eq(coffeeChats.userId, userId)),
    teamPresentationsFor(userId),
  ]);
  return {
    chats: chats.map((c) => ({
      ...c,
      status: effectiveCoffeeChatStatus(c, now),
    })),
    presentations,
  };
}

async function me(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, slackEmail: true, notificationsSeen: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}

/** Blank clears it; anything else must be an email. */
const slackEmail = slackEmailInput(notificationsCopy.settings.invalid);

/**
 * The hacker's notification center on /live (src/lib/hacker-notifications.ts)
 * and the email they use on Slack (src/lib/slack-email.ts).
 */
export const notificationsRouter = createTRPCRouter({
  /** Their notices, newest first, plus the emails we reach them at. */
  center: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [user, sources] = await Promise.all([
      me(userId),
      noticeSources(userId),
    ]);
    const notices = buildHackerNotices(sources, user.notificationsSeen);
    return {
      notices,
      unread: unreadCount(notices),
      applicationEmail: user.email,
      slackEmail: user.slackEmail,
    };
  }),

  /**
   * Mark everything listed right now as read. The server works out the
   * keys itself; only current notices are kept, so the list stays small.
   */
  markSeen: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const notices = buildHackerNotices(await noticeSources(userId), []);
    await db
      .update(users)
      .set({ notificationsSeen: notices.map((n) => n.key) })
      .where(eq(users.id, userId));
    return { unread: 0 };
  }),

  /**
   * Set (or clear, with "") the email the hacker uses on Slack. The same
   * address as their account email is stored as null: nothing to try first.
   */
  setSlackEmail: protectedProcedure
    .input(z.object({ slackEmail }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await me(userId);
      const slackEmail = slackEmailToStore(input.slackEmail, user.email);
      await db.update(users).set({ slackEmail }).where(eq(users.id, userId));
      return { slackEmail };
    }),
});

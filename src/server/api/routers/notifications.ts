import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { notificationsCopy } from "~/content/notifications";
import { env } from "~/env";
import { effectiveCoffeeChatStatus } from "~/lib/coffee-chat-requests";
import {
  buildHackerNotices,
  nextSeenKeys,
  unreadCount,
  type NoticeSources,
} from "~/lib/hacker-notifications";
import { slackEmailInput, slackEmailToStore } from "~/lib/slack-email";
import { teamPresentationsFor } from "~/server/api/routers/sponsor-presentations";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { lookupSlackUser } from "~/server/slack/dm";
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
        expiresAt: coffeeChats.expiresAt,
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

/** Longest notice key accepted from the client, and how many at once. */
const MAX_NOTICE_KEY = 200;
const MAX_SHOWN_NOTICES = 500;

/** Longest the save waits for Slack before answering without a name. */
const SLACK_CHECK_TIMEOUT_MS = 2000;

export type SlackCheck =
  | { status: "found"; email: string; name: string | null }
  | { status: "not-found"; email: string }
  | { status: "unchecked" };

/**
 * Who Slack finds for the email we'll try first, for the hacker to see.
 * "unchecked" when there's no bot token or Slack fails: never blocks a save.
 */
async function checkOnSlack(email: string): Promise<SlackCheck> {
  const token = env.SLACK_BOT_TOKEN;
  if (!token) return { status: "unchecked" };
  try {
    const user = await lookupSlackUser(
      token,
      email,
      fetch,
      SLACK_CHECK_TIMEOUT_MS,
    );
    return user
      ? { status: "found", email, name: user.name }
      : { status: "not-found", email };
  } catch (error) {
    console.error(
      "Slack email check failed:",
      error instanceof Error ? error.message : String(error),
    );
    return { status: "unchecked" };
  }
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
   * Mark the notices the hacker was shown as read. Only keys of notices
   * that still exist are kept (with the ones already seen), so a notice
   * that arrived after the panel opened stays unread and the list stays
   * small.
   */
  markSeen: protectedProcedure
    .input(
      z.object({
        keys: z.array(z.string().max(MAX_NOTICE_KEY)).max(MAX_SHOWN_NOTICES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [user, sources] = await Promise.all([
        me(userId),
        noticeSources(userId),
      ]);
      const current = buildHackerNotices(sources, []).map((n) => n.key);
      const notificationsSeen = nextSeenKeys(
        current,
        user.notificationsSeen,
        input.keys,
      );
      await db
        .update(users)
        .set({ notificationsSeen })
        .where(eq(users.id, userId));
      return {
        unread: current.filter((k) => !notificationsSeen.includes(k)).length,
      };
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
      // Saved either way; the lookup only shows the hacker who Slack finds,
      // so a typo or the wrong address is caught by eye.
      return {
        slackEmail,
        slack: await checkOnSlack(slackEmail ?? user.email),
      };
    }),
});

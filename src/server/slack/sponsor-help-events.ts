// Slack Events API handling for sponsor help requests: verify the request
// signature, answer url_verification, and claim a help request on the first
// reaction or thread reply from a person. Used by /api/slack/events, which is
// shared with other Slack features (coffee chat DMs), so event types this file
// doesn't know about are acknowledged and ignored.

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { sponsorHelpCopy } from "~/content/sponsor-help";
import type { SponsorHelpReason } from "~/lib/sponsor-help";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import {
  markSponsorHelpMessage,
  postSponsorHelpClaimed,
  slackDisplayName,
  sponsorHelpSigningSecret,
  type SlackMessageRef,
} from "~/server/slack/sponsor-help";

/** Slack's replay window: reject requests signed more than 5 minutes ago. */
const MAX_AGE_SECONDS = 5 * 60;

export function slackSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  const hmac = createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  return `v0=${hmac}`;
}

/** Check X-Slack-Signature against the raw body, timing-safe. */
export function verifySlackSignature(p: {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  now: Date;
}): boolean {
  if (!p.timestamp || !p.signature || !/^\d+$/.test(p.timestamp)) return false;
  const age = Math.abs(p.now.getTime() / 1000 - Number(p.timestamp));
  if (age > MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(
    slackSignature(p.secret, p.timestamp, p.rawBody),
  );
  const given = Buffer.from(p.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type SlackEvent = {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  item?: { type?: string; channel?: string; ts?: string };
};

type SlackPayload = {
  type?: string;
  challenge?: string;
  event?: SlackEvent;
  authorizations?: { user_id?: string; is_bot?: boolean }[];
};

export type SlackEventResult = {
  status: number;
  body: Record<string, unknown> | string;
};

/**
 * The person and help message an event points at, or null when the event
 * can't claim anything (bot, edit, top-level message, other event type).
 */
export function claimTarget(
  payload: SlackPayload,
): { userId: string; ref: SlackMessageRef } | null {
  const event = payload.event;
  if (!event?.user) return null;
  const botUsers = new Set(
    (payload.authorizations ?? [])
      .filter((a) => a.is_bot && a.user_id)
      .map((a) => a.user_id!),
  );
  if (botUsers.has(event.user)) return null;

  if (event.type === "reaction_added") {
    const item = event.item;
    if (item?.type !== "message" || !item.channel || !item.ts) return null;
    return { userId: event.user, ref: { channel: item.channel, ts: item.ts } };
  }

  if (event.type === "message") {
    // Only plain replies by a person in a thread. Bot posts, edits, joins
    // etc. all carry a subtype or bot_id.
    if (event.bot_id !== undefined || event.subtype !== undefined) return null;
    if (!event.channel || !event.thread_ts || event.thread_ts === event.ts) {
      return null;
    }
    return {
      userId: event.user,
      ref: { channel: event.channel, ts: event.thread_ts },
    };
  }

  return null;
}

/**
 * Claim the open help request behind `ref` for `userId`. First claim wins:
 * one UPDATE that only matches while the request is still open, done before
 * any Slack call. Returns the Slack follow-up (claimer's name, "on it" reply,
 * message edit), or null when this event didn't claim anything.
 */
export async function claimSponsorHelp(
  ref: SlackMessageRef,
  userId: string,
): Promise<(() => Promise<void>) | null> {
  const [claimed] = await db
    .update(sponsorHelpRequests)
    .set({
      status: "claimed",
      claimedBySlackId: userId,
      claimedAt: new Date(),
    })
    .where(
      and(
        eq(sponsorHelpRequests.slackChannel, ref.channel),
        eq(sponsorHelpRequests.slackTs, ref.ts),
        eq(sponsorHelpRequests.status, "open"),
      ),
    )
    .returning();
  // Unrelated message, or already claimed/closed: nothing to do.
  if (!claimed) return null;

  return async () => {
    const name =
      (await slackDisplayName(userId)) ?? sponsorHelpCopy.status.claimedSomeone;
    await db
      .update(sponsorHelpRequests)
      .set({ claimedByName: name })
      .where(eq(sponsorHelpRequests.id, claimed.id));
    const sponsor = await db.query.sponsorJudgingSponsors.findFirst({
      where: eq(sponsorJudgingSponsors.id, claimed.sponsorId),
      columns: { name: true },
    });
    await postSponsorHelpClaimed(ref, userId);
    await markSponsorHelpMessage(
      ref,
      {
        sponsorName: sponsor?.name ?? "",
        reason: claimed.reason as SponsorHelpReason,
        note: claimed.note,
        location: claimed.location,
        repName: claimed.repName,
        phone: claimed.phone,
        locationNote: claimed.locationNote,
      },
      { kind: "claimed", name },
    );
  };
}

/**
 * Handle one Events API request. Framework-free so it can be tested. The
 * Slack follow-up runs before responding (work after the response can be
 * frozen on Vercel); each Slack call times out after 1.5s. Claiming first and
 * ignoring retries keeps this idempotent even if Slack's 3s limit is hit.
 */
export async function handleSlackEvent(p: {
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  /** X-Slack-Retry-Num: Slack re-sending an event it thinks we missed. */
  retryNum?: string;
  now?: Date;
}): Promise<SlackEventResult> {
  // Slack re-sending an event: the first delivery already claimed it.
  if (p.retryNum !== undefined) return { status: 200, body: { ok: true } };

  const secret = sponsorHelpSigningSecret();
  if (
    !secret ||
    !verifySlackSignature({
      secret,
      timestamp: p.timestamp,
      signature: p.signature,
      rawBody: p.rawBody,
      now: p.now ?? new Date(),
    })
  ) {
    return { status: 401, body: { error: "invalid signature" } };
  }

  let payload: SlackPayload;
  try {
    payload = JSON.parse(p.rawBody) as SlackPayload;
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }

  if (payload.type === "url_verification") {
    return { status: 200, body: { challenge: payload.challenge ?? "" } };
  }

  if (payload.type === "event_callback") {
    const target = claimTarget(payload);
    if (target) {
      try {
        const followUp = await claimSponsorHelp(target.ref, target.userId);
        await followUp?.().catch((error) =>
          console.error("sponsor help claim follow-up failed", error),
        );
      } catch (error) {
        // Ack anyway: a retry from Slack wouldn't help a DB error.
        console.error("sponsor help claim failed", error);
      }
    }
  }

  // Everything else (other event types, other features' events) is acked.
  return { status: 200, body: { ok: true } };
}

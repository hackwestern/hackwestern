// Slack Events API handling for sponsor help requests: verify the request
// signature, answer url_verification, and claim a help request on the first
// reaction or thread reply from a person. Used by /api/slack/events, which is
// shared with other Slack features (coffee chat DMs), so event types this file
// doesn't know about are acknowledged and ignored.

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

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
    if (event.bot_id || event.subtype) return null;
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
 * the UPDATE only matches while the request is still open. Returns whether
 * this call claimed it.
 */
export async function claimSponsorHelp(
  ref: SlackMessageRef,
  userId: string,
): Promise<boolean> {
  const target = and(
    eq(sponsorHelpRequests.slackChannel, ref.channel),
    eq(sponsorHelpRequests.slackTs, ref.ts),
  );
  const open = await db.query.sponsorHelpRequests.findFirst({
    where: and(target, eq(sponsorHelpRequests.status, "open")),
    columns: { id: true },
  });
  // Unrelated message, or already claimed/closed: nothing to do.
  if (!open) return false;

  const name = (await slackDisplayName(userId)) ?? null;
  const [claimed] = await db
    .update(sponsorHelpRequests)
    .set({
      status: "claimed",
      claimedBySlackId: userId,
      claimedByName: name,
      claimedAt: new Date(),
    })
    .where(
      and(eq(sponsorHelpRequests.id, open.id), eq(sponsorHelpRequests.status, "open")),
    )
    .returning();
  if (!claimed) return false;

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
    },
    { kind: "claimed", name: name ?? `<@${userId}>` },
  );
  return true;
}

/** Handle one Events API request. Framework-free so it can be tested. */
export async function handleSlackEvent(p: {
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  now?: Date;
}): Promise<SlackEventResult> {
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
        await claimSponsorHelp(target.ref, target.userId);
      } catch (error) {
        // Ack anyway: a retry from Slack wouldn't help a DB error.
        console.error("sponsor help claim failed", error);
      }
    }
  }

  // Everything else (other event types, other features' events) is acked.
  return { status: 200, body: { ok: true } };
}

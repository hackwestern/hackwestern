// Slack side of sponsor help requests (docs/runbooks/slack-sponsor-help.md).
// Plain fetch against the Slack Web API. Every function is a silent no-op
// when no bot token is set (SPONSOR_HELP_SLACK_BOT_TOKEN, else the shared
// SLACK_BOT_TOKEN), and never throws: Slack being
// down must not stop a sponsor from asking for help (the organizer queue on
// /internal/sponsor-schedule is the backup).

import { sponsorHelpCopy } from "~/content/sponsor-help";
import { env } from "~/env";
import {
  SPONSOR_HELP_REPING_MINUTES,
  telHref,
  type SponsorHelpReason,
} from "~/lib/sponsor-help";

const copy = sponsorHelpCopy.slack;
const SLACK_API = "https://slack.com/api";
// Keep each call short: the events endpoint awaits these before answering
// Slack, which wants a reply within 3 seconds.
const SLACK_TIMEOUT_MS = 1500;

export type SlackMessageRef = { channel: string; ts: string };

export type SponsorHelpDetails = {
  sponsorName: string;
  reason: SponsorHelpReason;
  note: string | null;
  /** Booth from the sponsor info sheet. */
  location: string | null;
  /** Contact the sponsor typed. Null only on rows from before 0042. */
  repName: string | null;
  phone: string | null;
  /** "Where are you right now?", if they said. */
  locationNote: string | null;
};

/** Escape user text for Slack mrkdwn: &, < and > are control characters. */
export function slackEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The fields every message shows, escaped and ready for mrkdwn. */
function contactFields(details: SponsorHelpDetails) {
  const phone = details.phone?.trim();
  return {
    sponsor: slackEscape(details.sponsorName),
    rep: details.repName ? slackEscape(details.repName) : null,
    // <tel:+15195550123|519-555-0123>: digits in the link, as typed in the label.
    phone: phone ? `<${telHref(phone)}|${slackEscape(phone)}>` : null,
    where: details.locationNote
      ? { kind: "now" as const, text: slackEscape(details.locationNote) }
      : details.location
        ? { kind: "booth" as const, text: slackEscape(details.location) }
        : { kind: "none" as const, text: "" },
  };
}

// Hackers and the sponsor team share one Slack app, so the shared SLACK_*
// values are the default; SPONSOR_HELP_SLACK_* override them.
function token(): string | null {
  return env.SPONSOR_HELP_SLACK_BOT_TOKEN ?? env.SLACK_BOT_TOKEN ?? null;
}

/** Secret for verifying Slack's request signatures; null when unset. */
export function sponsorHelpSigningSecret(): string | null {
  return (
    env.SPONSOR_HELP_SLACK_SIGNING_SECRET ?? env.SLACK_SIGNING_SECRET ?? null
  );
}

function mention(): string {
  return env.SPONSOR_HELP_SLACK_MENTION ?? "";
}

/** Whether the bot can post at all (token and channel both set). */
export function sponsorHelpSlackEnabled(): boolean {
  return Boolean(token() && env.SPONSOR_HELP_SLACK_CHANNEL);
}

type SlackResponse = { ok: boolean; error?: string } & Record<string, unknown>;

/**
 * POST one Web API method. Returns the parsed response when Slack says ok,
 * otherwise logs and returns null. Write methods take JSON; read methods
 * (users.info) take form fields.
 */
async function callSlack(
  method: string,
  body: Record<string, string | boolean | undefined>,
  { form = false }: { form?: boolean } = {},
): Promise<SlackResponse | null> {
  const bot = token();
  if (!bot) return null;
  const fields = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined),
  ) as Record<string, string | boolean>;
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${bot}`,
        "Content-Type": form
          ? "application/x-www-form-urlencoded"
          : "application/json; charset=utf-8",
      },
      body: form
        ? new URLSearchParams(
            Object.entries(fields).map(([k, v]) => [k, String(v)]),
          ).toString()
        : JSON.stringify(fields),
    });
    const json = (await res.json()) as SlackResponse;
    if (!json.ok) {
      console.error(`Slack ${method} failed`, json.error);
      return null;
    }
    return json;
  } catch (error) {
    console.error(`Slack ${method} failed`, error);
    return null;
  }
}

function requestText(details: SponsorHelpDetails): string {
  return copy.request({
    mention: mention(),
    ...contactFields(details),
    reason: sponsorHelpCopy.reasons[details.reason],
    note: details.note ? slackEscape(details.note) : null,
  });
}

/** Post a new request in the channel, pinging the group. Null when skipped. */
export async function postSponsorHelpRequest(
  details: SponsorHelpDetails,
): Promise<SlackMessageRef | null> {
  const channel = env.SPONSOR_HELP_SLACK_CHANNEL;
  if (!token() || !channel) return null;
  const res = await callSlack("chat.postMessage", {
    channel,
    text: requestText(details),
    unfurl_links: false,
  });
  if (!res || typeof res.ts !== "string") return null;
  return {
    channel: typeof res.channel === "string" ? res.channel : channel,
    ts: res.ts,
  };
}

/** Re-ping an unclaimed request in its thread. True when it was sent. */
export async function repingSponsorHelp(
  ref: SlackMessageRef,
  step: 1 | 2,
  details: SponsorHelpDetails,
): Promise<boolean> {
  const res = await callSlack("chat.postMessage", {
    channel: ref.channel,
    thread_ts: ref.ts,
    text: copy.reping({
      mention: mention(),
      step,
      minutes: SPONSOR_HELP_REPING_MINUTES[step === 1 ? 0 : 1],
      ...contactFields(details),
    }),
  });
  return res !== null;
}

export type SponsorHelpOutcome =
  | { kind: "claimed"; name: string }
  | { kind: "resolved" }
  | { kind: "cancelled" };

/** Edit the original post to show it was claimed, resolved or cancelled. */
export async function markSponsorHelpMessage(
  ref: SlackMessageRef,
  details: SponsorHelpDetails,
  outcome: SponsorHelpOutcome,
): Promise<void> {
  const header =
    outcome.kind === "claimed"
      ? copy.claimedHeader(outcome.name)
      : outcome.kind === "resolved"
        ? copy.resolvedHeader
        : copy.cancelledHeader;
  await callSlack("chat.update", {
    channel: ref.channel,
    ts: ref.ts,
    text: `${header}\n${requestText(details)}`,
  });
}

/** "<@user> is on it" in the request's thread. */
export async function postSponsorHelpClaimed(
  ref: SlackMessageRef,
  slackUserId: string,
): Promise<void> {
  await callSlack("chat.postMessage", {
    channel: ref.channel,
    thread_ts: ref.ts,
    text: copy.onIt(slackUserId),
  });
}

/** A Slack user's display name (falls back to real name, then handle). */
export async function slackDisplayName(
  slackUserId: string,
): Promise<string | null> {
  const res = await callSlack(
    "users.info",
    { user: slackUserId },
    { form: true },
  );
  const user = res?.user as
    | {
        name?: string;
        real_name?: string;
        profile?: { display_name?: string; real_name?: string };
      }
    | undefined;
  if (!user) return null;
  const pick = [
    user.profile?.display_name,
    user.profile?.real_name,
    user.real_name,
    user.name,
  ].find((v) => typeof v === "string" && v.trim() !== "");
  return pick?.trim() ?? null;
}

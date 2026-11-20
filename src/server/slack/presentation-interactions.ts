import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";

import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { env } from "~/env";
import { confirmTeamTimes } from "~/server/api/utils/presentation-confirm";
import { db } from "~/server/db";
import {
  sponsorJudgingSponsors,
  sponsorPresentations,
  teams,
  users,
} from "~/server/db/schema";
import { slackApi } from "~/server/slack/client";
import {
  INTERACTION_STEP_TIMEOUT_MS,
  ephemeral,
  isDirectMessage,
  payloadSchema,
  reply,
  type Deps,
  type InteractionOutcome,
  type UserInfo,
} from "~/server/slack/coffee-chat-interactions";
import {
  PRESENTATION_CONFIRM_ACTION,
  decodeConfirmValue,
  presentationDmMessage,
} from "~/server/slack/presentation-dm";

/**
 * "Confirm our times" clicks from the presentation DM, behind
 * /api/slack/interactions (signature checked there). The click counts only
 * in the bot's DM, for a member of that team matched by their Slack email,
 * and only while the team's times are still the ones in the message. One
 * member confirming covers the team (Jazz, 2026-11-19).
 */

const copy = sponsorPresentationsCopy.slack.result;

/** The payload is a click on the presentation Confirm button. */
export function isPresentationConfirm(raw: unknown): boolean {
  const parsed = payloadSchema.safeParse(raw);
  return (
    parsed.success &&
    (parsed.data.actions ?? []).some(
      (a) => a.action_id === PRESENTATION_CONFIRM_ACTION,
    )
  );
}

/** The member of `teamId` whose account or Slack email is `email`. */
async function memberByEmail(teamId: string, email: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.teamId, teamId),
        or(
          sql`lower(${users.email}) = ${email}`,
          sql`lower(${users.slackEmail}) = ${email}`,
        ),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/** The DM again, with the result line in place of the button. */
async function confirmedMessage(teamId: string, text: string) {
  const rows = await db
    .select({
      teamName: teams.name,
      sponsorName: sponsorJudgingSponsors.name,
      room: sponsorPresentations.room,
      start: sponsorPresentations.startMinute,
    })
    .from(sponsorPresentations)
    .innerJoin(teams, eq(teams.id, sponsorPresentations.teamId))
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, sponsorPresentations.sponsorId),
    )
    .where(
      and(
        eq(sponsorPresentations.teamId, teamId),
        isNotNull(sponsorPresentations.startMinute),
      ),
    );
  return {
    replace_original: true,
    ...presentationDmMessage(
      rows[0]?.teamName ?? "",
      rows.map((r) => ({
        sponsorName: r.sponsorName,
        room: r.room ?? "",
        start: r.start!,
      })),
      { result: text },
    ),
  };
}

/** Act on one Confirm click. */
export async function handlePresentationConfirm(
  rawPayload: unknown,
  deps: Deps = {},
): Promise<InteractionOutcome> {
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success || parsed.data.type !== "block_actions") return "ignored";
  const payload = parsed.data;
  const action = payload.actions?.find(
    (a) => a.action_id === PRESENTATION_CONFIRM_ACTION,
  );
  if (!action) return "ignored";
  const fetchImpl = deps.fetch ?? fetch;
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  const value = decodeConfirmValue(action.value);

  const fail = async (outcome: "notYours" | "failed") => {
    await reply(payload.response_url, ephemeral(copy[outcome]), fetchImpl);
    return outcome;
  };

  if (!value || !payload.user) return fail("notYours");
  // Only the bot's DM with the clicker, as for coffee chats.
  if (!isDirectMessage(payload)) return fail("notYours");
  if (!token) return fail("failed");

  let userId: string | null;
  try {
    const info = await slackApi<UserInfo>(
      token,
      "users.info",
      { user: payload.user.id },
      fetchImpl,
      INTERACTION_STEP_TIMEOUT_MS,
    );
    const email = info.user?.profile?.email?.trim().toLowerCase();
    userId = email ? await memberByEmail(value.teamId, email) : null;
  } catch (error) {
    console.error(
      "Slack users.info failed:",
      error instanceof Error ? error.message : String(error),
    );
    return fail("failed");
  }
  if (!userId) return fail("notYours");

  try {
    await confirmTeamTimes(userId, "slack", value.key);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "CONFLICT") {
      await reply(payload.response_url, ephemeral(copy.changed), fetchImpl);
      return "changed";
    }
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return fail("notYours");
    }
    console.error(
      "Slack presentation confirm failed:",
      error instanceof Error ? error.message : String(error),
    );
    return fail("failed");
  }
  await reply(
    payload.response_url,
    await confirmedMessage(value.teamId, copy.confirmed),
    fetchImpl,
  );
  return "confirmed";
}

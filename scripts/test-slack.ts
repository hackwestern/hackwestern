import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";
import { dmByEmails, lookupSlackUser } from "~/server/slack/dm";
import { presentationDmMessage } from "~/server/slack/presentation-dm";
import { coffeeChatDmMessage } from "~/server/slack/coffee-chat-dm";

/**
 * Slack scaffolding smoke test.
 *
 *   npm run slack:test -- --email=you@example.com
 *   npm run slack:test -- --email=you@example.com --send
 *
 * Diagnostics run without --send. With --send, it sends a plain test DM,
 * an example coffee-chat offer DM, and a presentation-format DM.
 */
function arg(name: string): string | null {
  const found = process.argv
    .find((part) => part.startsWith(`--${name}=`));
  return found?.slice(`--${name}=`.length).trim() || null;
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function errorCode(error: unknown): string {
  if (error instanceof SlackApiError) return error.code;
  if (error instanceof Error) return error.name;
  return "unknown";
}

async function main() {
  const email = arg("email");
  const send = process.argv.includes("--send");
  const token =
    process.env.SLACK_BOT_TOKEN ??
    process.env.SPONSOR_HELP_SLACK_BOT_TOKEN ??
    null;

  console.log("Slack scaffolding test");
  console.log(`Mode: ${send ? "send" : "diagnostics only"}`);
  console.log(`SLACK_BOT_TOKEN: ${token ? "set" : "missing"}`);
  console.log(
    `SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET ? "set" : "missing"}`,
  );
  if (!email) {
    throw new Error("Missing --email=you@example.com");
  }
  if (!email.includes("@")) {
    throw new Error(`Invalid email: ${maskEmail(email)}`);
  }
  if (!token) {
    throw new Error(
      "Missing Slack token. Set SLACK_BOT_TOKEN or SPONSOR_HELP_SLACK_BOT_TOKEN.",
    );
  }

  const auth = await slackApi<
    SlackResponse & { team?: string; user?: string }
  >(token, "auth.test", {});
  console.log(`auth.test: ok (${auth.team ?? "team unknown"})`);

  const lookedUp = await lookupSlackUser(token, email);
  if (!lookedUp) {
    console.log(`Lookup: no Slack user found for ${maskEmail(email)}`);
  } else {
    console.log(
      `Lookup: found ${lookedUp.name ?? "unnamed user"} (${lookedUp.id})`,
    );
  }

  if (!send) {
    console.log("No messages sent. Re-run with --send to post test messages.");
    return;
  }

  const plainResult = await dmByEmails(
    token,
    [email],
    {
      text: "Hack Western Slack test",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Hack Western Slack test*\nThis is a plain test message.",
          },
        },
      ],
    },
  );
  console.log(`Plain DM: ${plainResult}`);

  if (plainResult === "sent") {
    const coffeeChatResult = await dmByEmails(
      token,
      [email],
      coffeeChatDmMessage({
        chatId: "00000000-0000-4000-8000-000000000000",
        sponsorName: "Canada Life",
        slotTime: "11:00",
        durationMinutes: 15,
        room: "Rm 2241",
        repName: "Priya",
        placementId: "00000000-0000-4000-8000-000000000001",
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      }),
    );
    console.log(`Coffee-chat offer DM: ${coffeeChatResult}`);

    const presentationResult = await dmByEmails(
      token,
      [email],
      presentationDmMessage("Slack Test Team", [
        {
          sponsorName: "Slack Test Sponsor",
          room: "Test Room 101",
          start: 10 * 60,
        },
      ]),
    );
    console.log(`Presentation-format DM: ${presentationResult}`);
  }

}

main().catch((error: unknown) => {
  if (error instanceof SlackApiError) {
    console.error(
      `Slack test failed at ${error.method}: ${error.code}`,
    );
  } else {
    console.error(
      `Slack test failed: ${errorCode(error)} ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  process.exitCode = 1;
});

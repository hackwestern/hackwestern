import { and, eq, isNull, notExists, sql } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  applications,
  emailReminderSent,
  emailSubscribers,
  users,
} from "~/server/db/schema";
import { sendViaMailjet } from "~/server/mail-mailjet";
import {
  REMINDER_COPY,
  incompleteReminderTemplate,
  incompleteReminderText,
  type ReminderKind,
} from "~/server/api/routers/email-templates";
import { classifyResult } from "./send-campaign";

// Reminds people who started an application but haven't submitted it.
// Run by .github/workflows/incomplete-reminder.yml. Dry run unless --send.
//
//   npx tsx scripts/send-incomplete-reminder.ts --kind=reminder-1 [--send] [--only=me@x.com]
//
// --only sends just that address (any status) and never writes the sent-log,
// so a test can't stop the real send from reaching that person.

const KINDS: ReminderKind[] = ["reminder-1", "reminder-2"];
const DELAY_MS = 300;
// Test and throwaway accounts never get a reminder.
const TEST_EMAIL = [/@example\.(com|org)$/i, /\+test@/i, /^test[^@]*@/i];

export type Recipient = { userId: string; email: string; name: string | null };

export const isTestEmail = (email: string) =>
  TEST_EMAIL.some((re) => re.test(email));

/** a***@gmail.com: enough to spot a problem in a public Actions log. */
export const maskEmail = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
};

/** In-progress hackers who haven't had this reminder and haven't bounced. */
export async function selectRecipients(
  kind: ReminderKind,
  only?: string,
): Promise<Recipient[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: sql<
        string | null
      >`coalesce(nullif(trim(${applications.firstName}), ''), ${users.name})`,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .leftJoin(emailSubscribers, eq(emailSubscribers.email, users.email))
    .where(
      only
        ? eq(users.email, only.trim().toLowerCase())
        : and(
            eq(applications.status, "IN_PROGRESS"),
            eq(users.type, "hacker"),
            isNull(emailSubscribers.bouncedAt),
            notExists(
              db
                .select({ one: sql`1` })
                .from(emailReminderSent)
                .where(
                  and(
                    eq(emailReminderSent.userId, users.id),
                    eq(emailReminderSent.kind, kind),
                  ),
                ),
            ),
          ),
    );
  return only ? rows : rows.filter((r) => !isTestEmail(r.email));
}

export function renderReminder(kind: ReminderKind, name: string | null) {
  return {
    subject: REMINDER_COPY[kind].subject,
    html: incompleteReminderTemplate(kind, name ?? undefined),
    text: incompleteReminderText(kind, name ?? undefined),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const arg = (k: string) =>
    process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const kind = arg("kind") as ReminderKind | undefined;
  if (!kind || !KINDS.includes(kind)) {
    console.error(`Pass --kind=${KINDS.join(" or --kind=")}.`);
    process.exit(1);
  }
  const SEND = process.argv.includes("--send");
  const only = arg("only");

  const recipients = await selectRecipients(kind, only);
  console.log(
    `${kind}: ${recipients.length} recipient(s)${only ? " [only]" : ""}. Mode: ${SEND ? "SEND" : "DRY RUN"}.`,
  );
  if (!SEND) {
    recipients.forEach((r, i) =>
      console.log(`${i + 1}. ${maskEmail(r.email)}`),
    );
    return;
  }

  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    console.error("MAILJET_API_KEY / MAILJET_SECRET_KEY not set; cannot send.");
    process.exit(1);
  }
  const creds = {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  };

  let sent = 0,
    failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = renderReminder(kind, r.name);
    const res = await sendViaMailjet(
      // About the recipient's own application, so it goes out like the other
      // transactional email (application received, verify, reset).
      {
        from: "Hack Western Team <hello@hackwestern.com>",
        to: r.email,
        subject,
        html,
        text,
      },
      creds,
    );
    const outcome = classifyResult(res);
    if (outcome === "quota") {
      console.log(
        `FAIL ${maskEmail(r.email)}: ${res.error?.message}. Quota hit, stopping.`,
      );
      break;
    }
    if (outcome === "ok") {
      sent++;
      if (!only) {
        await db
          .insert(emailReminderSent)
          .values({ userId: r.userId, kind })
          .onConflictDoNothing();
      }
      console.log(`ok ${maskEmail(r.email)}`);
    } else {
      failed++;
      console.log(
        `${outcome.toUpperCase()} ${maskEmail(r.email)}: ${res.error?.message ?? ""}`,
      );
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done. sent ${sent}, failed ${failed}.`);
}

if (process.argv[1]?.includes("send-incomplete-reminder")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

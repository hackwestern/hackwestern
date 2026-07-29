/**
 * Script to send bulk application launch announcement emails to previous year hackers.
 * Uses Cloudflare Email Service API with batching and rate-limiting.
 * 
 * Usage:
 *   npx tsx scripts/send-hacker-outreach.ts path/to/hacker-emails.json
 * 
 * Example JSON format:
 *   [
 *     { "email": "hacker1@example.com", "name": "Alex" },
 *     { "email": "hacker2@example.com", "name": "Sam" }
 *   ]
 */

import fs from "fs";
import path from "path";
import { sendEmail } from "../src/server/mail";

interface Recipient {
  email: string;
  name?: string;
}

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOutreachTemplate(name?: string) {
  const recipientName = name?.trim() ? name.trim() : "Hacker";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #6C3EBB;">Applications for Hack Western 12 are NOW OPEN! 🎉</h2>
      <p>Hi ${recipientName},</p>
      <p>We're thrilled to announce that applications for <strong>Hack Western 12</strong> are officially open!</p>
      <p>Join hundreds of innovative builders, creators, and hackers from across North America for a weekend of hacking, mentorship, workshops, and epic prizes.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="https://hackwestern.com" style="background-color: #6C3EBB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
          Apply Now for Hack Western 12
        </a>
      </div>
      <p>Don't miss out — submit your application early to secure your spot!</p>
      <br />
      <p>Best regards,<br />The Hack Western Team 💜</p>
    </div>
  `;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Error: Please provide a path to a JSON file containing recipient emails.");
    console.error("Usage: npx tsx scripts/send-hacker-outreach.ts <path-to-emails.json>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at ${absolutePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(absolutePath, "utf-8");
  const recipients: Recipient[] = JSON.parse(rawData);

  console.log(`Loaded ${recipients.length} recipients for Hack Western outreach campaign.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(recipients.length / BATCH_SIZE)} (${batch.length} emails)...`);

    await Promise.all(
      batch.map(async (recipient) => {
        const { error } = await sendEmail({
          to: recipient.email,
          subject: "Hack Western 12 Applications are NOW OPEN! 🚀",
          html: getOutreachTemplate(recipient.name),
        });

        if (error) {
          console.error(`[FAILED] ${recipient.email}: ${error.message}`);
          failCount++;
        } else {
          successCount++;
        }
      })
    );

    if (i + BATCH_SIZE < recipients.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log("\n================ Outreach Complete ================");
  console.log(`Successfully sent: ${successCount}`);
  console.log(`Failed:            ${failCount}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Fatal outreach error:", err);
  process.exit(1);
});

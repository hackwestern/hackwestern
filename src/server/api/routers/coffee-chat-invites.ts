import { createTRPCRouter } from "~/server/api/trpc";

// Hacker invites from the confirmed coffee chat schedule (track B of the
// 8-hour build): one invite per seat, round 1 Fri 10 PM, then automatic
// 30-minute rounds on Saturday. Registered early so tracks don't both edit
// root.ts.
export const coffeeChatInvitesRouter = createTRPCRouter({});

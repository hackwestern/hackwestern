import { createTRPCRouter } from "~/server/api/trpc";

// Sponsor portal coffee chat setup (track A of the 8-hour build): Your team,
// chatting preferences, the shortlist and "Your chats". Public procedures
// keyed by the sponsor's portal UUID. Registered early so tracks don't both
// edit root.ts.
export const coffeeChatSetupRouter = createTRPCRouter({});

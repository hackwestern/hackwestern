import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { applicationRouter } from "./routers/application";
import { authRouter } from "./routers/auth";
import { judgingRouter } from "./routers/judging";
import { checkInRouter } from "./routers/check-in";
import { clockRouter } from "./routers/clock";
import { cheatCheckRouter } from "./routers/cheat-check";
import { preregistrationRouter } from "./routers/preregistration";
import { scavengerHuntRouter } from "./routers/scavenger-hunt";
import { reviewRouter } from "./routers/review";
import { qrRouter } from "./routers/qr-code-generation";
import { teamsRouter } from "./routers/teams";
import { teamFinderRouter } from "./routers/team-finder";
import { broadcastRouter } from "./routers/broadcast";
import { sponsorJudgingRouter } from "./routers/sponsor-judging";
import { sponsorDashboardRouter } from "./routers/sponsor-dashboard";
import { sponsorPortalRouter } from "./routers/sponsor-portal";
import { sponsorScheduleRouter } from "./routers/sponsor-schedule";
import { sponsorHelpRouter } from "./routers/sponsor-help";
import { sponsorOrganizerRouter } from "./routers/sponsor-organizer";
import { coffeeChatRequestsRouter } from "./routers/coffee-chat-requests";
import { coffeeChatSessionsRouter } from "./routers/coffee-chat-sessions";
import { coffeeChatSetupRouter } from "./routers/coffee-chat-setup";
import { coffeeChatInvitesRouter } from "./routers/coffee-chat-invites";
import { sponsorInterestRouter } from "./routers/sponsor-interest";
import { sponsorShortlistRouter } from "./routers/sponsor-shortlist";
import { sponsorPresentationsRouter } from "./routers/sponsor-presentations";
import { sponsorScoringRouter } from "./routers/sponsor-scoring";
import { onboardingRouter } from "./routers/onboarding";
import { taskRemindersRouter } from "./routers/task-reminders";
import { notificationsRouter } from "./routers/notifications";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  application: applicationRouter,
  auth: authRouter,
  judging: judgingRouter,
  checkIn: checkInRouter,
  clock: clockRouter,
  cheatCheck: cheatCheckRouter,
  preregistration: preregistrationRouter,
  review: reviewRouter,
  qrRouter: qrRouter,
  scavengerHunt: scavengerHuntRouter,
  teams: teamsRouter,
  teamFinder: teamFinderRouter,
  broadcast: broadcastRouter,
  sponsorJudging: sponsorJudgingRouter,
  sponsorDashboard: sponsorDashboardRouter,
  sponsorPortal: sponsorPortalRouter,
  sponsorSchedule: sponsorScheduleRouter,
  sponsorHelp: sponsorHelpRouter,
  sponsorOrganizer: sponsorOrganizerRouter,
  coffeeChatRequests: coffeeChatRequestsRouter,
  coffeeChatSessions: coffeeChatSessionsRouter,
  coffeeChatSetup: coffeeChatSetupRouter,
  coffeeChatInvites: coffeeChatInvitesRouter,
  sponsorInterest: sponsorInterestRouter,
  sponsorShortlist: sponsorShortlistRouter,
  sponsorPresentations: sponsorPresentationsRouter,
  sponsorScoring: sponsorScoringRouter,
  onboarding: onboardingRouter,
  taskReminders: taskRemindersRouter,
  notifications: notificationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);

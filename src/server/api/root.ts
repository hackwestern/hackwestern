import { exampleRouter } from "~/server/api/routers/example";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { applicationRouter } from "./routers/application";
import { authRouter } from "./routers/auth";
import { preregistrationRouter } from "./routers/preregistration";
import { scavengerHuntRouter } from "./routers/scavenger-hunt";
import { reviewRouter } from "./routers/review";
import { qrRouter } from "./routers/qr-code-generation";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  example: exampleRouter,
  application: applicationRouter,
  auth: authRouter,
  preregistration: preregistrationRouter,
  review: reviewRouter,
  qrRouter: qrRouter,
  scavengerHunt: scavengerHuntRouter,
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

// import Head from "next/head";
// import { useSearchParams } from "next/navigation";
// import React from "react";
// import { motion, useAnimation } from "framer-motion";
// import { type ApplyStepFull, applySteps } from "~/constants/apply";
// import { ApplyMenu } from "~/components/apply/menu";
// import { colors } from "~/constants/avatar";
// import { api } from "~/utils/api";
// import { notVerifiedRedirectDashboard } from "~/utils/redirect";
// import CharacterIcon from "~/components/dashboard/CharacterIcon";
// import SubmittedDisplay from "~/components/dashboard/SubmittedDisplay";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Realm } from "~/constants/realms";
import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { HorseGame } from "~/components/dashboard/horse-game";
import { Confetti } from "~/components/dashboard/confetti";
import { FilmStrip } from "~/components/promo/film-strip";
import { disabledRedirect } from "~/utils/redirect";
import { isPastDeadline } from "~/lib/date";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

// function getApplyStep(stepValue: string | null): ApplyStepFull | null {
//   return applySteps.find((s) => s.step === stepValue) ?? null;
// }

// const Dashboard = () => {
//   const { data: application } = api.application.get.useQuery({
//     fields: [
//       "firstName",
//       "lastName",
//       "avatarColour",
//       "avatarFace",
//       "avatarLeftHand",
//       "avatarRightHand",
//       "avatarHat",
//       "school",
//       "major",
//       "attendedBefore",
//       "numOfHackathons",
//       "githubLink",
//       "linkedInLink",
//       "otherLink",
//       "resumeLink",
//       "canvasData",
//     ],
//   });

//   const selectedColor = colors.find(
//     (c) => c.name === (application?.avatarColour ?? "green"),
//   );

//   type CanvasData = {
//     paths: CanvasPaths;
//     timestamp: number;
//     version: string;
//   };

//   const canvasData = application?.canvasData as CanvasData | null | undefined;
//   const pathStrings =
//     canvasData?.paths?.map((path) =>
//       path.reduce((acc, point, index) => {
//         if (index === 0) return `M ${point[0]} ${point[1]}`;
//         return `${acc} L ${point[0]} ${point[1]}`;
//       }, ""),
//     ) ?? [];

//   const searchParams = useSearchParams();
//   const applyStep = React.useMemo(
//     () => getApplyStep(searchParams.get("step")),
//     [searchParams],
//   );

//   const step = applyStep?.step ?? null;

//   // server-side redirect handles navigation to /apply for incomplete apps
//   // keep animation controls
//   const controls = useAnimation();

//   // entrance animation on mount
//   React.useEffect(() => {
//     void controls.start({ opacity: 1, transition: { duration: 0.5 } });
//   }, [controls]);

//   // no client-side loading overlay; navigation is server-side

//   return (
//     <>
//       <Head>
//         <title>Hack Western</title>
//         <meta
//           name="description"
//           content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
//         />
//         <link rel="icon" href="/favicon.ico" />
//       </Head>
//       <motion.main
//         className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-y-hidden"
//         key={"dashboard-page"}
//         initial={{ opacity: 0 }}
//         animate={controls}
//         exit={{ opacity: 0 }}
//       >
//         {/* Mobile View */}
//         <div className="relative z-10 flex h-screen w-screen flex-col md:hidden">
//           {/* Mobile Header */}
//           <div className="fixed z-[99] flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
//             <div className="h-8 w-8" />
//             <h1 className="font-secondary text-sm font-semibold text-heavy">
//               Home
//             </h1>
//             <div className="flex h-8 w-8 items-center justify-center">
//               <ApplyMenu step={step} />
//               <CharacterIcon />
//             </div>
//           </div>

//           {/* Mobile Content */}
//           <div className="flex h-svh flex-col">
//             <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
//               <SubmittedDisplay
//                 application={application}
//                 pathStrings={pathStrings}
//                 selectedColor={selectedColor}
//               />
//             </div>
//           </div>
//         </div>
//         {/* End of Mobile View */}

//         {/* Desktop View */}
//         {
//           <div className="hidden h-svh w-svw flex-grow flex-col md:flex">
//             <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
//               <div className="absolute right-6 top-6 z-[100] flex items-center gap-4">
//                 <CharacterIcon />
//               </div>
//               <SubmittedDisplay
//                 application={application}
//                 pathStrings={pathStrings}
//                 selectedColor={selectedColor}
//               />
//             </div>
//           </div>
//         }
//         {/* End of Desktop View */}
//       </motion.main>
//     </>
//   );
// };

// export default Dashboard;

// Game window height (title bar + play area) and the room kept clear for the
// film reels above and below it.
const GAME_WINDOW_HEIGHT = 643;
const REEL_CLEARANCE = 120;

/**
 * Shrinks the game window on short screens so the page never has to scroll.
 * The game only reads keys and clicks, never pointer positions, so scaling it
 * doesn't affect play.
 */
function useGameScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(
        Math.min(1, (window.innerHeight - REEL_CLEARANCE) / GAME_WINDOW_HEIGHT),
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

type DashboardProps = {
  /** Realm picked in the application; picks the background (Figma 263:2105). */
  realm: Realm | null;
  /** Application accepted: swaps in the invitation text (Figma 221:16802). */
  accepted: boolean;
  /**
   * Arrived via the acceptance email's link (/dashboard?celebrate=1), so the
   * confetti plays. Any other way in skips it.
   */
  celebrate: boolean;
};

/**
 * Submitted dashboard (Figma 221:15930 / 221:17193): a thank-you note beside
 * the horse runner game. Only applicants with a submitted application reach
 * it; everyone else is redirected in getServerSideProps. Once accepted it
 * shows the invitation instead (Figma 221:16802), with confetti when opened
 * from the acceptance email.
 */
const Dashboard = ({ realm, accepted, celebrate }: DashboardProps) => {
  const gameScale = useGameScale();
  const router = useRouter();

  // Drop ?celebrate from the URL once the confetti has started, so a refresh
  // or a copied link doesn't replay it.
  useEffect(() => {
    if (router.query.celebrate === undefined) return;
    const { celebrate: _celebrate, ...query } = router.query;
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  }, [router]);

  return (
    <>
      <SEO
        title="Dashboard"
        description="Your Hack Western 13 application status."
        noindex
      />
      {celebrate && <Confetti />}
      <div className="relative h-screen w-full overflow-hidden font-figtree">
        {/* next/image resizes the realm photos — some are 4K source files */}
        <Image
          src={`/dashboard/realm/${realm ?? "safari"}.png`}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />

        {/* Film reel strips along the top and bottom edges */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20">
          <FilmStrip />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <FilmStrip />
        </div>

        <img
          src="/shared/horse.svg"
          alt="Hack Western"
          width={40}
          height={60}
          className="absolute left-[52px] top-[70px] z-10"
        />

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-16 px-6 py-[60px] lg:flex-row lg:gap-12 xl:gap-[115px]">
          <div className="flex w-full max-w-[470px] flex-col gap-[62px]">
            <div className="flex -translate-y-[2px] flex-col gap-6 text-[#d7e2ef]">
              <h1 className="font-cossetteTexte text-[36px] font-bold leading-[1.2]">
                {accepted
                  ? "Congratulations, you’re invited to Hack Western 13!"
                  : "Your application has been submitted"}
              </h1>
              <p className="font-figtree text-base leading-none">
                {/* TODO: link "here" to the RSVP page once it exists. */}
                {accepted
                  ? "RSVP here to confirm your attendance"
                  : "Thank you for applying to Hack Western 13! A copy of your responses have been sent to your email."}
              </p>
            </div>
            <div>
              <Button
                variant="primary"
                asChild
                className="font-figtree font-medium"
              >
                <Link href="/">
                  <img
                    src="/shared/arrow-left.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="mr-[10px]"
                  />
                  Return home
                </Link>
              </Button>
            </div>
          </div>

          {/* The game needs its full 634px, so it's desktop-only like the rest of the portal redesign */}
          <div
            className="hidden shrink-0 lg:block"
            style={{ transform: `scale(${gameScale})` }}
          >
            <HorseGame />
          </div>
        </div>
      </div>
    </>
  );
};
export default Dashboard;

// Statuses that mean the application is in and waiting on a decision.
const SUBMITTED_STATUSES = ["PENDING_REVIEW", "IN_REVIEW"];

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  // On dev/preview, organizers land here via login's default callbackUrl;
  // send them to the internal dashboard instead of the (disabled) hacker
  // dashboard.
  if (process.env.VERCEL_ENV !== "production") {
    const session = await getServerSession(
      context.req,
      context.res,
      authOptions,
    );
    // The email's confetti link only works once signed in, so carry it
    // through login instead of losing it on the way via /apply.
    if (!session && context.query.celebrate !== undefined) {
      return {
        redirect: {
          destination: `/login?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
          permanent: false,
        },
      };
    }
    if (session) {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
      });
      if (user?.type === "organizer") {
        return {
          redirect: { destination: "/internal/dashboard", permanent: false },
        };
      }

      // The submitted dashboard is still being built, so like other disabled
      // pages it only renders off production for now.
      const application = await db.query.applications.findFirst({
        where: (applications, { eq }) =>
          eq(applications.userId, session.user.id),
        columns: { status: true, realm: true },
      });
      if (application && SUBMITTED_STATUSES.includes(application.status)) {
        return {
          props: {
            realm: application.realm,
            accepted: false,
            celebrate: false,
          },
        };
      }
      if (application?.status === "ACCEPTED") {
        return {
          props: {
            realm: application.realm,
            accepted: true,
            celebrate: context.query.celebrate === "1",
          },
        };
      }
    }
  }

  // Until the deadline, /apply (no step) is the hacker's home: it shows their
  // status and a start/continue/review button. /apply sends people back here
  // once the deadline passes, so only redirect before it to avoid a loop.
  if (!isPastDeadline()) {
    return { redirect: { destination: "/apply", permanent: false } };
  }

  // After the deadline, keep the existing disabled-page behavior.
  return disabledRedirect();
};

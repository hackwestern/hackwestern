import Head from "next/head";
// removed unused useRouter import
import { useSearchParams, useRouter } from "next/navigation";
import React from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { colors } from "~/constants/avatar";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { notVerifiedRedirectDashboard } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";
import { APPLICATION_DEADLINE_ISO } from "~/lib/date";
import dynamic from "next/dynamic";
import CharacterIcon from "~/components/dashboard/CharacterIcon";
import ApplicationPrompt from "~/components/dashboard/ApplicationPrompt";
import SubmittedDisplay from "~/components/dashboard/SubmittedDisplay";
import { type CanvasPaths } from "~/types/canvas";

const CountdownTimer = dynamic(
  () => import("~/components/apply/countdown-timer"),
  {
    ssr: false,
  },
);

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  return applySteps.find((s) => s.step === stepValue) ?? null;
}

function getNextIncompleteStep(
  application: Record<string, unknown> | null | undefined,
) {
  // application may be null/unset — start at first step
  if (!application) return applySteps[0].step;

  const isEmpty = (v: unknown) =>
    v === null || v === undefined || (typeof v === "string" && v.trim() === "");

  for (const step of applySteps) {
    if (step.step === "review") continue; // review is final

    switch (step.step) {
      case "character": {
        if (
          isEmpty(application.avatarColour) ||
          isEmpty(application.avatarFace) ||
          isEmpty(application.avatarLeftHand) ||
          isEmpty(application.avatarRightHand) ||
          isEmpty(application.avatarHat)
        )
          return step.step;
        break;
      }
      case "basics": {
        if (
          isEmpty(application.firstName) ||
          isEmpty(application.lastName) ||
          isEmpty(application.phoneNumber) ||
          isEmpty(application.age) ||
          isEmpty(application.countryOfResidence)
        )
          return step.step;
        break;
      }
      case "info": {
        if (
          isEmpty(application.school) ||
          isEmpty(application.levelOfStudy) ||
          isEmpty(application.major) ||
          isEmpty(application.attendedBefore) ||
          isEmpty(application.numOfHackathons)
        )
          return step.step;
        break;
      }
      case "application": {
        if (
          isEmpty(application.question1) ||
          isEmpty(application.question2) ||
          isEmpty(application.question3)
        )
          return step.step;
        break;
      }
      case "links": {
        // require at least resumeLink (submission schema expects a resume)
        if (isEmpty(application.resumeLink)) return step.step;
        break;
      }
      case "agreements": {
        if (
          application.agreeCodeOfConduct !== true ||
          application.agreeShareWithMLH !== true ||
          application.agreeShareWithSponsors !== true ||
          application.agreeWillBe18 !== true
        )
          return step.step;
        break;
      }
      // optional/canvas are truly optional; skip their checks
      default:
        break;
    }
  }

  // nothing incomplete — go to review
  return "review";
}

// Small character component for mobile header
// CharacterIcon pulled out to components/dashboard/CharacterIcon.tsx

const Dashboard = () => {
  const { data: application } = api.application.get.useQuery();
  const status = application?.status ?? "NOT_STARTED";
  // router not used in this component

  const selectedColor = colors.find(
    (c) => c.name === (application?.avatarColour ?? "green"),
  );

  type CanvasData = {
    paths: CanvasPaths;
    timestamp: number;
    version: string;
  };

  const canvasData = application?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point[0]} ${point[1]}`;
        return `${acc} L ${point[0]} ${point[1]}`;
      }, ""),
    ) ?? [];

  const searchParams = useSearchParams();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step")),
    [searchParams],
  );

  const step = applyStep?.step ?? null;

  const continueStep = getNextIncompleteStep(application);
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const controls = useAnimation();
  const [dots, setDots] = React.useState("..");

  // entrance animation on mount
  React.useEffect(() => {
    void controls.start({ opacity: 1, transition: { duration: 0.5 } });
  }, [controls]);

  // helper to start exit animation and navigate to the apply page
  const handleApplyNavigate = (step: string) => {
    setPending(true);
    // kick off exit animation (don't await)
    void controls.start({ opacity: 0, transition: { duration: 0.5 } });
    // navigate immediately
    void router.push(`/apply?step=${step}`);
  };

  // animate loading dots while pending
  React.useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : "."));
    }, 500);
    return () => clearInterval(id);
  }, [pending]);

  return (
    <>
      <Head>
        <title>Hack Western</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <motion.main
        className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-y-hidden"
        key={"dashboard-page"}
        initial={{ opacity: 0 }}
        animate={controls}
        exit={{ opacity: 0 }}
      >
        {/* Mobile View */}
        <div className="relative z-10 flex h-screen w-screen flex-col md:hidden">
          {/* Mobile Header */}
          <div className="fixed z-[99] flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
            <div className="h-8 w-8" />
            <h1 className="font-figtree text-sm font-semibold text-heavy">
              Home
            </h1>
            <div className="flex h-8 w-8 items-center justify-center">
              <ApplyMenu step={step} />
              <CharacterIcon />
            </div>
          </div>

          {/* Mobile Content */}
          {status == "NOT_STARTED" || status == "IN_PROGRESS" ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center bg-white px-6 py-20">
              <ApplicationPrompt
                status={status}
                continueStep={continueStep}
                onApplyNavigate={handleApplyNavigate}
                pending={pending}
              />
              <CanvasBackground />
            </div>
          ) : (
            <div className="flex h-svh flex-col">
              <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
                <CanvasBackground />
                <SubmittedDisplay
                  application={application}
                  pathStrings={pathStrings}
                  selectedColor={selectedColor}
                />
              </div>
            </div>
          )}
        </div>
        {/* End of Mobile View */}

        {/* Desktop View */}
        {status == "NOT_STARTED" || status == "IN_PROGRESS" ? (
          <>
            <div className="relative z-10 hidden h-full w-full flex-grow items-center md:flex">
              <div
                id="left-panel"
                className="z-30 flex h-full items-center justify-center"
              >
                <ApplyMenu step={step} />
              </div>
              <div
                id="right-panel"
                className="bg-hw-linear-gradient-day flex h-full w-full flex-col items-center justify-center px-4"
              >
                <CanvasBackground />
                <div className="absolute right-6 top-6 z-[100] flex items-center gap-4">
                  <CharacterIcon />
                </div>
                <div className="z-10 flex flex-col items-center justify-center overflow-auto">
                  <div className="flex h-full w-full flex-col items-center">
                    <div className="space-y-12">
                      <div>
                        <h1 className="flex flex-col items-center font-dico text-6xl font-medium text-heavy">
                          Hack Western 12
                        </h1>
                        <h1 className=" flex flex-col items-center font-dico text-6xl font-medium text-heavy">
                          Application
                        </h1>
                      </div>
                      <h2 className="flex flex-col items-center">
                        <CountdownTimer targetDate={APPLICATION_DEADLINE_ISO} />
                      </h2>
                      <div className="flex flex-col items-center">
                        <Button
                          variant="primary"
                          className="w-full p-6 font-figtree text-base font-medium"
                          onClick={() => void handleApplyNavigate(continueStep)}
                          disabled={pending}
                          aria-busy={pending}
                        >
                          {status == "NOT_STARTED"
                            ? "Start Application"
                            : status == "IN_PROGRESS"
                              ? "Continue Application"
                              : "Review Application"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden h-svh w-svw flex-grow flex-col md:flex">
            <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
              <div className="absolute right-6 top-6 z-[100] flex items-center gap-4">
                <CharacterIcon />
              </div>
              <CanvasBackground />
              <SubmittedDisplay
                application={application}
                pathStrings={pathStrings}
                selectedColor={selectedColor}
              />
            </div>
          </div>
        )}
        {/* End of Desktop View */}
      </motion.main>
      {/* Loading overlay during transition */}
      <AnimatePresence>
        {pending && (
          <motion.div
            key="dashboard-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-white"
          >
            <div className="font-jetbrains-mono text-base font-semibold text-[#543C5AB2]">
              LOADING APPLICATION{dots}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Dashboard;
export const getServerSideProps = notVerifiedRedirectDashboard;

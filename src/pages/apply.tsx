import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyForm } from "~/components/apply/form";
import { notVerifiedRedirect } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";
import { ApplyNavigation } from "~/components/apply/navigation";
import ApplyHeading from "~/components/apply/heading";
import {
  LeftStampColumn,
  RightStampColumn,
} from "~/components/apply/animated-stamps";
import { motion } from "framer-motion";
import { MobileStickerDrawer } from "~/components/apply/mobile-sticker-drawer";
import CharacterIcon from "~/components/dashboard/CharacterIcon";

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  const steps = applySteps;
  return steps.find((s) => s.step === stepValue) ?? null;
}

export default function Apply() {
  const searchParams = useSearchParams();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step")),
    [searchParams],
  );

  const step = applyStep?.step ?? null;
  const heading = applyStep?.heading ?? null;
  const subheading = applyStep?.subheading ?? null;
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
        className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-x-hidden md:overflow-y-hidden"
        key={"apply-page"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Mobile View */}
        <div className="relative z-10 flex h-screen w-screen flex-col md:hidden">
          {/* Mobile Header */}
          <div className="fixed z-[99] flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
            <div className="h-8 w-8"></div>
            <h1 className="font-figtree text-lg font-semibold text-heavy">
              {step
                ? step.charAt(0).toUpperCase() + step.slice(1)
                : "Application"}
            </h1>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <ApplyMenu step={step} />
              <CharacterIcon />
            </div>
          </div>

          {/* Mobile Content */}
          <div className="flex-1 bg-white py-24">
            <div className="mx-6 flex h-full flex-col">
              <div className="mb-6">
                <ApplyHeading
                  heading={heading}
                  subheading={subheading}
                  stepKey={step}
                />
              </div>

              <div className="flex-1 overflow-visible">
                <div className="font-figtree">
                  <ApplyForm step={step} />
                </div>
              </div>
            </div>
          </div>

          <MobileStickerDrawer />

          {/* Mobile Navigation - Fixed at Bottom */}
          <div className="fixed bottom-0 z-[9999] border-t border-gray-200 bg-white py-4">
            <ApplyNavigation step={step} />
          </div>
        </div>
        {/* End of Mobile View */}

        {/* Desktop View */}
        <div className="relative z-10 hidden h-full w-full flex-grow items-center overflow-x-hidden md:flex">
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
            <div className="absolute right-6 top-6 flex items-center gap-4">
              <CharacterIcon />
            </div>
            <div className="overflow-y-none overflow-x-none z-10 flex flex-col items-center justify-center">
              <div className="flex h-full w-full items-start justify-center gap-8 overflow-hidden 2xl:flex-row">
                {/* Left stamps column (up to 3) */}
                <LeftStampColumn />

                {/* Main card */}
                <div>
                  <div className="h-lg flex w-md flex-col justify-start space-y-8 rounded-md bg-white px-8 py-8 shadow-lg sm:w-lg md:px-12 md:py-12 lg:w-3xl 2xl:h-[65vh] 2xl:w-4xl 3xl:h-[60vh] 3xl:w-6xl 4xl:w-7xl">
                    <div className="space-y-4 py-1.5">
                      <ApplyHeading
                        heading={heading}
                        subheading={subheading}
                        stepKey={step}
                      />
                    </div>
                    <div className="scrollbar overflow-auto rounded-md pb-2 pl-1 pr-4">
                      <div className="font-figtree">
                        <ApplyForm step={step} />
                      </div>
                    </div>
                  </div>
                  <ApplyNavigation step={step} />
                </div>

                {/* Right stamps column (up to 3) */}
                <RightStampColumn />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
        {/* End of Desktop View */}
      </motion.main>
    </>
  );
}

export const getServerSideProps = notVerifiedRedirect;

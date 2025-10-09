import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import {
  type ApplyStepFull,
  applySteps,
  mobileApplySteps,
} from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyForm } from "~/components/apply/form";
import { notVerifiedRedirect } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";
import { ApplyNavigation } from "~/components/apply/navigation";
import { StampContainer } from "~/components/apply/stamp";
import { useIsMobile } from "~/hooks/use-mobile";
import { api } from "~/utils/api";
import { colors } from "~/constants/avatar";
import Logout from "~/pages/logout";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import Link from "next/link";
import { signOut } from "next-auth/react";

function getApplyStep(
  stepValue: string | null,
  isMobile: boolean,
): ApplyStepFull | null {
  const steps = isMobile ? mobileApplySteps : applySteps;
  return steps.find((s) => s.step === stepValue) ?? null;
}

// Small character component for mobile header
function MobileCharacterIcon() {
  const { data: applicationData } = api.application.get.useQuery();
  const name = applicationData?.firstName ?? "Username";

  const bodyColor =
    colors.find((c) => c.name === applicationData?.avatarColour)?.body ?? "002";

  // Popover trigger wraps the avatar (or emoji) to open the small menu
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-6 w-6 overflow-hidden rounded-full">
          {/* eslint-disable @next/next/no-img-element */}
          {applicationData?.avatarColour ? (
            <img
              src={`/avatar/body/${bodyColor}.webp`}
              alt="Character"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-sm">🎨</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="mr-4 mt-2 w-48 bg-offwhite p-4 font-figtree">
        <div className="rounded-md">
          <h3 className="mb-3 text-lg font-medium text-medium">Hi, {name}!</h3>
          <div className="mb-4 h-px w-full bg-violet-200" />

          <div className="mb-3 font-figtree text-heavy">
            <Link href="/dashboard">Home</Link>
          </div>

          <div>
            <button
              className="font-figtree text-base text-heavy underline"
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Apply() {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step"), isMobile),
    [searchParams, isMobile],
  );

  const { data } = api.application.get.useQuery();
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
      <main className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-y-hidden">
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
              <MobileCharacterIcon />
            </div>
          </div>

          {/* Mobile Content */}
          <div className="flex-1 bg-white py-24">
            <div className="mx-6 flex h-full flex-col">
              <div className="mb-6">
                <h1 className="mb-2 font-dico text-2xl font-medium text-heavy">
                  {heading}
                </h1>
                {subheading && (
                  <h2 className="font-figtree text-sm text-medium">
                    {subheading}
                  </h2>
                )}
              </div>

              <div className="flex-1 overflow-visible">
                <div className="font-figtree">
                  <ApplyForm step={step} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation - Fixed at Bottom */}
          <div className="fixed bottom-0 z-[9999] border-t border-gray-200 bg-white py-4">
            <ApplyNavigation step={step} />
          </div>
        </div>
        {/* End of Mobile View */}

        {/* Desktop View */}
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
            <div className="absolute right-7 top-7">
              <Logout />
            </div>
            <div className="overflow-y-none z-10 flex flex-col items-center justify-center overflow-auto">
              <div className="h-full w-full space-y-4">
                <div className="flex h-lg w-md flex-col justify-start space-y-8 rounded-md bg-white px-8 py-8 shadow-lg sm:w-lg md:px-12 md:py-12 lg:w-3xl 2xl:h-[65vh] 2xl:w-4xl 3xl:h-[60vh] 3xl:w-6xl 4xl:w-7xl">
                  <div className="space-y-4 py-1.5">
                    <h1 className="font-dico text-2xl font-medium text-heavy">
                      {heading}
                    </h1>
                    {subheading && (
                      <h2 className="font-figtree text-sm text-medium">
                        {subheading}
                      </h2>
                    )}
                  </div>
                  <div className="scrollbar overflow-auto pb-2 pl-1 pr-4">
                    <div className="font-figtree">
                      <ApplyForm step={step} />
                    </div>
                  </div>
                </div>
                <ApplyNavigation step={step} />
              </div>

              <div className="z-10 flex w-[100%] flex-col items-center justify-center"></div>
            </div>
          </div>
        </div>

        <StampContainer step={step} data={data} />

        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
        {/* End of Desktop View */}
      </main>
    </>
  );
}

export const getServerSideProps = notVerifiedRedirect;

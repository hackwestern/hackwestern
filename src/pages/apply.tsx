/* eslint-disable @next/next/no-img-element */
import React from "react";
import SEO from "~/components/seo";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyForm } from "~/components/apply/form";
import { notVerifiedRedirect } from "~/utils/redirect";
import { api } from "~/utils/api";
import ApplicationPrompt from "~/components/dashboard/ApplicationPrompt";
import { ApplyNavigation } from "~/components/apply/navigation";
import ApplyHeading from "~/components/apply/heading";
import { motion, AnimatePresence } from "framer-motion";
import { MobileStickerDrawer } from "~/components/apply/mobile-sticker-drawer";
import CharacterIcon from "~/components/dashboard/CharacterIcon";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import { ApplicationSidebar } from "~/components/apply/application-sidebar";
import { Window } from "~/components/internals/window";
import { UserBadge } from "~/components/apply/user-badge";
import { realmTint } from "~/constants/realms";
import { cn } from "~/lib/utils";

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  const steps = applySteps;
  return steps.find((s) => s.step === stepValue) ?? null;
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
      case "realm": {
        if (
          isEmpty(application.realm) ||
          isEmpty(application.horseId) ||
          isEmpty(application.horseFirstName) ||
          isEmpty(application.horseLastName)
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
          isEmpty(application.yearOfStudy) ||
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
      default:
        break;
    }
  }

  return "review";
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
  const { data: application } = api.application.get.useQuery({
    fields: ["status"],
  });
  const { data: userInfo } = api.application.get.useQuery({
    fields: ["firstName", "updatedAt", "realm"],
  });
  const realm = userInfo?.realm ?? null;
  const tint = realm ? realmTint[realm] : null;
  const continueStep = getNextIncompleteStep(application);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Grow-out-of-folder animation, armed only when leaving the start
  // screen (no step). Step-to-step moves and direct reloads on a step
  // never animate.
  const [growWindow, setGrowWindow] = useState(false);

  const sidebarSteps = useMemo(
    () => applySteps.map((s) => ({ key: s.step, label: s.label })),
    [],
  );

  // Mirror the realm tint onto document.documentElement so portaled
  // elements (Radix Select content, dropdown menus, etc.) can read the
  // same CSS vars even though they mount outside .apply-form-tint.
  React.useEffect(() => {
    const root = document.documentElement;
    if (tint) {
      root.style.setProperty("--form-tint-bg", tint.sidebarBg);
      root.style.setProperty("--form-tint-border", tint.sidebarBorder);
      root.style.setProperty("--form-tint-text", tint.accent);
      root.style.setProperty("--form-tint-text-muted", tint.accentMuted);
      root.setAttribute("data-apply-tint", "on");
    } else {
      root.removeAttribute("data-apply-tint");
    }
    return () => {
      root.removeAttribute("data-apply-tint");
    };
  }, [tint]);

  const handleApplyNavigate = (stepKey: string) => {
    if (step === null) setGrowWindow(true);
    setPending(true);
    void router.push(`/apply?step=${stepKey}`).then(() => setPending(false));
  };

  return (
    <>
      <SEO
        title="Apply"
        description="Apply to Hack Western, one of Canada's largest student-run hackathons. Build projects, learn new skills, and connect with 500+ students at Western University."
        noindex
      />
      <motion.main
        className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 font-figtree md:overflow-x-hidden md:overflow-y-hidden"
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
            <div className="bg-green-100 flex h-8 w-8 items-center justify-center rounded-full">
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

              {step ? (
                <div className="flex-1 overflow-visible font-figtree">
                  <ApplyForm step={step} />
                </div>
              ) : (
                <>
                  <ApplicationPrompt
                    continueStep={continueStep}
                    onApplyNavigate={handleApplyNavigate}
                    pending={pending}
                  />
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation - Fixed at Bottom */}
          {step && (
            <div className="fixed bottom-0 z-[9999] border-t border-gray-200 bg-white py-4">
              <ApplyNavigation step={step} />
            </div>
          )}
        </div>
        {/* End of Mobile View */}

        <MobileStickerDrawer />

        {/* Desktop View — redesigned portal shell */}
        <div className="relative z-10 hidden h-screen w-full overflow-hidden md:flex">
          <AnimatePresence mode="sync" initial={false}>
            <motion.img
              key={tint?.background ?? "/apply/realm/background.png"}
              src={tint?.background ?? "/apply/realm/background.png"}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
          </AnimatePresence>

          <div className="relative z-10 flex h-full w-full gap-6 p-9">
            <ApplicationSidebar
              steps={sidebarSteps}
              activeStep={step}
              lastSavedAt={userInfo?.updatedAt ?? null}
              onStepClick={handleApplyNavigate}
              realm={realm}
            />

            <div className="relative flex flex-1 flex-col">
              <div className="absolute right-0 top-0 z-10">
                <UserBadge
                  firstName={userInfo?.firstName ?? "there"}
                  onSignOut={() => void signOut({ callbackUrl: "/" })}
                />
              </div>

              <div className="relative flex flex-1 pt-16">
                <AnimatePresence mode="wait">
                  {!step ? (
                    <motion.div
                      key="portal-start"
                      className="-mt-8 w-full max-w-[600px] self-start px-8 md:px-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                    >
                      <ApplicationPrompt
                        continueStep={continueStep}
                        onApplyNavigate={handleApplyNavigate}
                        pending={pending}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="portal-window"
                      className="m-auto flex h-full max-h-[calc(100vh-9rem)] w-full max-w-[900px] flex-col gap-4"
                      style={{ transformOrigin: "bottom right" }}
                      initial={
                        growWindow
                          ? { scale: 0.25, opacity: 0, x: 280, y: 220 }
                          : false
                      }
                      animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                      exit={{ scale: 0.25, opacity: 0, x: 280, y: 220 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 26,
                      }}
                      onAnimationComplete={() => {
                        setGrowWindow(false);
                      }}
                    >
                      <Window
                        fluid
                        draggable={false}
                        disableControls
                        title="Hack Western 13: Discover the Unknown"
                        className="min-h-0 flex-1"
                        contentClassName="px-8 py-8 md:px-12 md:py-10"
                        footer={<ApplyNavigation step={step} />}
                      >
                        <div className="space-y-6">
                          <ApplyHeading
                            heading={heading}
                            subheading={subheading}
                            stepKey={step}
                          />
                          <div className="scrollbar font-figtree">
                            <ApplyForm step={step} />
                          </div>
                        </div>
                      </Window>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!step && (
                <div className="absolute bottom-8 right-8 z-10 flex flex-col items-center gap-1.5">
                  <img
                    src="/landing/home/folder.png"
                    alt="HW13 Applications folder"
                    className="h-auto w-[64px]"
                    style={{ imageRendering: "pixelated" }}
                    draggable={false}
                  />
                  <p className="font-figtree text-xs font-medium text-white">
                    HW13_Applications
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* End of Desktop View */}
      </motion.main>
    </>
  );
}

export const getServerSideProps = notVerifiedRedirect;

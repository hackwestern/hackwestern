import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { notVerifiedRedirect } from "~/utils/redirect";
import { api } from "~/utils/api";
import ApplicationPrompt from "~/components/dashboard/ApplicationPrompt";
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
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { SavedIndicator } from "~/components/apply/saved-indicator";

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
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const [desktopPreviewHeight, setDesktopPreviewHeight] = useState<
    number | null
  >(null);
  const { data: application } = api.application.get.useQuery({
    fields: ["status"],
  });
  const continueStep = getNextIncompleteStep(application);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleApplyNavigate = (stepKey: string) => {
    setPending(true);
    void router
      .push(`/jessica-portfolio-apply?step=${stepKey}`)
      .then(() => setPending(false));
  };

  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const update = () => setDesktopPreviewHeight(el.clientHeight ?? null);
    // initial
    update();
    const ro = new ResizeObserver(() => {
      update();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyStep]);

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
              <TempApplyMenu step={step} />
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
                  <TempApplyForm step={step} />
                </div>
              ) : (
                <>
                  <ApplicationPrompt
                    status={application?.status ?? "NOT_STARTED"}
                    continueStep={continueStep}
                    onApplyNavigate={handleApplyNavigate}
                    pending={pending}
                  />
                  <CanvasBackground />
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation - Fixed at Bottom */}
          {step && (
            <div className="fixed bottom-0 z-[9999] border-t border-gray-200 bg-white py-4">
              <TempApplyNavigation step={step} />
            </div>
          )}
        </div>
        {/* End of Mobile View */}

        <MobileStickerDrawer />

        {/* Desktop View */}
        <div className="relative z-10 hidden h-full w-full flex-grow items-center overflow-x-hidden overflow-y-hidden md:flex">
          <div
            id="left-panel"
            className="z-30 flex h-full items-center justify-center"
          >
            <TempApplyMenu step={step} />
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
              {!step ? (
                <ApplicationPrompt
                  status={application?.status ?? "NOT_STARTED"}
                  continueStep={continueStep}
                  onApplyNavigate={handleApplyNavigate}
                  pending={pending}
                />
              ) : (
                <div className="flex h-full w-full items-start justify-center gap-8 overflow-hidden 2xl:flex-row">
                  {/* Left stamps column (up to 3) */}
                  <LeftStampColumn />

                  {/* Main card */}
                  <div>
                    <div className="flex h-lg w-md flex-col justify-start space-y-8 rounded-md bg-white px-8 py-8 shadow-lg sm:w-md md:px-12 md:py-12 lg:w-xl 2xl:h-[65vh] 2xl:w-3xl 3xl:h-[60vh] 3xl:w-6xl 4xl:w-7xl">
                      <div className="space-y-4 py-1.5">
                        <ApplyHeading
                          heading={heading}
                          subheading={subheading}
                          stepKey={step}
                        />
                      </div>
                      <div
                        className="scrollbar min-h-0 flex-1 overflow-auto rounded-md pb-2 pl-1 pr-4 font-figtree"
                        ref={desktopScrollRef}
                      >
                        <TempApplyForm
                          step={step}
                          previewHeight={(desktopPreviewHeight ?? 300) - 10}
                        />
                      </div>
                    </div>
                    <TempApplyNavigation step={step} />
                  </div>

                  {/* Right stamps column (up to 3) */}
                  <RightStampColumn />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
        {/* End of Desktop View */}
      </motion.main>
    </>
  );
}

import { Button } from "~/components/ui/button";
import Image from "next/image";
import { useToast } from "~/hooks/use-toast";
import { usePendingNavigation } from "~/hooks/use-pending-navigation";
import { type ApplyStep } from "~/constants/apply";
import { applicationSubmitSchema } from "~/schemas/application";

type ApplyNavigationProps = {
  step: ApplyStep | null;
};

export function getPreviousStep(stepIndex: number | null): ApplyStep | null {
  if (stepIndex === null) return null;
  return applySteps[stepIndex - 1]?.step ?? null;
}

export function getNextStep(stepIndex: number | null): ApplyStep | null {
  if (stepIndex === null) return null;
  return applySteps[stepIndex + 1]?.step ?? null;
}

export function getStepIndex(step: ApplyStep | null): number | null {
  if (!step) return null;

  const stepIndex = applySteps.findIndex((s) => s.step === step);
  if (stepIndex >= 0) {
    return stepIndex;
  }

  return null;
}

export function TempApplyNavigation({ step }: ApplyNavigationProps) {
  const stepIndex = React.useMemo(() => getStepIndex(step), [step]);
  const previousStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);
  const { toast } = useToast();

  const { data: applicationData } = api.application.get.useQuery();
  const status = applicationData?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { pending, navigate } = usePendingNavigation();

  const result = applicationSubmitSchema.safeParse(applicationData);
  const error = result.error?.format();

  const submitMutation = api.application.submit.useMutation();

  const onClickSubmit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (step !== "review") return;

    // toast the first 5 incorrect fields
    if (error) {
      const errorMessages: string[] = [];
      for (const key in error) {
        if (key === "_errors") continue;

        const currError = error[key as keyof typeof error];

        // check if currError is a valid error object
        const has_errors =
          currError && typeof currError === "object" && "_errors" in currError;
        if (!has_errors) continue;

        const fieldErrors = (currError as { _errors?: string[] })._errors;
        // keys is a string in camelCase, convert to words
        const formattedKey = key
          .replace(/([A-Z]+|[0-9]+)/g, " $1") // also separate numbers
          .trim()
          .toLowerCase()
          .replace(/^./, (str) => str.toUpperCase());
        const fieldErrorsArray = Array.isArray(fieldErrors)
          ? fieldErrors
          : [fieldErrors];
        if (fieldErrors && fieldErrors.length > 0) {
          errorMessages.push(
            `${formattedKey}: ${fieldErrorsArray[0]?.includes("received null") ? "field required" : fieldErrorsArray[0]}`,
          );
        }
        if (errorMessages.length >= 5) break;
      }

      toast({
        title: "Application Incomplete",
        description: (
          <div>
            <div>The following fields had errors</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {errorMessages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
              {Object.keys(error).length > errorMessages.length + 1 && (
                <li>And more...</li>
              )}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    submitMutation
      .mutateAsync()
      .then(() => {
        toast({
          title: "Application Submitted",
          description: "Your application was submitted successfully.",
          variant: "success",
          duration: 4000,
        });
        navigate("/dashboard");
      })
      .catch((e) => {
        toast({
          title: "Error Submitting Application",
          description: JSON.stringify(e),
          variant: "destructive",
          duration: 4000,
        });
      });
  };

  return (
    <div className="z-10 flex w-full items-center justify-between">
      {/* Mobile Layout */}
      <div className="flex w-screen items-center justify-between px-3 md:hidden">
        <div className="flex w-1/4 items-center gap-3">
          {!step || previousStep ? (
            <Button
              variant="secondary"
              className="h-10 border-gray-300 px-4 text-gray-700 hover:bg-gray-50"
              onClick={() =>
                navigate(
                  `/jessica-portfolio-apply?step=${previousStep ?? step}`,
                )
              }
              disabled={pending}
              aria-busy={pending}
            >
              <div className="flex items-center gap-2">
                <Image
                  src="/arrow-left.svg"
                  alt="Left Arrow"
                  width={12}
                  height={12}
                />
                <div className="text-sm">Back</div>
              </div>
            </Button>
          ) : (
            <div className="h-10"></div>
          )}
        </div>

        <div className="flex w-1/2 flex-1 justify-center">
          <SavedIndicator />
        </div>

        <div className="flex w-1/4 items-center">
          <Button
            variant="primary"
            className="h-10 px-6"
            onClick={() => {
              if (!step || nextStep) {
                void navigate(`/jessica-portfolio-apply?step=${nextStep}`);
              } else if (canEdit) {
                void onClickSubmit();
              } else {
                void navigate(`/dashboard`);
              }
            }}
            disabled={pending}
            aria-busy={pending}
          >
            {!step || !!nextStep ? (
              <div className="flex items-center gap-2">
                Next
                <Image
                  src="/arrow-right.svg"
                  alt="Right Arrow"
                  width={12}
                  height={12}
                />
              </div>
            ) : canEdit ? (
              <div className="block">Submit</div>
            ) : (
              <div className="block">Home</div>
            )}
          </Button>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden w-full justify-between py-3 md:flex">
        <SavedIndicator />
        <div className="ml-auto flex items-center gap-12">
          {!step ||
            (previousStep && (
              <Button
                variant="tertiary"
                className="h-6 w-16 text-base font-medium text-heavy"
                onClick={() =>
                  navigate(`/jessica-portfolio-apply?step=${previousStep}`)
                }
                disabled={pending}
                aria-busy={pending}
              >
                <div className="flex items-center gap-2 pr-2">
                  <Image
                    src="/arrow-left.svg"
                    alt="Left Arrow"
                    width={12}
                    height={12}
                  />
                  <div className="text-sm">Back</div>
                </div>
              </Button>
            ))}
          <Button
            variant="primary"
            className="w-28"
            onClick={() => {
              if (!step || nextStep) {
                void navigate(`/jessica-portfolio-apply?step=${nextStep}`);
              } else if (canEdit) {
                void onClickSubmit();
              } else {
                void navigate(`/dashboard`);
              }
            }}
            disabled={pending}
            aria-busy={pending}
          >
            {!step || !!nextStep ? (
              <div className="flex gap-2">
                Next
                <Image
                  src="/arrow-right.svg"
                  alt="Right Arrow"
                  width={10}
                  height={10}
                />
              </div>
            ) : canEdit ? (
              <div className="block">Submit</div>
            ) : (
              <div className="block">Home</div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Menu, Check, CircleDashed } from "lucide-react";
import { useMemo } from "react";
import { DialogTitle } from "@radix-ui/react-dialog";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

type StepStatus = "not_started" | "started" | "completed";

type MenuItemProps = {
  s: { step: string; label: string };
  currentStep: ApplyStep | null;
  stepStatuses: Record<ApplyStep, StepStatus>;
  className?: string;
};

function MenuItem({ s, currentStep, stepStatuses, className }: MenuItemProps) {
  const status = stepStatuses[s.step as ApplyStep];

  return (
    <Button
      variant={s.step === currentStep ? "apply-ghost" : "apply"}
      className={`${className ?? ""} flex items-center justify-between`}
      asChild
    >
      <Link
        href={{ pathname: "/jessica-portfolio-apply", query: { step: s.step } }}
      >
        <span>{s.label}</span>
        {status === "started" && <CircleDashed className="h-4 w-4" />}
        {status === "completed" && <Check className="h-4 w-4" />}
      </Link>
    </Button>
  );
}

// Helper: compute status for each step (not_started, started, or completed)
function computeStepStatuses(
  application: Record<string, unknown> | null | undefined,
): Record<ApplyStep, StepStatus> {
  // Agreement fields where false should be treated as empty
  const agreementFields = new Set([
    "agreeCodeOfConduct",
    "agreeShareWithMLH",
    "agreeShareWithSponsors",
    "agreeWillBe18",
    "agreeEmailsFromMLH",
  ]);

  const isEmpty = (v: unknown, fieldName?: string) => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    // For agreement fields, false = not agreed (empty)
    if (
      typeof v === "boolean" &&
      v === false &&
      fieldName &&
      agreementFields.has(fieldName)
    ) {
      return true;
    }
    if (typeof v === "number") return false; // numbers are considered filled
    // Special case for canvasData: check if paths array is empty
    if (typeof v === "object" && v !== null && "paths" in v) {
      const paths = (v as { paths: unknown }).paths;
      if (Array.isArray(paths) && paths.length === 0) return true;
    }
    return false;
  };

  const stepFields: Record<string, string[]> = {
    character: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
    basics: [
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
    info: [
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
    application: ["question1", "question2", "question3"],
    links: ["githubLink", "linkedInLink", "resumeLink", "otherLink"],
    agreements: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
    optional: ["underrepGroup", "gender", "ethnicity", "sexualOrientation"],
    canvas: ["canvasData"],
    review: [],
  };

  // Mandatory fields from applicationSubmitSchema
  const mandatoryFields: Record<string, string[]> = {
    character: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
    basics: [
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
    info: [
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
    application: ["question1", "question2", "question3"],
    links: ["resumeLink"],
    agreements: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
    ],
    optional: [],
    canvas: [],
    review: [],
  };

  const result = {} as Record<ApplyStep, StepStatus>;

  for (const stepObj of applySteps) {
    const stepName: ApplyStep = stepObj.step;
    const fields = stepFields[stepName] ?? [];
    const mandatory = mandatoryFields[stepName] ?? [];

    // Check how many fields are filled
    const filledCount = fields.filter(
      (f) =>
        !isEmpty((application as Record<string, unknown> | undefined)?.[f], f),
    ).length;

    // Check if all mandatory fields are filled
    const allMandatoryFilled =
      mandatory.length === 0 ||
      mandatory.every(
        (f) =>
          !isEmpty(
            (application as Record<string, unknown> | undefined)?.[f],
            f,
          ),
      );

    if (filledCount === 0) {
      result[stepName] = "not_started";
    } else if (allMandatoryFilled) {
      result[stepName] = "completed";
    } else {
      result[stepName] = "started";
    }
  }

  return result;
}

export function TempApplyMenu({ step }: ApplyMenuProps) {
  const { data: application } = api.application.get.useQuery();
  const status = application?.status ?? "NOT_STARTED";

  const stepStatuses: Record<ApplyStep, StepStatus> = useMemo(() => {
    return computeStepStatuses(application);
  }, [application]);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="mx-auto hidden h-screen w-56 gap-3 border-[1px] bg-white py-3 shadow-[5px_0px_10px_0px_rgba(129,74,83,0.1)] md:block 2xl:w-72 3xl:w-80">
        <div className="mx-4 flex flex-col gap-2">
          <div className="my-8 ml-2 flex flex-col gap-8">
            <Link href="/dashboard" className="cursor-pointer">
              <Image
                src="/horse.svg"
                alt="Hack Western Logo"
                width={40}
                height={60}
              />
            </Link>
            <div className="gap-2">
              <h1 className="font-figtree font-bold text-heavy">
                Application Portal
              </h1>
              <h2 className="font-figtree font-semibold text-medium">
                Hack Western 12
              </h2>
            </div>
          </div>
          {applySteps.map((s) => (
            <MenuItem
              key={s.step}
              s={s}
              currentStep={step}
              stepStatuses={stepStatuses}
              className="mx-auto w-48 justify-start text-left 2xl:w-64 3xl:w-72"
            />
          ))}
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <Button variant="apply" className="rounded-2xl p-2.5">
              <Menu strokeWidth={2.5} className="size-5 text-primary-600" />
            </Button>
          </DrawerTrigger>
          <DrawerContent side="left" className="max-h-screen">
            <DialogTitle aria-describedby="mobile-apply-menu">
              <div className="mx-4 my-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Link href="/dashboard">
                    <Image
                      src="/horse.svg"
                      alt="Hack Western Logo"
                      width={32}
                      height={48}
                    />
                  </Link>
                  <div>
                    <h1 className="font-figtree text-lg font-bold text-heavy">
                      Application Portal
                    </h1>
                    <h2 className="font-figtree text-sm font-semibold text-medium">
                      Hack Western 12
                    </h2>
                  </div>
                </div>
                <div className="space-y-2">
                  {applySteps.map((s) => (
                    <DrawerClose key={s.step} asChild>
                      <MenuItem
                        s={s}
                        currentStep={step}
                        stepStatuses={stepStatuses}
                        className="w-64 justify-start px-4 text-left"
                      />
                    </DrawerClose>
                  ))}
                </div>
              </div>
            </DialogTitle>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

import { AnimatePresence, type Easing } from "framer-motion";
import { useIsMobile } from "~/hooks/use-mobile";

type ApplyFormProps = {
  step: ApplyStep | null;
  previewHeight?: number | null;
};

const formFade = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.37, 0.1, 0.6, 1] as Easing },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: [0.37, 0.1, 0.6, 1] as Easing },
  },
};

export function TempApplyForm({ step, previewHeight }: ApplyFormProps) {
  const { pending } = usePendingNavigation();

  const isMobile = useIsMobile();

  // Render the active form inside AnimatePresence so when `step` changes
  // we get a brief crossfade. When `pending` is true (navigating away),
  // the current form will play its exit animation.
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step ?? "empty"}
        initial="initial"
        animate={pending ? "exit" : "animate"}
        exit="exit"
        variants={formFade}
        className="custom-scroll -ml-2 px-2"
        style={
          previewHeight
            ? {
                height: isMobile ? "full" : Math.min(previewHeight ?? 300, 600),
                overflowY: "auto",
              }
            : {}
        }
      >
        {(() => {
          switch (step) {
            case "character":
              return <TempAvatarForm previewHeight={previewHeight} />;
            case "basics":
              return <TempBasicsForm />;
            case "info":
              return <TempInfoForm />;
            case "application":
              return <TempApplicationForm />;
            case "links":
              return <TempLinksForm />;
            case "agreements":
              return <TempAgreementsForm />;
            case "optional":
              return <TempOptionalForm />;
            case "canvas":
              return <TempCanvasForm />;
            case "review":
              return <TempReviewForm />;
            default:
              return <></>;
          }
        })()}
      </motion.div>
    </AnimatePresence>
  );
}

import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form } from "~/components/ui/form";
import { useAutoSave } from "~/hooks/use-auto-save";
import { personaSaveSchema } from "~/schemas/application";
/* eslint-disable @next/next/no-img-element */
import { categories, colors, avatarManifest } from "~/constants/avatar";
import type { AvatarObject } from "~/constants/avatar";
import { AvatarDisplay } from "~/components/apply/avatar-display";

type AvatarColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

// Helper to get accessory object from ID
export const getAccessoryFromId = (
  category: "face" | "left" | "right" | "hat",
  id: number | null,
): AvatarObject | null => {
  if (!id) return null;
  const item = avatarManifest[category].find((item) => item.id === id);
  if (!item) return null;
  return {
    id: item.id,
    name: item.alt,
    src: item.file?.startsWith("/") ? item.file : `/${item.file}`,
    sizing: "sizing" in item ? item.sizing : undefined,
    sizingSm: "sizingSm" in item ? item.sizingSm : undefined,
  };
};

export const getAccessoriesForCategory = (category: string) => {
  const noneOption: AvatarObject = {
    id: 0,
    name: "None",
    src: "",
  };

  switch (category) {
    case "face":
      return [
        noneOption,
        ...avatarManifest.face.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file?.startsWith("/")
                ? AvatarEntry.file
                : `/${AvatarEntry.file}`,
            }) as AvatarObject,
        ),
      ];

    case "right":
      return [
        noneOption,
        ...avatarManifest.right.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file?.startsWith("/")
                ? AvatarEntry.file
                : `/${AvatarEntry.file}`,
            }) as AvatarObject,
        ),
      ];

    case "left":
      return [
        noneOption,
        ...avatarManifest.left.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file?.startsWith("/")
                ? AvatarEntry.file
                : `/${AvatarEntry.file}`,
            }) as AvatarObject,
        ),
      ];
    case "hat":
      return [
        noneOption,
        ...avatarManifest.hat.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file?.startsWith("/")
                ? AvatarEntry.file
                : `/${AvatarEntry.file}`,
              sizing: AvatarEntry?.sizing,
            }) as AvatarObject,
        ),
      ];

    default:
      return [];
  }
};

export function TempAvatarForm({
  previewHeight,
}: {
  previewHeight?: number | null;
}) {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: [
      "status",
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
  });
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof personaSaveSchema>>({
    resolver: zodResolver(personaSaveSchema),
  });

  const [selectedCategory, setSelectedCategory] = useState("face");

  // Watch form values for rendering
  const avatarColour = useWatch({
    control: form.control,
    name: "avatarColour",
  });
  const avatarFace = useWatch({
    control: form.control,
    name: "avatarFace",
  });
  const avatarLeftHand = useWatch({
    control: form.control,
    name: "avatarLeftHand",
  });
  const avatarRightHand = useWatch({
    control: form.control,
    name: "avatarRightHand",
  });
  const avatarHat = useWatch({
    control: form.control,
    name: "avatarHat",
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof personaSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid h-fit gap-6 md:overflow-hidden lg:grid-cols-2"
      >
        {/* Left Side - Character Preview */}

        <div
          className={`flex flex-col space-y-4`}
          style={{ height: Math.min(previewHeight ?? 300, 600) }}
        >
          {/* Character */}
          <div
            className="mx-auto my-auto flex w-1/2 w-full flex-col justify-center overflow-x-hidden overflow-y-hidden rounded-2xl border p-4 py-10 3xl:py-16"
            style={{
              background: `linear-gradient(
                              135deg,
                              ${colors.find((c) => c.name === avatarColour)?.bg ?? "#e7e7e7ff"} 30%,
                              ${colors.find((c) => c.name === avatarColour)?.gradient ?? "#9e9e9eff"} 95%
                            )`,
            }}
          >
            <div className="mt-8 hidden items-center justify-center 2xl:flex">
              <AvatarDisplay
                avatarColour={avatarColour}
                avatarFace={avatarFace}
                avatarLeftHand={avatarLeftHand}
                avatarRightHand={avatarRightHand}
                avatarHat={avatarHat}
              />
            </div>
            <div className="mt-8 flex items-center justify-center 2xl:hidden">
              <AvatarDisplay
                avatarColour={avatarColour}
                avatarFace={avatarFace}
                avatarLeftHand={avatarLeftHand}
                avatarRightHand={avatarRightHand}
                avatarHat={avatarHat}
                size="sm"
              />
            </div>
          </div>
          {/* Color Palette */}
          <div className="w-full">
            <div className="mb-1.5 flex justify-evenly gap-2">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => {
                    const fieldName = "avatarColour";
                    form.setValue(fieldName, color.name as AvatarColor, {
                      shouldDirty: true,
                    });
                  }}
                  className={`h-8 w-8 flex-shrink-0 rounded-lg transition-all hover:scale-[1.04] lg:h-6 lg:w-6 2xl:h-8 2xl:w-8 3xl:h-10 3xl:w-10 ${
                    avatarColour === color.name ? "ring-2 ring-purple-200" : ""
                  }`}
                  style={{
                    backgroundColor: color.value,
                    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                    borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
                    borderRight: "1px solid rgba(0, 0, 0, 0.08)",
                    borderBottom: "3px solid rgba(0, 0, 0, 0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Accessory Selection */}
        <div className="flex min-h-0 flex-col">
          {/* Category Selection */}
          <div className="flex w-full flex-shrink-0 gap-2 pb-4">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex h-12 flex-1 items-center justify-center rounded-lg transition-all hover:scale-105 ${
                  selectedCategory === category.id
                    ? "bg-[#F5F2F6]"
                    : "bg-transparent hover:bg-gray-50"
                }`}
                title={category.id}
              >
                <img src={category.src} alt={category.id} className="h-8 w-8" />
              </button>
            ))}
          </div>

          {/* Accessory Grid */}
          <div className="custom-scroll flex-1 overflow-y-auto overflow-x-hidden px-1">
            <div className="z-0 grid w-full grid-cols-3 gap-3 md:grid-cols-2 lg:h-0 lg:grid-cols-2 3xl:grid-cols-3">
              {getAccessoriesForCategory(selectedCategory).map((accessory) => {
                // Get current value for this category
                const currentValue =
                  selectedCategory === "face"
                    ? avatarFace
                    : selectedCategory === "left"
                      ? avatarLeftHand
                      : selectedCategory === "right"
                        ? avatarRightHand
                        : selectedCategory === "hat"
                          ? avatarHat
                          : null;

                const isSelected =
                  currentValue === accessory.id ||
                  (accessory.id === 0 && !currentValue);

                return (
                  <button
                    key={accessory.id}
                    type="button"
                    onClick={() => {
                      // update the corresponding form field immediately so auto-save sees it
                      const fieldName =
                        selectedCategory === "face"
                          ? "avatarFace"
                          : selectedCategory === "left"
                            ? "avatarLeftHand"
                            : selectedCategory === "right"
                              ? "avatarRightHand"
                              : selectedCategory === "hat"
                                ? "avatarHat"
                                : null;

                      if (fieldName) {
                        form.setValue(
                          fieldName,
                          accessory.id === 0 ? null : accessory.id,
                          { shouldDirty: true },
                        );
                      }
                    }}
                    className={`flex aspect-[7/5] w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-[1.01] ${
                      isSelected
                        ? "bg-lilac"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    style={
                      isSelected ? { borderColor: "var(--hw-purple)" } : {}
                    }
                  >
                    {accessory.src ? (
                      <div className="relative h-12 w-12 rounded-2xl lg:h-20 lg:w-20">
                        {/* Blurred white layer behind the thumbnail to feather edges */}
                        <div
                          aria-hidden
                          className="absolute inset-0 z-0 scale-105 transform rounded-full bg-white blur-md filter"
                        />
                        <img
                          src={accessory.src}
                          alt={accessory.name}
                          className="relative z-10 h-full w-full rounded-2xl object-contain p-1"
                        />
                      </div>
                    ) : (
                      <img
                        src={`/ellipse.png`}
                        alt="No selection"
                        className="h-8 w-8"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { basicsSaveSchema } from "~/schemas/application";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { countrySelection } from "~/server/db/schema";

export function TempBasicsForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: [
      "status",
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
  });
  const status = defaultValues?.status ?? "NOT_STARTED";

  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof basicsSaveSchema>>({
    resolver: zodResolver(basicsSaveSchema),
    defaultValues: defaultValues as z.infer<typeof basicsSaveSchema>,
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof basicsSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 md:space-y-8 md:pb-4"
      >
        <div className="flex w-full flex-col gap-3 md:gap-2">
          <FormLabel className="w-full text-sm font-medium text-gray-700">
            Full Name
          </FormLabel>
          <div className="flex w-full gap-3 md:gap-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="hidden">First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="First Name"
                      variant="primary"
                      className="form-input-mobile h-12"
                      disabled={!canEdit}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="hidden">Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Last Name"
                      variant="primary"
                      className="form-input-mobile h-12"
                      disabled={!canEdit}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                Phone Number
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  type="tel"
                  placeholder="Enter your phone number"
                  variant="primary"
                  className="form-input-mobile h-12"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                Age
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      // allow clearing the field
                      field.onChange(null);
                    } else {
                      const n = Number(v);
                      if (Number.isNaN(n)) return;
                      // never allow negative ages
                      field.onChange(Math.max(0, n));
                    }
                  }}
                  type="number"
                  value={field.value ?? ""}
                  placeholder="Enter your age"
                  variant={(field.value ?? 18) >= 18 ? "primary" : "invalid"}
                  className="form-input-mobile h-12"
                  disabled={!canEdit}
                />
              </FormControl>
              {(field.value ?? 18) < 18 && (
                <FormDescription>
                  <p className="text-destructive">
                    You must be 18 years of age by November 21, 2025.
                  </p>
                </FormDescription>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countryOfResidence"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                Your Country of Residence
              </FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="form-input-mobile h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countrySelection.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

import { infoSaveSchema } from "~/schemas/application";
import { schools } from "~/constants/schools";
import { levelOfStudy, major, numOfHackathons } from "~/server/db/schema";
import { RadioButtonGroup, RadioButtonItem } from "~/components/ui/radio-group";

export function TempInfoForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery({
    fields: [
      "status",
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
  });

  const status = data?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  // Transform the form values for display
  const formValues = useMemo(() => {
    if (!data) return undefined;
    return {
      major: data.major ?? undefined,
      school:
        (data.school as (typeof schools)[number] | undefined) ?? undefined,
      levelOfStudy: data.levelOfStudy ?? undefined,
      numOfHackathons: data.numOfHackathons ?? undefined,
      attendedBefore:
        data.attendedBefore === true
          ? "yes"
          : data.attendedBefore === false
            ? "no"
            : undefined,
    } satisfies z.infer<typeof infoSaveSchema>;
  }, [data]);

  const form = useForm<z.infer<typeof infoSaveSchema>>({
    resolver: zodResolver(infoSaveSchema),
    defaultValues: formValues, // Use the complete data object
  });

  useAutoSave(form, onSubmit, formValues);

  function onSubmit(formData: z.infer<typeof infoSaveSchema>) {
    if (!data) return;
    mutate({
      ...formData, // Override with new form values
      attendedBefore:
        formData.attendedBefore === "yes"
          ? true
          : formData.attendedBefore === "no"
            ? false
            : undefined,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Which school do you attend?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="levelOfStudy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your level of study?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select level of study" />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOfStudy.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="major"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your major?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select major" />
                  </SelectTrigger>
                  <SelectContent>
                    {major.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="attendedBefore"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Have you attended Hack Western before?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <RadioButtonItem key="yes" label="Yes" value="yes" />
                  <RadioButtonItem key="no" label="No" value="no" />
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="numOfHackathons"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How many hackathons have you attended?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {numOfHackathons.enumValues.map((option) => (
                    <RadioButtonItem
                      key={option}
                      label={option}
                      value={option}
                    />
                  ))}
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

import { Textarea } from "~/components/ui/textarea";
import { applicationStepSaveSchema } from "~/schemas/application";

export const QUESTION1 = `If your laptop suddenly gained consciousness, what do you think it would say about your working style and why? (30 to 150 words)`;
export const QUESTION2 = `What’s one piece of feedback you’ve received that stuck with you and why? (30 to 150 words)`;
export const QUESTION3 = `What’s a project you’d love to revisit and improve if you had the time, and why? (30 to 150 words)`;

export function TempApplicationForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "question1", "question2", "question3"],
  });

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof applicationStepSaveSchema>>({
    resolver: zodResolver(applicationStepSaveSchema),
    mode: "onBlur",
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof applicationStepSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION1}</FormLabel>
          <FormField
            control={form.control}
            name="question1"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION2}</FormLabel>
          <FormField
            control={form.control}
            name="question2"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <FormLabel className="w-full">{QUESTION3}</FormLabel>
          <FormField
            control={form.control}
            name="question3"
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Type your message here"
                    variant={
                      (field.value?.split(/\s+/).filter(Boolean).length ?? 0) <=
                      150
                        ? "primary"
                        : "invalid"
                    }
                    disabled={!canEdit}
                  />
                </FormControl>
                <div
                  className={`text-sm ${(field.value?.split(/\s+/).filter(Boolean).length ?? 0) <= 150 ? "text-gray-500" : "text-destructive"}`}
                >
                  {field.value?.split(/\s+/).filter(Boolean).length ?? 0} / 150
                  words
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}

import type { ClipboardEvent } from "react";
import { linksSaveSchema } from "~/schemas/application";
import {
  getGithubUsername,
  getLinkedinUsername,
  ensureUrlHasProtocol,
} from "~/utils/urls";

export function TempLinksForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "githubLink", "linkedInLink", "otherLink", "resumeLink"],
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = true;

  // If the application already has a resumeLink when the component mounts,
  // derive a display name from the URL so the original filename shows.
  useEffect(() => {
    if (!resumeName && defaultValues?.resumeLink) {
      try {
        setResumeName(fileNameFromUrl(defaultValues.resumeLink));
      } catch {
        /* ignore */
      }
    }
  }, [defaultValues?.resumeLink, resumeName]);

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof linksSaveSchema>>({
    resolver: zodResolver(linksSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof linksSaveSchema>) {
    // Normalize resume and other links so they validate as URLs (prepend https:// if missing)
    const normalizedData = {
      ...data,
      resumeLink: ensureUrlHasProtocol(data.resumeLink),
      otherLink: ensureUrlHasProtocol(data.otherLink),
    } as z.infer<typeof linksSaveSchema>;

    mutate({
      ...normalizedData,
    });
  }

  function onGithubPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const githubUsername = getGithubUsername(pastedText);

    form.setValue("githubLink", githubUsername);
    return form.handleSubmit(onSubmit)();
  }

  function onLinkedinPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const linkedinUsername = getLinkedinUsername(pastedText);

    form.setValue("linkedInLink", linkedinUsername);
    return form.handleSubmit(onSubmit)();
  }

  function fileNameFromUrl(url: string) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop();
      return last ?? url;
    } catch {
      const parts = url.split("/");
      return parts[parts.length - 1] ?? url;
    }
  }

  async function onResumeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 3 MB" });
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload/resume", {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const { message } = (await resp.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(message ?? `Upload failed (${resp.status})`);
      }
      const data = (await resp.json()) as {
        url: string;
        name: string;
      };
      // Set the resume link to the uploaded URL and autosave
      form.setValue("resumeLink", data.url, { shouldDirty: true });
      setResumeName(data.name);
      await form.handleSubmit(onSubmit)();
      toast({ title: "Uploaded", description: "Resume uploaded successfully" });
    } catch (err) {
      console.error(err);
      toast({ title: "Upload error", description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function clearResume() {
    form.setValue("resumeLink", "", { shouldDirty: true });
    setResumeName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    void form.handleSubmit(onSubmit)();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="githubLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Github</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>github.com/</span>
                  <Input
                    onPaste={onGithubPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="linkedInLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-32">linkedin.com/in/</span>
                  <Input
                    onPaste={onLinkedinPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="otherLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Portfolio</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="hackerportfolio.com"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="resumeLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  {field.value ? (
                    <div className="flex items-center gap-2 text-sm">
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-64 overflow-hidden text-ellipsis whitespace-nowrap underline underline-offset-2"
                      >
                        {resumeName ?? fileNameFromUrl(field.value)}
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={clearResume}
                          className="text-xl text-muted-foreground hover:text-foreground"
                          aria-label="Remove resume"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={onResumeFileChange}
                        disabled={!canEdit || uploading}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!canEdit || uploading}
                          aria-label="Choose resume file"
                          className="-py-4 px-2"
                        >
                          <span className="text-medium">
                            {uploading ? "Uploading…" : "Choose file"}
                          </span>
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          PDF or DOC/DOCX, max 3 MB
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </FormControl>
              <FormDescription>Upload your resume</FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

import { agreementsSaveSchema } from "~/schemas/application";
import { Checkbox } from "~/components/ui/checkbox";

const StyledLink = ({ url, text }: { url: string; text: string }) => {
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-600 underline hover:text-primary-500"
    >
      {text}
    </Link>
  );
};

export function TempAgreementsForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: [
      "status",
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
  });

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof agreementsSaveSchema>>({
    resolver: zodResolver(agreementsSaveSchema),
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof agreementsSaveSchema>) {
    mutate({
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="agreeCodeOfConduct"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I have read and agree to the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md "
                  text="MLH Code of Conduct"
                />
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeShareWithMLH"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I authorize Hack Western to share my application/registration
                information with Major League Hacking for event administration,
                ranking, and MLH administration in-line with the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md"
                  text="MLH Privacy Policy"
                />
                . I further agree to the terms of the{" "}
                <StyledLink
                  url="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md"
                  text="MLH Contest Terms and Conditions"
                />
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeShareWithSponsors"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I give Hack Western permission to share my information with
                sponsors
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeWillBe18"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                I will be at least 18 years old on November 21st, 2025
              </FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeEmailsFromMLH"
          render={({ field }) => (
            <FormItem className="flex gap-2">
              <FormControl className="mt-1.5">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value)}
                  disabled={!canEdit}
                />
              </FormControl>
              <FormLabel className="text-sm text-slate-500">
                <b>(Optional)</b> I authorize MLH to send me occasional emails
                about relevant events, career opportunities, and community
                announcements.
              </FormLabel>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

import {
  type UnderrepGroupAnswer,
  optionalSaveSchema,
  underrepGroupAnswers,
} from "~/schemas/application";
import { ethnicity, gender, sexualOrientation } from "~/server/db/schema";

function getUnderrepGroup(underrepGroup: boolean | null) {
  if (underrepGroup === null) {
    return "Prefer not to answer" as const;
  }
  return underrepGroup ? ("Yes" as const) : ("No" as const);
}

function isUnderrepGroup(answer: UnderrepGroupAnswer) {
  switch (answer) {
    case "Prefer not to answer":
      return null;
    case "Yes":
      return true;
    default:
      return false;
  }
}

export function TempOptionalForm() {
  const utils = api.useUtils();
  const { data } = api.application.get.useQuery({
    fields: [
      "status",
      "underrepGroup",
      "gender",
      "ethnicity",
      "sexualOrientation",
    ],
  });

  const status = data?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const defaultValues = useMemo(() => {
    if (!data) return data;
    const underrepGroup = getUnderrepGroup(data.underrepGroup!);
    return {
      ...data,
      underrepGroup,
      // The database stores nullable enum columns as `null` when the user
      // hasn't selected anything. Our zod schema expects these fields to be
      // optional (i.e. string | undefined). Convert null -> undefined so
      // react-hook-form's reset and zod validation don't complain about
      // `null` being passed where an optional enum/string is expected.
      gender: data.gender ?? undefined,
      ethnicity: data.ethnicity ?? undefined,
      sexualOrientation: data.sexualOrientation ?? undefined,
    };
  }, [data]);

  const form = useForm<z.infer<typeof optionalSaveSchema>>({
    resolver: zodResolver(optionalSaveSchema),
    defaultValues: defaultValues ?? undefined,
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof optionalSaveSchema>) {
    const underrepGroup = isUnderrepGroup(data.underrepGroup);
    mutate({
      ...data,
      underrepGroup,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid h-fit space-y-8 overflow-y-auto p-1"
      >
        <FormField
          control={form.control}
          name="underrepGroup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Do you identify as part of an underrepresented group in the
                technology industry?
              </FormLabel>
              <FormControl>
                <RadioButtonGroup
                  {...field}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {underrepGroupAnswers.map((option) => (
                    <RadioButtonItem
                      key={option}
                      label={option}
                      value={option}
                    />
                  ))}
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your gender?</FormLabel>
              <FormControl>
                <RadioButtonGroup
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  {gender.enumValues.map((option) => (
                    <RadioButtonItem
                      key={option}
                      label={option}
                      value={option}
                    />
                  ))}
                </RadioButtonGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ethnicity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your race/ethnicity?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select race/ethnicity" />
                  </SelectTrigger>
                  <SelectContent>
                    {ethnicity.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sexualOrientation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What is your sexual orientation?</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  onValueChange={field.onChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sexual/orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexualOrientation.enumValues.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

import type { CanvasPaths } from "~/types/canvas";
import { Undo, Redo, Trash2 } from "lucide-react";
import { canvasSaveSchema } from "~/schemas/application";
import SimpleCanvas from "~/components/apply/form/simple-canvas";

export function TempCanvasForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "canvasData"],
  });

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = true;

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });
  const canvasRef = React.useRef<{
    clear: () => void;
    isEmpty: () => boolean;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
  }>(null);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const form = useForm<z.infer<typeof canvasSaveSchema>>({
    resolver: zodResolver(canvasSaveSchema),
  });

  // Load existing drawing data when form loads
  React.useEffect(() => {
    try {
      // Prefer controller/form value if available, otherwise fall back to server defaults
      const drawingData =
        form.getValues?.("canvasData") ?? defaultValues?.canvasData;

      const isObject = drawingData && typeof drawingData === "object";
      let hasPaths = false;

      if (isObject) {
        const maybePaths = (drawingData as Partial<CanvasData>).paths;
        hasPaths = Array.isArray(maybePaths) && maybePaths.length > 0;
      }

      setIsCanvasEmpty(!hasPaths);
    } catch (error) {
      console.warn("Failed to determine initial canvas data state:", error);
      setIsCanvasEmpty(true);
    }
  }, [defaultValues?.canvasData, form]);

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof canvasSaveSchema>) {
    mutate({
      ...data,
    });
  }

  type CanvasData = {
    paths: CanvasPaths;
    timestamp: number;
    version: string;
  };

  const canvasData = defaultValues?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point[0]} ${point[1]}`;
        return `${acc} L ${point[0]} ${point[1]}`;
      }, ""),
    ) ?? [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          {canEdit ? (
            <FormField
              control={form.control}
              name="canvasData"
              // Provide a defaultValue so react-hook-form registers this Controller
              defaultValue={defaultValues?.canvasData ?? null}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="-mr-1">
                      <div className="pointer-events-none absolute z-[999] mt-2 flex w-[17.5rem] justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          disabled={!canUndo}
                          onClick={() => {
                            canvasRef.current?.undo();
                          }}
                          className="pointer-events-auto h-6 w-6 text-heavy hover:bg-gray-200/80"
                          title="Undo"
                        >
                          <Undo className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          disabled={!canRedo}
                          onClick={() => {
                            canvasRef.current?.redo();
                          }}
                          className="pointer-events-auto h-6 w-6 text-heavy hover:bg-gray-200/80"
                          title="Redo"
                        >
                          <Redo className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          disabled={isCanvasEmpty}
                          onClick={() => {
                            canvasRef.current?.clear();
                          }}
                          className="pointer-events-auto h-6 w-6 text-heavy hover:bg-gray-200/80"
                          title="Clear"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <SimpleCanvas
                        ref={canvasRef}
                        // Use the controller's value when available so the canvas
                        // reflects the form state and the field is properly controlled
                        initialData={
                          (field.value as CanvasData | null) ??
                          (defaultValues?.canvasData as CanvasData | null) ??
                          null
                        }
                        onHistoryChange={(newCanUndo, newCanRedo) => {
                          setCanUndo(newCanUndo);
                          setCanRedo(newCanRedo);
                        }}
                        onDrawingChange={(isEmpty, data) => {
                          setIsCanvasEmpty(isEmpty);
                          // Don't call canUndo/canRedo here - it causes race conditions
                          if (data) {
                            field.onChange(data);
                          }
                        }}
                        onFormFieldChange={(data) => {
                          // Only update the form field, don't trigger button state checks
                          field.onChange(data);
                        }}
                        onCanvasEmptyChange={(isEmpty) => {
                          // Update trash button state during undo/redo operations
                          setIsCanvasEmpty(isEmpty);
                        }}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          ) : pathStrings.length > 0 ? (
            <div className="overflow-hidden rounded-lg border-2 border-gray-300 bg-white">
              <svg className="h-64 w-full lg:h-72">
                {pathStrings.map((pathString, pathIndex) => (
                  <path
                    key={pathIndex}
                    d={pathString}
                    stroke="#a16bc7"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            </div>
          ) : (
            <p className="text-sm text-medium">No drawing :(</p>
          )}
        </div>
      </form>
    </Form>
  );
}

import { PencilLine } from "lucide-react";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type ReviewSectionProps = {
  step: ApplyStepFull;
  error: z.inferFormattedError<typeof applicationSubmitSchema> | undefined;
  className?: string;
};

function ReviewSection({ step, error, className }: ReviewSectionProps) {
  return (
    <div className={cn("py-4", className)}>
      <Separator />
      <div className="flex justify-between pt-4">
        <h2 className="font-jetbrains-mono text-base uppercase text-medium">
          {step.label}
        </h2>
        <Button asChild variant="secondary" className="gap-2">
          <Link href={{ pathname: "/apply", query: { step: step.step } }}>
            <PencilLine className="w-4" />
            Edit
          </Link>
        </Button>
      </div>
      <div className="space-y-4 py-2">
        <ReviewSectionInfo step={step} error={error} />
      </div>
    </div>
  );
}

function ReviewSectionInfo({ step, error }: ReviewSectionProps) {
  switch (step.step) {
    case "basics":
      return <BasicsReview step={step} error={error} />;
    case "info":
      return <InfoReview step={step} error={error} />;
    case "application":
      return <ApplicationReview step={step} error={error} />;
    case "links":
      return <LinksReview step={step} error={error} />;
    case "agreements":
      return <AgreementsReview step={step} error={error} />;
    case "optional":
      return <OptionalReview step={step} error={error} />;
    case "character":
      return <AvatarReview step={step} error={error} />;
    case "canvas":
      return <CanvasReview step={step} error={error} />;
    default:
      return <></>;
  }
}

type ReviewFieldProps = {
  label: string;
  value: boolean | number | string | null | undefined;
  error: string[] | null | undefined;
};

function ReviewField({ value, label, error }: ReviewFieldProps) {
  const errorMessage = error?.join(", ") ?? null;
  const isEmptyValue = value === "" || value === null || value === undefined;

  let displayValue: React.ReactNode = "";
  if (typeof value === "boolean") {
    displayValue = value ? "Yes" : "No";
  } else if (typeof value === "number") {
    displayValue = value.toString();
  } else if (typeof value === "string") {
    displayValue = value;
  } else if (isEmptyValue) {
    displayValue = "(no answer)";
  }

  if (label === "Resume") {
    // if value is a url, show only the filename
    if (typeof value === "string" && value.startsWith("http")) {
      try {
        const url = new URL(value);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        displayValue = filename ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 transition-colors hover:text-emphasis"
          >
            {filename}
          </a>
        ) : (
          "(no resume uploaded)"
        );
      } catch {
        displayValue = value;
      }
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p
        className={cn("text-sm text-heavy", {
          "text-medium": isEmptyValue,
        })}
      >
        {displayValue}
      </p>
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage ?? ""}</p>
      )}
    </div>
  );
}

function BasicsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["firstName", "lastName", "phoneNumber", "age"],
  });

  const nameErrors: string[] = [];
  if (!data?.firstName) nameErrors.push("First name is required");
  if (!data?.lastName) nameErrors.push("Last name is required");
  return (
    <>
      <ReviewField
        label="Full Name"
        value={`${data?.firstName ?? ""} ${data?.lastName ?? ""}`}
        error={nameErrors}
      />
      <ReviewField
        label="Phone Number"
        value={data?.phoneNumber}
        error={error?.phoneNumber?._errors}
      />
      <ReviewField label="Age" value={data?.age} error={error?.age?._errors} />
    </>
  );
}

function InfoReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
  });
  return (
    <>
      <ReviewField
        label="Which school do you attend?"
        value={data?.school}
        error={!data?.school ? ["School is required"] : []}
      />
      <ReviewField
        label="Which year are you in?"
        value={data?.levelOfStudy}
        error={!data?.levelOfStudy ? ["Year is required"] : []}
      />
      <ReviewField
        label="What is your major?"
        value={data?.major}
        error={!data?.major ? ["Major is required"] : []}
      />
      <ReviewField
        label="Have you attended Hack Western before?"
        value={data?.attendedBefore}
        error={error?.attendedBefore?._errors}
      />
      <ReviewField
        label="How many hackathons have you attended?"
        value={data?.numOfHackathons}
        error={error?.numOfHackathons?._errors}
      />
    </>
  );
}

function ApplicationReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["question1", "question2", "question3"],
  });
  return (
    <>
      <ReviewField
        label={QUESTION1}
        value={data?.question1}
        error={error?.question1?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label={QUESTION2}
        value={data?.question2}
        error={error?.question2?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label={QUESTION3}
        value={data?.question3}
        error={error?.question3?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
    </>
  );
}

function LinksReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["githubLink", "linkedInLink", "otherLink", "resumeLink"],
  });
  return (
    <>
      <ReviewField
        label="Github"
        value={data?.githubLink}
        error={error?.githubLink?._errors}
      />
      <ReviewField
        label="LinkedIn"
        value={data?.linkedInLink}
        error={error?.linkedInLink?._errors}
      />
      <ReviewField
        label="Personal Portfolio"
        value={data?.otherLink}
        error={error?.otherLink?._errors}
      />
      <ReviewField
        label="Resume"
        value={data?.resumeLink}
        error={error?.resumeLink?._errors}
      />
    </>
  );
}

function AgreementsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
  });
  return (
    <>
      <ReviewField
        label="I have read and agree to the MLH Code of Conduct"
        value={data?.agreeCodeOfConduct}
        error={error?.agreeCodeOfConduct?._errors}
      />
      <ReviewField
        label="I authorize Hack Western to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy. I further agree to the terms of the MLH Contest Terms and Conditions"
        value={data?.agreeShareWithMLH}
        error={error?.agreeShareWithMLH?._errors}
      />
      <ReviewField
        label="I give Hack Western permission to share my information with sponsors"
        value={data?.agreeShareWithSponsors}
        error={error?.agreeShareWithSponsors?._errors}
      />
      <ReviewField
        label="I will be at least 18 years old on November 21st, 2025"
        value={data?.agreeWillBe18}
        error={error?.agreeWillBe18?._errors}
      />
      <ReviewField
        label="(Optional) I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements."
        value={data?.agreeEmailsFromMLH}
        error={error?.agreeEmailsFromMLH?._errors}
      />
    </>
  );
}

function OptionalReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["underrepGroup", "gender", "ethnicity", "sexualOrientation"],
  });
  return (
    <>
      <ReviewField
        label="Do you identify as part of an underrepresented group in the technology industry?"
        value={data?.underrepGroup}
        error={null}
      />
      <ReviewField
        label="What is your gender?"
        value={data?.gender}
        error={null}
      />
      <ReviewField
        label="What is your race/ethnicity?"
        value={data?.ethnicity}
        error={null}
      />
      <ReviewField
        label="What is your sexual orientation?"
        value={data?.sexualOrientation}
        error={null}
      />
    </>
  );
}

function AvatarReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
  });

  const selectedColor = colors.find(
    (c) => c.name === (data?.avatarColour ?? "green"),
  );

  return (
    <div className="space-y-2">
      <Label>Your Avatar</Label>
      <div
        className="mx-auto -mt-4 flex h-80 w-80 scale-90 flex-col justify-center rounded-2xl p-4 pt-8"
        style={{
          background: `linear-gradient(135deg, ${selectedColor?.bg ?? "#F1FDE0"} 30%, ${selectedColor?.gradient ?? "#A7FB73"} 95%)`,
        }}
      >
        <div className="flex items-center justify-center">
          <AvatarDisplay
            avatarColour={data?.avatarColour}
            avatarFace={data?.avatarFace}
            avatarLeftHand={data?.avatarLeftHand}
            avatarRightHand={data?.avatarRightHand}
            avatarHat={data?.avatarHat}
          />
        </div>
      </div>
    </div>
  );
}

function CanvasReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({ fields: ["canvasData"] });

  // reuse shared canvas types
  type CanvasData = {
    paths: CanvasPaths;
    timestamp: number;
    version: string;
  };

  const canvasData = data?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point[0]} ${point[1]}`;
        return `${acc} L ${point[0]} ${point[1]}`;
      }, ""),
    ) ?? [];

  return (
    <div className="space-y-2">
      <Label>Your Drawing</Label>
      {pathStrings.length > 0 ? (
        <div className="h-64 w-64 overflow-hidden rounded-lg border-2 border-gray-300 bg-white lg:h-72 lg:w-72">
          <svg className="h-full w-full">
            {pathStrings.map((pathString, pathIndex) => (
              <path
                key={pathIndex}
                d={pathString}
                stroke="#a16bc7"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-medium">(no drawing)</p>
      )}
    </div>
  );
}

const reviewSteps = applySteps.slice(0, -1);

export function TempReviewForm() {
  const { data } = api.application.get.useQuery({
    // fields required by applicationSubmitSchema
    fields: [
      "firstName",
      "lastName",
      "phoneNumber",
      "countryOfResidence",
      "age",
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
      "question1",
      "question2",
      "question3",
      "resumeLink",
      "githubLink",
      "linkedInLink",
      "otherLink",
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
  });
  const result = applicationSubmitSchema.safeParse(data);
  const error = result.error?.format();
  return (
    <div className="overflow-auto">
      {reviewSteps.map((step, idx) => (
        <ReviewSection step={step} key={idx} error={error} />
      ))}
    </div>
  );
}

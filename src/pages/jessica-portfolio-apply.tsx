import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyForm } from "~/components/apply/form";
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
                  <ApplyForm step={step} />
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
                        <ApplyForm
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
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

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

  if (status !== "NOT_STARTED" && status !== "IN_PROGRESS") {
    return null;
  }

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

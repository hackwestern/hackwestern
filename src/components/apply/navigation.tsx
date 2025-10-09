import Link from "next/link";
import React from "react";
import {
  applySteps,
  mobileApplySteps,
  type ApplyStep,
} from "~/constants/apply";
import Image from "next/image";
import { Button } from "../ui/button";
import { SavedIndicator } from "./saved-indicator";
import { api } from "~/utils/api";
import { useToast } from "../hooks/use-toast";

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

// Mobile-specific navigation functions
export function getMobilePreviousStep(
  stepIndex: number | null,
): ApplyStep | null {
  if (stepIndex === null) return null;
  return mobileApplySteps[stepIndex - 1]?.step ?? null;
}

export function getMobileNextStep(stepIndex: number | null): ApplyStep | null {
  if (stepIndex === null) return null;
  return mobileApplySteps[stepIndex + 1]?.step ?? null;
}

export function getMobileStepIndex(step: ApplyStep | null): number | null {
  if (!step) return null;

  const stepIndex = mobileApplySteps.findIndex((s) => s.step === step);
  if (stepIndex >= 0) {
    return stepIndex;
  }

  return null;
}

export function ApplyNavigation({ step }: ApplyNavigationProps) {
  const stepIndex = React.useMemo(() => getStepIndex(step), [step]);
  const mobileStepIndex = React.useMemo(() => getMobileStepIndex(step), [step]);
  const previousStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);
  const mobilePreviousStep = getMobilePreviousStep(mobileStepIndex);
  const mobileNextStep = getMobileNextStep(mobileStepIndex);
  const { toast } = useToast();

  const { data: applicationData } = api.application.get.useQuery();
  const status = applicationData?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const onClickSubmit = () => {
    if (applicationData?.status !== "PENDING_REVIEW" && step === "review") {
      toast({
        title: "Application Incomplete",
        description: "Please complete all required steps before submitting.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="z-10 flex w-full items-center justify-between">
      {/* Mobile Layout */}
      <div className="flex w-screen items-center justify-between px-3 md:hidden">
        <div className="flex w-1/4 items-center gap-3">
          {!step || mobilePreviousStep ? (
            <Button
              variant="secondary"
              asChild
              className="h-10 border-gray-300 px-4 text-gray-700 hover:bg-gray-50"
            >
              <Link href={`/apply?step=${mobilePreviousStep ?? step}`}>
                <div className="flex items-center gap-2">
                  <Image
                    src="/arrow-left.svg"
                    alt="Left Arrow"
                    width={12}
                    height={12}
                  />
                  Back
                </div>
              </Link>
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
            asChild
            className="h-10 px-6"
            onClick={onClickSubmit}
          >
            {!step || !!mobileNextStep ? (
              <Link href={`/apply?step=${mobileNextStep}`}>
                <div className="flex items-center gap-2">
                  Next
                  <Image
                    src="/arrow-right.svg"
                    alt="Right Arrow"
                    width={12}
                    height={12}
                  />
                </div>
              </Link>
            ) : canEdit ? (
              <Link href={`/submitted`}>Submit</Link>
            ) : (
              <Link href={`/dashboard`}>Home</Link>
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
                variant="tertiary-arrow"
                asChild
                className="h-6 w-16 text-base font-medium text-heavy"
              >
                <Link href={`/apply?step=${previousStep}`}>Back</Link>
              </Button>
            ))}
          <Button
            variant="primary"
            asChild
            className="w-28"
            onClick={onClickSubmit}
          >
            {!step || !!nextStep ? (
              <Link href={`/apply?step=${nextStep}`}>
                <div className="flex gap-2">
                  Next
                  <Image
                    src="/arrow-right.svg"
                    alt="Right Arrow"
                    width={10}
                    height={10}
                  />
                </div>
              </Link>
            ) : canEdit ? (
              <Link href={`/submitted`}>Submit</Link>
            ) : (
              <Link href={`/dashboard`}>Home</Link>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

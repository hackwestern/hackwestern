import Link from "next/link";
import React from "react";
import { applySteps, type ApplyStep } from "~/constants/apply";
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

export function ApplyNavigation({ step }: ApplyNavigationProps) {
  const stepIndex = React.useMemo(() => getStepIndex(step), [step]);
  const previousStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);
  const { toast } = useToast();

  const { data: applicationData } = api.application.get.useQuery();

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
    <div className="sticky bottom-0 flex w-full justify-between py-3">
      <SavedIndicator />
      <div className="ml-auto flex items-center gap-12">
        {!step ||
        (previousStep && (
          <Button variant="tertiary-arrow" asChild className="font-medium text-base text-heavy h-6 w-16">
            <Link href={`/apply?step=${previousStep}`}>  
              Back
            </Link>
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
          ) : (
            <Link href={`/submitted`}>Submit</Link>
          )}
        </Button>
      </div>
    </div>
  );
}

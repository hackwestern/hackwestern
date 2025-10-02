import Link from "next/link";
import React from "react";
import { applySteps, type ApplyStep } from "~/constants/apply";
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
      {!step ||
        (previousStep && (
          <Button variant="secondary" asChild className="w-20">
            <Link href={`/apply?step=${previousStep}`}>Back</Link>
          </Button>
        ))}
      <div className="ml-auto flex items-center gap-3">
       
        <Button
          variant="primary"
          asChild
          className="w-20"
          onClick={onClickSubmit}
        >
          {!step || !!nextStep ? (
            <Link href={`/apply?step=${nextStep}`}>Next</Link>
          ) : (
            <Link href={`/submitted`}>Submit!</Link>
          )}
        </Button>
      </div>
    </div>
  );
}

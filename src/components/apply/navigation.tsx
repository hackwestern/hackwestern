import Link from "next/link";
import React from "react";
import { useMutationState } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { format } from "date-fns";

import { api } from "~/utils/api";
import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";

type ApplyNavigationProps = {
  step: ApplyStep | null;
};

function getPreviousStep(stepIndex: number | null): ApplyStep | null {
  if (stepIndex === null) return null;
  return applySteps[stepIndex - 1]?.step ?? null;
}

function getNextStep(stepIndex: number | null): ApplyStep | null {
  if (stepIndex === null) return null;
  return applySteps[stepIndex + 1]?.step ?? null;
}

function getStepIndex(step: ApplyStep | null): number | null {
  if (!step) return null;

  const stepIndex = applySteps.findIndex((s) => s.step === step);
  if (stepIndex >= 0) {
    return stepIndex;
  }

  return null;
}

function formattedDate(lastSaved: Date | null): string | null {
  if (!lastSaved) {
    return null;
  }
  return format(lastSaved, "MMM d, h:m a");
}

function LastSavedAt() {
  const lastSavedAtState = useMutationState({
    filters: { mutationKey: getQueryKey(api.application.get) },
    select: (mutation) =>
      mutation.state.submittedAt !== 0
        ? new Date(mutation.state.submittedAt)
        : null,
  });
  const formattedLastSavedAt = formattedDate(lastSavedAtState[0] ?? null);

  if (!formattedLastSavedAt) {
    return <span>Not Saved</span>;
  }

  return (
    <span className="text-right text-xs italic text-slate-400">
      Last Saved:
      <br />
      {formattedLastSavedAt}
    </span>
  );
}

export function ApplyNavigation({ step }: ApplyNavigationProps) {
  const stepIndex = React.useMemo(() => getStepIndex(step), [step]);
  const previousStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);

  return (
    <div className="flex w-full justify-between">
      {!step ||
        (previousStep && (
          <Button variant="secondary" asChild className="w-20">
            <Link href={`/apply?step=${previousStep}`}>Back</Link>
          </Button>
        ))}
      <div className="ml-auto flex items-center gap-3">
        <LastSavedAt />
        <Button variant="primary" asChild className="w-20">
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

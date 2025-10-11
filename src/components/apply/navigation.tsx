import React from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { SavedIndicator } from "./saved-indicator";
import { api } from "~/utils/api";
import { useToast } from "~/hooks/use-toast";
import { usePendingNavigation } from "~/hooks/use-pending-navigation";
import { applySteps, type ApplyStep } from "~/constants/apply";
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

export function ApplyNavigation({ step }: ApplyNavigationProps) {
  const stepIndex = React.useMemo(() => getStepIndex(step), [step]);
  const previousStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);
  const { toast } = useToast();

  const { data: applicationData } = api.application.get.useQuery();
  const status = applicationData?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const { pending, navigate } = usePendingNavigation();

  const { data } = api.application.get.useQuery();
  const result = applicationSubmitSchema.safeParse(data);
  const error = result.error?.format();

  const submitMutation = api.application.submit.useMutation();

  const onClickSubmit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (step !== "review") return;

    console.log("errors: ", error);

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
              onClick={() => navigate(`/apply?step=${previousStep ?? step}`)}
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
                void navigate(`/apply?step=${nextStep}`);
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
                onClick={() => navigate(`/apply?step=${previousStep}`)}
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
                void navigate(`/apply?step=${nextStep}`);
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

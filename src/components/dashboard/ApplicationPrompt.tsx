import React from "react";
import { APPLICATION_DEADLINE_ISO } from "~/lib/date";
import { Button } from "~/components/ui/button";
import dynamic from "next/dynamic";

type Props = {
  status: string;
  continueStep: string;
  onApplyNavigate: (step: string) => void;
  pending: boolean;
};

const CountdownTimer = dynamic(
  () => import("~/components/apply/countdown-timer"),
  {
    ssr: false,
  },
);

export default function ApplicationPrompt({
  status,
  continueStep,
  onApplyNavigate,
  pending,
}: Props) {
  return (
    <>
      <div className="z-[99] w-screen max-w-md space-y-12 text-center">
        <div>
          <h1 className="-ml-4 flex w-max flex-col items-center font-dico text-6xl font-medium text-heavy">
            Hack Western 12
          </h1>
          <h1 className=" flex flex-col items-center font-dico text-6xl font-medium text-heavy">
            Application
          </h1>
        </div>
        <div>
          <CountdownTimer targetDate={APPLICATION_DEADLINE_ISO} />
        </div>
        <div>
          <Button
            variant="primary"
            className="w-full p-6 font-figtree text-base font-medium"
            onClick={() => void onApplyNavigate(continueStep)}
            disabled={pending}
            aria-busy={pending}
          >
            {status == "NOT_STARTED"
              ? "Start Application"
              : status == "IN_PROGRESS"
                ? "Continue Application"
                : "Review Application"}
          </Button>
        </div>
      </div>
    </>
  );
}

import React from "react";
import { Button } from "~/components/ui/button";

type Props = {
  continueStep: string;
  onApplyNavigate: (step: string) => void;
  pending: boolean;
};

export default function ApplicationPrompt({
  continueStep,
  onApplyNavigate,
  pending,
}: Props) {
  return (
    <>
      <div className="z-[99] mx-auto mt-10 w-full max-w-md space-y-8 text-center md:mx-0 md:mt-0 md:w-full md:max-w-xl md:space-y-6 md:text-left">
        <div>
          <h1 className="flex flex-col items-center text-center font-primary text-3xl font-bold text-heavy md:items-start md:text-left md:text-6xl">
            Hack Western 13
          </h1>
          <h1 className="flex flex-col items-center text-center font-primary text-3xl font-bold text-heavy md:items-start md:text-left md:text-6xl">
            Application
          </h1>
        </div>
        <div className="flex flex-col items-center gap-2 md:items-start">
          <p className="text-center font-figtree text-base font-medium text-medium md:text-left md:text-lg">
            DISCOVER THE UNKNOWN
          </p>
          <div aria-hidden="true" className="h-7 md:h-8" />
        </div>
        <div className="flex justify-center md:justify-start">
          <Button
            variant="primary-2"
            className="w-full p-6 font-figtree text-base font-medium md:w-auto md:px-8"
            onClick={() => void onApplyNavigate(continueStep)}
            disabled={pending}
            aria-busy={pending}
          >
            Get Started
          </Button>
        </div>
      </div>
    </>
  );
}

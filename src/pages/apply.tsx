import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";

import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyNavbar } from "~/components/apply/navbar";
import { ApplyForm } from "~/components/apply/form";
import { ApplyNavigation } from "~/components/apply/navigation";

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  return applySteps.find((s) => s.step === stepValue) ?? null;
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
      <main className="flex h-svh max-h-svh flex-col items-center bg-primary-50">
        <ApplyNavbar />
        <div className="flex w-full flex-1 flex-grow items-center">
          {/* TODO: make this responsive */}
          <div
            id="left-panel"
            className="lg:w-xl flex h-full flex-grow flex-col space-y-8 bg-primary-100 p-9 pt-12 lg:max-w-xl"
          >
            <div className="space-y-2">
              <h1 className="text-2xl font-medium">{heading}</h1>
              <h2 className="text-sm text-slate-500">{subheading}</h2>
            </div>
            <div className="flex-1">
              <ApplyForm step={step} />
            </div>
            <ApplyNavigation step={step} />
          </div>
          <div
            id="right-panel"
            className="flex h-full w-[60vw] flex-col items-center justify-center"
          >
            <h1 className="text-xl font-bold">Passport Panel</h1>
          </div>
        </div>
        <ApplyMenu step={step} />
      </main>
    </>
  );
}

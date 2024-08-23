import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";

import { type ApplyStep, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyNavbar } from "~/components/apply/navbar";
import { ApplyForm } from "~/components/apply/form";
import { ApplyNavigation } from "~/components/apply/navigation";

function getStep(stepValue: string | null): ApplyStep | null {
  return applySteps.find((s) => s.step === stepValue)?.step ?? null;
}

export default function Apply() {
  const searchParams = useSearchParams();
  const step = React.useMemo(
    () => getStep(searchParams.get("step")),
    [searchParams],
  );

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
            className="flex h-full flex-grow flex-col bg-primary-100 p-9 pt-12"
          >
            <h1 className="flex-1 text-xl font-bold">Form Panel</h1>
            <ApplyForm step={step} />
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

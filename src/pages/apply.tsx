import React, { useState } from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyNavbar } from "~/components/apply/navbar";
import { ApplyForm } from "~/components/apply/form";
import { ApplyNavigation } from "~/components/apply/navigation";
import { Passport } from "~/components/apply/passport";

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  return applySteps.find((s) => s.step === stepValue) ?? null;
}

export default function Apply() {
  const searchParams = useSearchParams();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step")),
    [searchParams],
  );

  const [formVisible, setFormVisible] = useState(true);
  const [passportVisible, setPassportVisible] = useState(true);

  const step = applyStep?.step ?? null;
  const heading = applyStep?.heading ?? null;
  const subheading = applyStep?.subheading ?? null;

  // screen width smaller than sm
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (isMobile && formVisible === passportVisible) {
    setFormVisible(true);
    setPassportVisible(false);
  }

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
        <div className="fixed bg-primary-50 sm:static">
          <ApplyNavbar />
          {isMobile && (
            <div className="flex w-screen justify-around border-b px-3 md:invisible">
              <div
                className={`w-1/2 py-4 text-center ${formVisible ? "border-b border-primary-600 text-primary-600" : "border-b border-slate-400 text-slate-400"}`}
                onClick={() => {
                  setFormVisible(true);
                  setPassportVisible(false);
                }}
              >
                Form
              </div>
              <div
                className={`w-1/2 py-4 text-center ${passportVisible ? "border-b border-primary-600 text-primary-600" : "border-b border-slate-400 text-slate-400"}`}
                onClick={() => {
                  setFormVisible(false);
                  setPassportVisible(true);
                }}
              >
                Passport
              </div>
            </div>
          )}
        </div>
        {isMobile && <div className="bg-black py-12">this is a secret</div>}
        <div className="flex w-full flex-grow items-center">
          {/* TODO: make this responsive */}
          {formVisible && (
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
          )}
          {passportVisible && (
            <div
              id="right-panel"
              className="flex h-full w-screen flex-col items-center justify-center px-4 sm:w-[60vw]"
            >
              <Passport />
            </div>
          )}
        </div>
        {isMobile && <div className="py-4">this is a secret</div>}
        <ApplyMenu step={step} />
      </main>
    </>
  );
}

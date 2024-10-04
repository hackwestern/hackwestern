import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyNavbar } from "~/components/apply/navbar";
import { ApplyForm } from "~/components/apply/form";
import { ApplyNavigation } from "~/components/apply/navigation";
import { Passport } from "~/components/apply/passport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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
      <main className="flex max-h-screen flex-col items-center bg-primary-50">
        <div className="fixed bg-primary-50">
          <ApplyNavbar />
          <Tabs defaultValue="application" className="w-screen md:hidden">
            <TabsList className="flex w-screen justify-around bg-primary-100">
              <TabsTrigger
                value="application"
                className="m-0 w-1/2 rounded-none border-primary-600 px-0 py-2.5 hover:bg-primary-200 data-[state=active]:border-b data-[state=active]:bg-primary-100 data-[state=active]:text-primary-600 data-[state=active]:shadow-none"
              >
                Application
              </TabsTrigger>
              <TabsTrigger
                value="passport"
                className="m-0 w-1/2 rounded-none border-primary-600 px-0 py-2.5 hover:bg-primary-200 data-[state=active]:border-b data-[state=active]:bg-primary-100 data-[state=active]:text-primary-600 data-[state=active]:shadow-none"
              >
                Passport
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="application"
              className="min-w-screen max-w-screen mt-0 overflow-auto"
            >
              <div
                id="left-panel"
                className="flex h-screen flex-grow flex-col space-y-8 bg-primary-100 p-9"
              >
                <div className="space-y-2">
                  <h1 className="text-2xl font-medium">{heading}</h1>
                  <h2 className="text-sm text-slate-500">{subheading}</h2>
                </div>
                <div className=" overflow-y-auto">
                  <ApplyForm step={step} />
                </div>
                <div className="select-none bg-primary-100 py-12 text-primary-100">
                  this is a secret
                </div>
              </div>
            </TabsContent>
            <TabsContent
              value="passport"
              className="flex flex-col justify-center"
            >
              <div
                id="right-panel"
                className="flex h-[70vh] w-screen flex-col items-center justify-center px-4 md:w-[60vw]"
              >
                <Passport />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="hidden w-full flex-grow items-center md:flex">
          <div
            id="left-panel"
            className="flex h-screen flex-grow flex-col justify-between space-y-8 overflow-auto bg-primary-100 p-9 pb-20 pt-24 md:w-2/3 2xl:w-1/2"
          >
            <div className="space-y-2 p-1">
              <h1 className="text-2xl font-medium">{heading}</h1>
              <h2 className="text-sm lg:text-base text-slate-500">{subheading}</h2>
              <ApplyForm step={step} />
            </div>
            <ApplyNavigation step={step} />
          </div>
          <div
            id="right-panel"
            className="flex flex-col items-center justify-center px-4 md:w-full"
          >
            <Passport />
          </div>
        </div>
        <ApplyMenu step={step} />
      </main>
    </>
  );
}

import React from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { ApplyForm } from "~/components/apply/form";
import { Passport } from "~/components/apply/passport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SavedIndicator } from "~/components/apply/saved-indicator";
import { notVerifiedRedirect } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";
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
      <main className="bg-hw-linear-gradient-day flex h-screen flex-col items-center bg-primary-50 overscroll-contain">
        {/* Mobile View */}
        <Tabs defaultValue="application" className="w-screen pt-16 md:hidden">
          <TabsList className="fixed z-50 w-screen justify-around rounded-none bg-primary-100">
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
          <TabsContent value="application" className="z-40 w-screen">
            <div className="fixed flex h-screen w-screen flex-col space-y-8 bg-primary-100 px-6 pt-12">
              <div className="space-y-2 py-1.5">
                <h1 className="text-2xl font-medium">{heading}</h1>
                <h2 className="text-sm text-slate-500">{subheading}</h2>
              </div>
              <div className="overflow-y-auto">
                <ApplyForm step={step} />
              </div>
              <div className="self-end pb-3">
                <SavedIndicator />
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
            <div className="flex h-[85vh] w-screen flex-col items-center justify-center px-4">
              <Passport />
            </div>
            <CanvasBackground />
          </TabsContent>
        </Tabs>
        {/* End of Mobile View */}

        {/* Desktop View */}
        <div className="relative z-10 hidden w-full flex-grow items-center md:flex">
          <div
            id="left-panel"
            className="z-30 flex h-full w-1/5 items-center justify-center"
          >
            <ApplyMenu step={step} />
          </div>
          <div
            id="right-panel"
            className="bg-hw-linear-gradient-day flex h-full flex-col items-center justify-center px-4 md:w-full"
          >
            <CanvasBackground />
            <div className="z-10 flex flex-col items-center justify-center overflow-contain">
              <div className="space-y-4">
                <div className="h-[400px] w-[800px] flex flex-col space-y-8 justify-between rounded-md shadow-lg bg-white py-12 pl-12 pr-8 overflow-auto">
                  <div className="overflow-auto pr-4 scrollbar">
                    <div className="space-y-2 py-1.5">
                      <h1 className="text-2xl font-medium text-heavy font-dico">{heading}</h1>
                      <h2 className="text-sm text-medium font-figtree">{subheading}</h2>
                    </div>
                    <div className="font-figtree">
                      <ApplyForm step={step} />
                    </div>
                  </div>
                </div>
                <ApplyNavigation step={step} />
              </div>
              
              <div className="z-10 flex w-[100%] flex-col items-center justify-center">
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
        {/* End of Desktop View */}
      </main>
    </>
  );
}

export const getServerSideProps = notVerifiedRedirect;

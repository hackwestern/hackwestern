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
import Image from "next/image";
import { SavedIndicator } from "~/components/apply/saved-indicator";
import { authRedirectHacker } from "~/utils/redirect";

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
      <main className="flex h-screen flex-col items-center bg-primary-50 bg-hw-linear-gradient-day">
        <div className="fixed z-20 bg-primary-50">
          <ApplyNavbar />
        </div>
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
            {/* Clouds */}
            <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
              <Image
                src="/images/cloud5.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-full md:h-[90%] md:w-[70%] lg:h-[100%]">
              <Image
                src="/images/cloud6.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
              <Image
                src="/images/cloud7.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[40%] lg:h-[50%] lg:w-[30%]">
              <Image
                src="/images/cloud8.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            {/* Stars */}
            <div className="absolute bottom-[24%] left-[20%] h-full w-[20%] md:w-[10%] lg:w-[5%]">
              <Image
                src="/images/star.svg"
                alt="hack western star"
                className="object-contain"
                fill
              />
            </div>
            <div className="absolute bottom-[30%] right-[25%] h-full w-[15%] md:w-[7%] lg:w-[3%]">
              <Image
                src="/images/star.svg"
                alt="hack western star"
                className="object-contain"
                fill
              />
            </div>
            {/* Grain Filter */}
            <Image
              className="absolute left-0 top-0 opacity-20"
              src="/images/hwfilter.png"
              alt="Hack Western Main Page"
              layout="fill"
              objectFit="cover"
            />
          </TabsContent>
        </Tabs>
        <div className="relative z-10 hidden w-full flex-grow items-center md:flex">
          <div
            id="left-panel"
            className="z-10 flex h-screen flex-grow flex-col justify-between space-y-8 overflow-auto bg-primary-100 p-9 pb-[4.1rem] pt-24 md:w-2/3 2xl:w-1/2"
          >
            <div className="space-y-2 p-1">
              <h1 className="text-2xl font-medium">{heading}</h1>
              <h2 className="text-sm text-slate-500 lg:text-base">
                {subheading}
              </h2>
              <ApplyForm step={step} />
            </div>
            <ApplyNavigation step={step} />
          </div>
          <div
            id="right-panel"
            className="flex h-full flex-col items-center justify-center bg-hw-linear-gradient-day px-4 md:w-full"
          >
            {/* Clouds */}
            <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
              <Image
                src="/images/cloud5.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-full md:h-[90%] md:w-[70%] lg:h-[100%]">
              <Image
                src="/images/cloud6.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
              <Image
                src="/images/cloud7.svg"
                alt="hack western cloud"
                className="object-contain object-left-bottom"
                fill
              />
            </div>
            <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[40%] lg:h-[50%] lg:w-[30%]">
              <Image
                src="/images/cloud8.svg"
                alt="hack western cloud"
                className="object-contain object-right-bottom"
                fill
              />
            </div>
            {/* Stars */}
            <div className="absolute bottom-[20%] left-[20%] h-full w-[20%] md:w-[10%] lg:w-[5%]">
              <Image
                src="/images/star.svg"
                alt="hack western star"
                className="object-contain"
                fill
              />
            </div>
            <div className="absolute bottom-[40%] right-[10%] h-full w-[15%] md:w-[7%] lg:w-[3%]">
              <Image
                src="/images/star.svg"
                alt="hack western star"
                className="object-contain"
                fill
              />
            </div>
            <div className="absolute bottom-[25%] right-[15%] h-full w-[20%] md:w-[10%] lg:w-[5%] ">
              <Image
                src="/images/star2.svg"
                alt="hack western star"
                className="object-contain"
                fill
              />
            </div>
            {/* Grain Filter */}
            <Image
              className="absolute left-0 top-0 opacity-20"
              src="/images/hwfilter.png"
              alt="Hack Western Main Page"
              layout="fill"
              objectFit="cover"
            />
            <div className="z-10 flex w-[100%] flex-col items-center justify-center">
              <Passport />
            </div>
          </div>
        </div>
        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center">
          <ApplyMenu step={step} />
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectHacker;

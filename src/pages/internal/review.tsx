import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { SavedIndicator } from "~/components/apply/saved-indicator";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/utils/api";
import Image from "next/image";
import Link from "next/link";
import { authRedirectOrganizer } from "~/utils/redirect";
import type { z } from "zod";
import { useForm } from "react-hook-form";

import { reviewSaveSchema } from "~/schemas/review";
import { zodResolver } from "@hookform/resolvers/zod";

const Review = () => {
  const utils = api.useUtils();
  const { mutate } = api.review.save.useMutation();
  const searchParams = useSearchParams();
  const applicantId = searchParams.get("applicant");
  const { data: applicationData } = api.application.getById.useQuery({
    userId: applicantId,
  });

  const form = useForm<z.infer<typeof reviewSaveSchema>>({
    resolver: zodResolver(reviewSaveSchema),
  });

  const onSubmit = (data: z.infer<typeof reviewSaveSchema>) => {
    mutate({
      ...data,
    });
  };

  const heading = "Heading";
  const subheading = "Subheading";

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
            <div className="flex h-[85vh] w-screen flex-col items-center justify-center px-4"></div>
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
            className="z-10 flex h-screen flex-grow flex-col justify-between space-y-8 overflow-auto bg-primary-100 p-9 pb-[4.1rem] md:w-2/3 2xl:w-1/2"
          >
            <div className="space-y-2 p-1">
              <nav className="flex px-1 pb-3">
                <Button
                  className="mx-0 px-0 text-lg text-primary-600"
                  variant="link"
                  asChild
                >
                  <Link href="/internal/dashboard">Dashboard</Link>
                </Button>
              </nav>
              <h1 className="text-2xl font-medium">heading</h1>
              <h2 className="text-sm text-slate-500 lg:text-base">
                subheading
              </h2>
            </div>
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
            <div className="z-10 flex w-[100%] flex-col items-center justify-center text-sm">
              <div className="z-50 flex w-11/12 flex-col justify-center overflow-y-auto rounded-[10px] border border-primary-300 bg-primary-100 p-8 2xl:w-3/5 3xl:w-2/5 4xl:w-1/3">
                <div className="text-base">{`${applicationData?.firstName} ${applicationData?.lastName}`}</div>
                <div className="pt-3 font-semibold">
                  If you could have any superpower to help you during Hack
                  Western, what would it be and why?
                </div>
                <div>{applicationData?.question1}</div>
                <div className="pt-3 font-semibold">
                  If you could build your own dream destination what would it
                  look like? Be as detailed and creative as you want!
                </div>
                <div>{applicationData?.question2}</div>
                <div className="pt-3 font-semibold">
                  What project (anything you have ever worked on not just
                  restricted to tech) of yours are you the most proud of and
                  why? What did you learn throughout the process?
                </div>
                <div>{applicationData?.question3}</div>
                <div className="pt-3 font-semibold">Links</div>
                <div className="flex">
                  {["githubLink", "linkedInLink", "otherLink", "resumeLink"]
                    .map((link) => link as keyof typeof applicationData)
                    .map((link) => {
                      if (applicationData?.[link]) {
                        return (
                          <Button variant="link" key={link} className="pl-0">
                            <a
                              href={applicationData[link]}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {linkName(link)}
                            </a>
                          </Button>
                        );
                      }
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

const linkName = (link: string) => {
  switch (link) {
    case "githubLink":
      return "GitHub";
    case "linkedInLink":
      return "LinkedIn";
    case "otherLink":
      return "Other";
    case "resumeLink":
      return "Resume";
  }
};

export default Review;
export const getServerSideProps = authRedirectOrganizer;

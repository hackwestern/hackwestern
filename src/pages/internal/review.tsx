import Head from "next/head";
import { useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { api } from "~/utils/api";
import Link from "next/link";
import { authRedirectOrganizer } from "~/utils/redirect";
import type { z } from "zod";
import { reviewSaveSchema } from "~/schemas/review";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAutoSave } from "~/hooks/use-auto-save";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { SavedIndicator } from "~/components/apply/saved-indicator";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { useSession } from "next-auth/react";
import CanvasBackground from "~/components/canvas-background";
import { AvatarDisplay } from "~/components/apply/avatar-display";
import { colors } from "~/constants/avatar";
import type { CanvasPaths } from "~/types/canvas";
import {
  QUESTION1,
  QUESTION2,
  QUESTION3,
} from "~/components/apply/form/application-form";

const Review = () => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const applicantId = searchParams.get("applicant");
  const { data: applicationData } = api.application.getById.useQuery({
    applicantId,
  });
  const { data: reviewData } = api.review.getById.useQuery({ applicantId });
  const { mutate } = api.review.save.useMutation({
    onSuccess: () => {
      return utils.review.getById.invalidate();
    },
  });
  const { data: nextId } = api.review.getNextId.useQuery({
    skipId: applicantId,
  });

  const form = useForm<z.infer<typeof reviewSaveSchema>>({
    resolver: zodResolver(reviewSaveSchema),
  });

  // on applicant id change (new applicant), reset form
  useEffect(() => {
    if (applicantId) {
      form.reset({
        applicantUserId: applicantId,
        originalityRating: reviewData?.originalityRating ?? 0,
        technicalityRating: reviewData?.technicalityRating ?? 0,
        passionRating: reviewData?.passionRating ?? 0,
        comments: reviewData?.comments ?? "",
      });
    }
  }, [
    applicantId,
    session,
    form,
    reviewData?.comments,
    reviewData?.originalityRating,
    reviewData?.passionRating,
    reviewData?.technicalityRating,
  ]);

  const onSubmit = (data: z.infer<typeof reviewSaveSchema>) => {
    mutate({
      ...data,
    });
  };

  useAutoSave(form, onSubmit, reviewData);

  const { data: reviewCount } = api.review.getReviewCounts.useQuery();
  const { data: allReviews } = api.review.getByOrganizer.useQuery();
  const completedReviews = allReviews?.filter((review) => review.completed);

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
      <main className=" font-figtreen flex flex-col items-center bg-primary-50 font-figtree">
        <div className="relative z-[100] w-full items-center md:flex">
          <div
            id="left-panel"
            className="flex flex-grow flex-col justify-between space-y-8 overflow-auto bg-primary-100 p-9 pb-[4.1rem] md:h-screen md:w-2/3 2xl:w-1/2"
          >
            <div className="space-y-2 p-1">
              <nav className="flex px-1">
                <Button
                  className="mx-0 px-0 text-lg text-primary-600"
                  variant="link"
                  asChild
                >
                  <Link href="/internal/dashboard">Back to Dashboard</Link>
                </Button>
              </nav>
              <div className="flex justify-around">
                <div>
                  <h1 className="text-2xl font-medium">Review Guidelines</h1>
                  <ul className="my-4 ml-2 list-disc text-sm text-slate-500 lg:text-base">
                    <li>Create a supportive, diverse, and curious community</li>
                    <li>Accept by merit, aim for equality</li>
                    <li>
                      Uphold our duty to select deserving individuals fairly and
                      without bias
                    </li>
                    <li>
                      Hover over the emojis{" "}
                      <Tooltip>
                        <TooltipTrigger>🤑</TooltipTrigger>
                        <TooltipContent>They have tooltips!</TooltipContent>
                      </Tooltip>
                    </li>
                  </ul>
                </div>
                {reviewCount && (
                  <div className="mx-auto w-1/3 text-center font-jetbrains-mono">
                    <h1 className="text-sm font-semibold">Leaderboard</h1>
                    <ul className="w-full text-left text-sm">
                      <li>
                        🥇 {reviewCount[0]?.reviewerName}{" "}
                        {reviewCount[0]?.reviewCount}
                      </li>
                      <li>
                        🥈 {reviewCount[1]?.reviewerName}{" "}
                        {reviewCount[1]?.reviewCount}
                      </li>
                      <li>
                        🥉 {reviewCount[2]?.reviewerName}{" "}
                        {reviewCount[2]?.reviewCount}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              <div>
                This is your {postfix((completedReviews?.length ?? 0) + 1)}{" "}
                review!
              </div>

              {reviewData && (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-2 pt-5"
                  >
                    <FormField
                      control={form.control}
                      name="originalityRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xl">Originality</FormLabel>
                          <FormControl>
                            <div className="flex text-lg">
                              <Tooltip>
                                <TooltipTrigger>🙄</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>Very lame</li>
                                    <li>Same projects as everyone else</li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                              <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(values) => {
                                  field.onChange(values[0]);
                                }}
                              />
                              <Tooltip>
                                <TooltipTrigger>🤩</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>Novel: ideas are unique!</li>
                                    <li>
                                      Creative: out-of-the-box thinking,
                                      creative problem solving techniques
                                    </li>
                                    <li>
                                      Ownership: their OWN work, could be a team
                                      effort, but still showcases personal
                                      experiences
                                    </li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="technicalityRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xl">
                            Technicality
                          </FormLabel>
                          <FormControl>
                            <div className="flex text-lg">
                              <Tooltip>
                                <TooltipTrigger>😵‍💫</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>Resume shows no relevant experience</li>
                                    <li>
                                      No github or barren github (less relevant
                                      than resume)
                                    </li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                              <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(values) => {
                                  field.onChange(values[0]);
                                }}
                              />
                              <Tooltip>
                                <TooltipTrigger>🤓</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>
                                      Projects: Multiple projects and Git
                                      commits consistently spread across a long
                                      period of time and all projects have high
                                      quality and usability
                                    </li>
                                    <li>
                                      Resume: Held technical positions in
                                      clubs/internships and resume shows strong
                                      technical experience
                                    </li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passionRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xl">
                            Passion and Potential
                          </FormLabel>
                          <FormControl>
                            <div className="flex text-lg">
                              <Tooltip>
                                <TooltipTrigger>😴</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>
                                      <b>BORINGGGGGGGGGGGG</b> (respectfully)
                                    </li>
                                    <li>Thank you, NEXT (respectfully)</li>
                                    <li>
                                      Short ass responses that have no thought
                                      (not respectfully)
                                    </li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                              <Slider
                                value={[field.value ?? 0]}
                                onValueChange={(values) => {
                                  field.onChange(values[0]);
                                }}
                              />
                              <Tooltip>
                                <TooltipTrigger>🔥</TooltipTrigger>
                                <TooltipContent>
                                  <ul className="max-w-96 list-disc px-3">
                                    <li>
                                      Interest in tech: Strong personal interest
                                      in technology and hackathons
                                    </li>
                                    <li>
                                      Character: Cares about leaving a
                                      meaningful impact and seems like a good
                                      fun person :D
                                    </li>
                                    <li>
                                      Preparation: Well-thought-out long answers
                                      and uses the word limit effectively
                                    </li>
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xl">
                            Additional Comments (these are only visible to you)
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              placeholder="Additional Comments"
                              variant="primary"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}
              <SavedIndicator />
            </div>
            <div className="flex justify-end">
              {nextId && (
                <Link href={`/internal/review?applicant=${nextId}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="primary"
                        disabled={form.formState.isSubmitting}
                        onClick={() => {
                          toast({
                            title: "starting next review",
                          });
                        }}
                      >
                        {reviewData?.completed ? "Next" : "Skip"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{nextId}</TooltipContent>
                  </Tooltip>
                </Link>
              )}
            </div>
          </div>

          <div
            id="right-panel"
            className="-z-10 flex max-h-[96vh] flex-col items-center justify-center overflow-hidden rounded-xl bg-primary-50 px-4 py-4 md:w-full"
          >
            <div className="-z-10">
              <CanvasBackground />
            </div>

            <div className="z-10 my-8 flex h-[90vh] flex-col items-center justify-center overflow-auto overflow-auto rounded-xl border border-primary-300 bg-primary-100 pl-8 text-sm md:my-auto md:max-w-[800px]">
              {applicationData ? (
                <div className="custom-scroll z-50 flex h-[90vh] flex-col overflow-auto rounded-[10px] rounded-lg px-2 py-4 font-figtree">
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="mt-4 text-base">{`${applicationData?.firstName} ${applicationData?.lastName}`}</div>
                    </TooltipTrigger>
                    <TooltipContent className="font-jetbrains-mono">
                      {`User ID: ${applicationData?.userId}`}
                    </TooltipContent>
                  </Tooltip>

                  <div className="ml-8 flex flex-col justify-center md:flex-row">
                    {/* Avatar Section */}
                    {applicationData && (
                      <div className="mt-4 space-y-2">
                        <div className="flex h-64 w-64 justify-center">
                          <div
                            className="flex h-64 w-64 flex-col justify-center rounded-2xl p-4 pt-8"
                            style={{
                              background: `linear-gradient(135deg, ${
                                colors.find(
                                  (c) =>
                                    c.name ===
                                    (applicationData.avatarColour ?? "green"),
                                )?.bg ?? "#F1FDE0"
                              } 30%, ${
                                colors.find(
                                  (c) =>
                                    c.name ===
                                    (applicationData.avatarColour ?? "green"),
                                )?.gradient ?? "#A7FB73"
                              } 95%)`,
                            }}
                          >
                            <div className="mt-10 flex scale-75 items-center justify-center">
                              <AvatarDisplay
                                avatarColour={applicationData.avatarColour}
                                avatarFace={applicationData.avatarFace}
                                avatarLeftHand={applicationData.avatarLeftHand}
                                avatarRightHand={
                                  applicationData.avatarRightHand
                                }
                                avatarHat={applicationData.avatarHat}
                                size="lg"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Canvas Section */}
                    {applicationData &&
                      (() => {
                        type CanvasData = {
                          paths: CanvasPaths;
                          timestamp: number;
                          version: string;
                        };

                        const canvasData = applicationData.canvasData as
                          | CanvasData
                          | null
                          | undefined;
                        const pathStrings =
                          canvasData?.paths?.map((path) =>
                            path.reduce((acc, point, index) => {
                              if (index === 0)
                                return `M ${point[0]} ${point[1]}`;
                              return `${acc} L ${point[0]} ${point[1]}`;
                            }, ""),
                          ) ?? [];

                        // Get the stroke color based on avatar color (same logic as SimpleCanvas)
                        const selectedColour = colors.find(
                          (color) =>
                            color.name === applicationData.avatarColour,
                        )?.value;
                        const strokeColour = selectedColour
                          ? selectedColour + "dd"
                          : "#a16bc7";

                        return (
                          <div className="mt-4 space-y-2">
                            {pathStrings.length > 0 ? (
                              <div className="flex justify-center">
                                <div className="-mt-8 h-80 w-80 scale-[0.78] overflow-hidden rounded-lg border-2 border-primary-300 bg-white">
                                  <svg className="h-full w-full">
                                    {pathStrings.map(
                                      (pathString, pathIndex) => (
                                        <path
                                          key={pathIndex}
                                          d={pathString}
                                          stroke={strokeColour}
                                          strokeWidth="4"
                                          fill="none"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      ),
                                    )}
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <p className="text-sm text-primary-600">
                                  (no drawing)
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>

                  <div className="flex justify-center text-center">
                    {["githubLink", "linkedInLink", "otherLink", "resumeLink"]
                      .map((link) => link as keyof typeof applicationData)
                      .map((link) => {
                        if (applicationData?.[link]) {
                          return (
                            <Button
                              variant="link"
                              key={link}
                              className="my-0 pl-0 pt-0 text-primary-600"
                            >
                              <a
                                href={applicationData?.[link] as string}
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
                  <div className="pt-3 font-semibold">{QUESTION1}</div>
                  <div>{applicationData?.question1}</div>
                  <div className="pt-3 font-semibold">{QUESTION2}</div>
                  <div>{applicationData?.question2}</div>
                  <div className="pt-3 font-semibold">{QUESTION3}</div>
                  <div>{applicationData?.question3}</div>
                </div>
              ) : (
                <div className="sm:w-80 md:w-[600px]"></div>
              )}
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

const postfix = (num: number) => {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${num}th`;
  }

  switch (lastDigit) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
};

export default Review;
export const getServerSideProps = authRedirectOrganizer;

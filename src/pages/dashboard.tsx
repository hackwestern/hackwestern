import { signOut } from "next-auth/react";
import Head from "next/head";
// removed unused useRouter import
import { useSearchParams } from "next/navigation";
import React from "react";
import Logout from "~/pages/logout";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { colors } from "~/constants/avatar";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { notVerifiedRedirectDashboard } from "~/utils/redirect";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { isPastDeadline } from "~/lib/date";
import CanvasBackground from "~/components/canvas-background";
import { APPLICATION_DEADLINE_ISO } from "~/lib/date";
import { AvatarDisplay } from "~/components/apply/avatar-display";
import {
  MajorStamp,
  SchoolStamp,
  HackerStamp,
  HWStamp,
  LinksStamp,
} from "~/components/apply/stamp";
import dynamic from "next/dynamic";

const CountdownTimer = dynamic(
  () => import("~/components/apply/countdown-timer"),
  {
    ssr: false,
  },
);

type ApplicationStatusType =
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED"
  | "DECLINED";

const parsedStatuses = {
  IN_PROGRESS: "Application In Progress...",
  INCOMPLETE: isPastDeadline()
    ? "Applications Closed."
    : "Application Incomplete.",
  PENDING_REVIEW: "Application Submitted!",
  IN_REVIEW: "Application In Review",
  ACCEPTED: "Application Accepted! 🥳",
  REJECTED: "Application Not Accepted",
  WAITLISTED: "Waitlisted",
  DECLINED: "You're Not Coming :(",
};

function getParsedStatus(status: ApplicationStatusType) {
  const pastDeadline = isPastDeadline();
  if (pastDeadline && status === "IN_PROGRESS") {
    return parsedStatuses.INCOMPLETE;
  }

  return parsedStatuses[status];
}

const statusClassName = {
  IN_PROGRESS: "bg-primary-200 text-violet-500",
  PENDING_REVIEW: "bg-primary-300 border border-primary-600 text-primary-600",
  IN_REVIEW: "bg-primary-300 border border-primary-600 text-primary-600",
  ACCEPTED: "bg-primary-500 text-primary-100",
  REJECTED: "bg-violet-500 text-primary-100",
  WAITLISTED: "bg-violet-500 text-primary-100",
  DECLINED: "bg-violet-500 text-primary-100",
};

const ApplicationStatus = ({ status }: { status: ApplicationStatusType }) => {
  return (
    <div
      className={cn(
        "mx-auto flex w-max select-none justify-center rounded-full px-10 py-2.5 text-center text-xl font-medium capitalize",
        statusClassName[status ?? "IN_PROGRESS"],
      )}
    >
      {getParsedStatus(status ?? "IN_PROGRESS")}
    </div>
  );
};

const buttonStatus = (status: ApplicationStatusType) => {
  const parsedStatuses = {
    IN_PROGRESS: "Continue Your Application",
    PENDING_REVIEW: "View Application",
    IN_REVIEW: "View Application",
    ACCEPTED: "RSVP by XXXX",
    REJECTED: "",
    WAITLISTED: "View Application",
    DECLINED: "Change RSVP",
  };

  return parsedStatuses?.[status ?? "IN_PROGRESS"];
};

function getApplyLink(status: ApplicationStatusType | undefined) {
  switch (status) {
    case "IN_PROGRESS":
      return "/apply?step=character";
    case "PENDING_REVIEW":
      return "/apply?step=review";
    default:
      return "/apply?step=character";
  }
}

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  return applySteps.find((s) => s.step === stepValue) ?? null;
}

function getNextIncompleteStep(
  application: Record<string, unknown> | null | undefined,
) {
  // application may be null/unset — start at first step
  if (!application) return applySteps[0].step;

  const isEmpty = (v: unknown) =>
    v === null || v === undefined || (typeof v === "string" && v.trim() === "");

  for (const step of applySteps) {
    if (step.step === "review") continue; // review is final

    switch (step.step) {
      case "character": {
        if (
          isEmpty(application.avatarColour) ||
          isEmpty(application.avatarFace) ||
          isEmpty(application.avatarLeftHand) ||
          isEmpty(application.avatarRightHand) ||
          isEmpty(application.avatarHat)
        )
          return step.step;
        break;
      }
      case "basics": {
        if (
          isEmpty(application.firstName) ||
          isEmpty(application.lastName) ||
          isEmpty(application.phoneNumber) ||
          isEmpty(application.age) ||
          isEmpty(application.countryOfResidence)
        )
          return step.step;
        break;
      }
      case "info": {
        if (
          isEmpty(application.school) ||
          isEmpty(application.levelOfStudy) ||
          isEmpty(application.major) ||
          isEmpty(application.attendedBefore) ||
          isEmpty(application.numOfHackathons)
        )
          return step.step;
        break;
      }
      case "application": {
        if (
          isEmpty(application.question1) ||
          isEmpty(application.question2) ||
          isEmpty(application.question3)
        )
          return step.step;
        break;
      }
      case "links": {
        // require at least resumeLink (submission schema expects a resume)
        if (isEmpty(application.resumeLink)) return step.step;
        break;
      }
      case "agreements": {
        if (
          application.agreeCodeOfConduct !== true ||
          application.agreeShareWithMLH !== true ||
          application.agreeShareWithSponsors !== true ||
          application.agreeWillBe18 !== true
        )
          return step.step;
        break;
      }
      // optional/canvas are truly optional; skip their checks
      default:
        break;
    }
  }

  // nothing incomplete — go to review
  return "review";
}

// Small character component for mobile header
function MobileCharacterIcon() {
  const { data: applicationData } = api.application.get.useQuery();
  const name = applicationData?.firstName ?? "Username";

  const bodyColor =
    colors.find((c) => c.name === applicationData?.avatarColour)?.body ?? "002";

  const selectedColor = colors.find(
    (c) => c.name === (applicationData?.avatarColour ?? "green"),
  );

  // Popover trigger wraps the avatar (or emoji) to open the small menu
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="relative h-8 w-8 p-2 overflow-hidden rounded-full"
          style={{
            background: `linear-gradient(135deg, ${selectedColor?.bg ?? "#F1FDE0"} 30%, ${selectedColor?.gradient ?? "#A7FB73"} 95%)`,
          }}
        >
          {/* eslint-disable @next/next/no-img-element */}
          {applicationData?.avatarColour ? (
            <img
              src={`/avatar/body/${bodyColor}.webp`}
              alt="Character"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-sm">🎨</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="mr-4 mt-2 w-48 bg-offwhite p-4 font-figtree">
        <div className="rounded-md">
          <h3 className="mb-3 text-sm font-medium text-medium">
            {name == "Username" ? "Hello, hacker" : `Hi, ${name}`}!
          </h3>
          <div className="mb-4 h-px w-full bg-violet-200" />

          <div className="mb-3 font-figtree text-heavy">
            <Link href="/dashboard">Home</Link>
          </div>

          <div>
            <button
              className="font-figtree text-sm text-heavy underline"
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const Dashboard = () => {
  const { data: application } = api.application.get.useQuery();
  const status = application?.status ?? "NOT_STARTED";
  // router not used in this component

  const selectedColor = colors.find(
    (c) => c.name === (application?.avatarColour ?? "green"),
  );

  type CanvasData = {
    paths: Array<Array<{ x: number; y: number }>>;
    timestamp: number;
    version: string;
  };

  const canvasData = application?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        return `${acc} L ${point.x} ${point.y}`;
      }, ""),
    ) ?? [];

  const searchParams = useSearchParams();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step")),
    [searchParams],
  );

  const step = applyStep?.step ?? null;

  const continueStep = getNextIncompleteStep(application);

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
      <main className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-y-hidden">
        {/* Mobile View */}
        <div className="relative z-10 flex h-screen w-screen flex-col md:hidden">
          {/* Mobile Header */}
          <div className="fixed z-[99] flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
            <div className="h-8 w-8" />
            <h1 className="font-figtree text-sm font-semibold text-heavy">
              Home
            </h1>
            <div className="flex h-8 w-8 items-center justify-center">
              <ApplyMenu step={step} />
              <MobileCharacterIcon />
            </div>
          </div>

          {/* Mobile Content */}
          {status == "NOT_STARTED" || status == "IN_PROGRESS" ? (
            <div className="flex w-full flex-1 flex-col items-center justify-center bg-white px-6 py-20">
              <div className="z-[99] w-full max-w-md space-y-8 text-center">
                <div>
                  <h1 className="font-dico text-3xl font-medium text-heavy">
                    Hack Western 12
                  </h1>
                  <h2 className="font-dico text-3xl font-medium text-heavy">
                    Application
                  </h2>
                </div>
                <div>
                  <CountdownTimer targetDate={APPLICATION_DEADLINE_ISO} />
                </div>
                <div>
                  <Button
                    variant="primary"
                    className="w-full p-4 font-figtree text-base font-medium"
                  >
                    <Link href={`/apply?step=${continueStep}`}>
                      {status == "NOT_STARTED"
                        ? "Start Application"
                        : status == "IN_PROGRESS"
                          ? "Continue Application"
                          : "Review Application"}
                    </Link>
                  </Button>
                </div>
              </div>
              <CanvasBackground />
            </div>
          ) : (
            <div className="flex h-svh flex-col">
              <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
                <CanvasBackground />
                <div className="relative m-5 flex flex-col items-center gap-6 rounded-lg bg-violet-100 p-10">
                  <div className="flex flex-col gap-6">
                    <h2 className="font-dico text-4xl font-semibold text-heavy ">
                      Your application has been submitted!
                    </h2>
                    <h4 className="font-figtree text-heavy">
                      Thanks for applying to Hack Western XII,{" "}
                      {application?.firstName}!
                    </h4>
                    <p className="font-figtree text-heavy">
                      You&apos;ll hear back from us about your status in a few
                      weeks!
                    </p>
                  </div>
                  <div
                    className="h-full w-full rounded-lg"
                    style={{
                      background: `${selectedColor?.bg} 30%`,
                    }}
                  >
                    <div className="relative h-80 w-80 rounded-lg">
                      {pathStrings.length > 0 && (
                        <svg className="h-80 w-80">
                          {pathStrings.map((pathString, pathIndex) => (
                            <path
                              key={pathIndex}
                              d={pathString}
                              stroke={selectedColor?.gradient ?? "#a16bc7"}
                              strokeWidth="4"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ))}
                        </svg>
                      )}
                      <div className="absolute right-6 top-1/2 z-[1000] flex -translate-y-1/2 flex-col items-end gap-4">
                        <div className="-right-2 rounded-full border border-heavy px-2 py-1 font-jetbrains-mono text-xs">
                          HACK WESTERN XII
                        </div>
                        <h1 className="z-[1000] font-dico text-3xl text-heavy">
                          {`${application?.firstName ?? "Hacker"} ${application?.lastName ?? ""}`}
                        </h1>
                      </div>
                      {application?.avatarColour && (
                        <div className="absolute left-2 top-4 -ml-8 mb-4 mr-6 h-36 w-36 scale-[0.3] self-center">
                          <AvatarDisplay
                            avatarColour={application?.avatarColour}
                            avatarFace={application?.avatarFace}
                            avatarLeftHand={application?.avatarLeftHand}
                            avatarRightHand={application?.avatarRightHand}
                            avatarHat={application?.avatarHat}
                            size="lg"
                          />
                        </div>
                      )}
                      <div className="absolute -right-4 bottom-[2] scale-[0.5]">
                        <SchoolStamp type={application?.school} />
                      </div>
                      <div className="absolute bottom-3 right-24 scale-[0.7]">
                        <MajorStamp type={application?.major} />
                      </div>
                      {application?.attendedBefore !== undefined &&
                        application?.attendedBefore !== null && (
                          <div className="absolute left-52 top-3 scale-[0.9]">
                            <HWStamp
                              returning={
                                application?.attendedBefore
                                  ? "returnee"
                                  : "newcomer"
                              }
                            />
                          </div>
                        )}
                      <div className="absolute bottom-12 left-4 scale-[0.7]">
                        <HackerStamp
                          numHackathons={application?.numOfHackathons}
                        />
                      </div>

                      {application?.githubLink &&
                        application?.linkedInLink &&
                        application?.otherLink &&
                        application?.resumeLink && (
                          <div className="absolute left-28 top-4 scale-[0.9]">
                            <LinksStamp />
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* End of Mobile View */}

        {/* Desktop View */}
        {status == "NOT_STARTED" || status == "IN_PROGRESS" ? (
          <>
            <div className="relative z-10 hidden h-full w-full flex-grow items-center md:flex">
              <div
                id="left-panel"
                className="z-30 flex h-full items-center justify-center"
              >
                <ApplyMenu step={step} />
              </div>
              <div
                id="right-panel"
                className="bg-hw-linear-gradient-day flex h-full w-full flex-col items-center justify-center px-4"
              >
                <CanvasBackground />
                <div className="absolute right-6 top-6 flex items-center gap-4 z-[100]">
                  <Logout />
                  <MobileCharacterIcon />
                </div>
                <div className="z-10 flex flex-col items-center justify-center overflow-auto">
                  <div className="flex h-full w-full flex-col items-center">
                    <div className="space-y-12">
                      <div>
                        <h1 className="flex flex-col items-center font-dico text-6xl font-medium text-heavy">
                          Hack Western 12
                        </h1>
                        <h1 className=" flex flex-col items-center font-dico text-6xl font-medium text-heavy">
                          Application
                        </h1>
                      </div>
                      <h2 className="flex flex-col items-center">
                        <CountdownTimer targetDate={APPLICATION_DEADLINE_ISO} />
                      </h2>
                      <div className="flex flex-col items-center">
                        <Button
                          variant="primary"
                          className="w-full p-6 font-figtree text-base font-medium"
                        >
                          <Link href={`/apply?step=${continueStep}`}>
                            {status == "NOT_STARTED"
                              ? "Start Application"
                              : status == "IN_PROGRESS"
                                ? "Continue Application"
                                : "Review Application"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden flex-grow md:flex h-svh w-svw flex-col">
            <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
              <div className="absolute right-6 top-6 flex items-center gap-4 z-[100]">
                <Logout />
                <MobileCharacterIcon />
              </div>
              <CanvasBackground />
              <div className="relative m-5 flex flex-row items-center gap-6 rounded-lg bg-violet-100 p-10">
                <div className="flex flex-col gap-6">
                  <h2 className="font-dico text-4xl font-semibold text-heavy ">
                    Your application has been submitted!
                  </h2>
                  <h4 className="font-figtree text-heavy">
                    Thanks for applying to Hack Western XII,{" "}
                    {application?.firstName}!
                  </h4>
                  <p className="font-figtree text-heavy">
                    You&apos;ll hear back from us about your status in a few
                    weeks!
                  </p>
                </div>
                <div
                  className="h-80 w-80 rounded-lg"
                  style={{
                    background: `${selectedColor?.bg} 30%`,
                  }}
                >
                  <div className="relative h-80 w-80 rounded-lg">
                    {pathStrings.length > 0 && (
                      <svg className="h-80 w-80">
                        {pathStrings.map((pathString, pathIndex) => (
                          <path
                            key={pathIndex}
                            d={pathString}
                            stroke={selectedColor?.gradient ?? "#a16bc7"}
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </svg>
                    )}
                    <div className="absolute right-6 top-1/2 z-[1000] flex -translate-y-1/2 flex-col items-end gap-4">
                      <div className="-right-2 rounded-full border border-heavy px-2 py-1 font-jetbrains-mono text-xs">
                        HACK WESTERN XII
                      </div>
                      <h1 className="z-[1000] font-dico text-3xl text-heavy">
                        {`${application?.firstName ?? "Hacker"} ${application?.lastName ?? ""}`}
                      </h1>
                    </div>
                    {application?.avatarColour && (
                      <div className="absolute left-2 top-4 -ml-8 mb-4 mr-6 h-36 w-36 scale-[0.3] self-center">
                        <AvatarDisplay
                          avatarColour={application?.avatarColour}
                          avatarFace={application?.avatarFace}
                          avatarLeftHand={application?.avatarLeftHand}
                          avatarRightHand={application?.avatarRightHand}
                          avatarHat={application?.avatarHat}
                          size="lg"
                        />
                      </div>
                    )}
                    <div className="absolute -right-4 bottom-[2] scale-[0.5]">
                      <SchoolStamp type={application?.school} />
                    </div>
                    <div className="absolute bottom-3 right-24 scale-[0.7]">
                      <MajorStamp type={application?.major} />
                    </div>
                    {application?.attendedBefore !== undefined &&
                      application?.attendedBefore !== null && (
                        <div className="absolute left-52 top-3 scale-[0.9]">
                          <HWStamp
                            returning={
                              application?.attendedBefore
                                ? "returnee"
                                : "newcomer"
                            }
                          />
                        </div>
                      )}
                    <div className="absolute bottom-12 left-4 scale-[0.7]">
                      <HackerStamp
                        numHackathons={application?.numOfHackathons}
                      />
                    </div>

                    {application?.githubLink &&
                      application?.linkedInLink &&
                      application?.otherLink &&
                      application?.resumeLink && (
                        <div className="absolute left-28 top-4 scale-[0.9]">
                          <LinksStamp />
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* End of Desktop View */}
      </main>
    </>
  );
};

export default Dashboard;
export const getServerSideProps = notVerifiedRedirectDashboard;

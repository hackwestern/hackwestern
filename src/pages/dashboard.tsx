import { signOut } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import React from "react";
import { Passport } from "~/components/apply/passport";
import Logout from "~/pages/logout"
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { ApplyMenu } from "~/components/apply/menu";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { notVerifiedRedirectDashboard } from "~/utils/redirect";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { isPastDeadline } from "~/lib/date";
import CanvasBackground from "~/components/canvas-background";
import CountdownTimer from "~/components/apply/countdown-timer";
import { APPLICATION_DEADLINE_ISO } from "~/lib/date";

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
      return "/apply?step=persona";
    case "PENDING_REVIEW":
      return "/apply?step=review";
    default:
      return "/apply?step=persona";
  }
}

function getApplyStep(stepValue: string | null): ApplyStepFull | null {
  return applySteps.find((s) => s.step === stepValue) ?? null;
}

const Dashboard = () => {
  const { data: application } = api.application.get.useQuery();
  const status = application?.status ?? "NOT_STARTED";
  const router = useRouter();

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  // const pastDeadline = isPastDeadline();

  const searchParams = useSearchParams();
  const applyStep = React.useMemo(
    () => getApplyStep(searchParams.get("step")),
    [searchParams],
  );

  const step = applyStep?.step ?? null;
  
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
      <main className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50">
        {/* Mobile View */}
        {/* End of Mobile View */}

        {/* Desktop View */}
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
            <div className="absolute top-7 right-7">
              <Logout />
            </div>
            <div className="z-10 flex flex-col items-center justify-center overflow-auto">
              <div className="flex flex-col items-center h-full w-full">
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
                    className="w-full p-6 text-base font-figtree font-medium"
                  >
                    <Link href="/apply?step=character">
                      { status == "NOT_STARTED" ? "Start Application" : "Continue Application"}
                    </Link>
                  </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex w-[100%] flex-col items-center justify-center"></div>
        {/* End of Desktop View */}
      </main>
    </>
  );
};

export default Dashboard;
export const getServerSideProps = notVerifiedRedirectDashboard;

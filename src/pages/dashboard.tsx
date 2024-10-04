import { signOut } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ApplyNavbar } from "~/components/apply/navbar";
import { Passport } from "~/components/apply/passport";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { authRedirectHacker } from "~/utils/redirect";
import Image from "next/image";

type ApplicationStatusType =
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED"
  | "DECLINED";

const ApplicationStatus = ({ status }: { status: ApplicationStatusType }) => {
  const parsedStatuses = {
    IN_PROGRESS: "Application In Progress...",
    PENDING_REVIEW: "Application Submitted!",
    IN_REVIEW: "Application In Review",
    ACCEPTED: "Application Accepted! 🥳",
    REJECTED: "Application Not Accepted",
    WAITLISTED: "Waitlisted",
    DECLINED: "You're Not Coming :(",
  };

  const statusClassName = {
    IN_PROGRESS: "bg-primary-200 text-violet-500",
    PENDING_REVIEW: "bg-primary-300 border border-primary-600 text-primary-600",
    IN_REVIEW: "bg-primary-300 border border-primary-600 text-primary-600",
    ACCEPTED: "bg-primary-500 text-primary-100",
    REJECTED: "bg-violet-500 text-primary-100",
    WAITLISTED: "bg-violet-500 text-primary-100",
    DECLINED: "bg-violet-500 text-primary-100",
  };

  return (
    <div
      className={`text-xl font-medium capitalize ${statusClassName?.[status ?? "IN_PROGRESS"]} mx-auto flex w-max select-none justify-center rounded-full px-10 py-2.5 text-center`}
    >
      {parsedStatuses?.[status ?? "IN_PROGRESS"]}
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

const Dashboard = () => {
  const { data: application } = api.application.get.useQuery();
  const router = useRouter();

  const onButtonClick = (status: ApplicationStatusType) => {
    switch (status) {
      case "IN_PROGRESS":
        void router.push("/apply?step=persona");
      case "PENDING_REVIEW":
        void router.push("/apply?step=review");
      default:
        void router.push("/apply?step=review");
    }
  };

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

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
        <div className="relative flex w-full flex-grow flex-col items-center md:flex-row">
          <div
            id="left-panel"
            className="lg:w-xl z-10 flex w-full flex-grow flex-col justify-center gap-4 bg-primary-100 p-9 pt-12 text-center md:h-full lg:max-w-xl"
          >
            <div className="pb-2.5 text-3xl font-bold text-slate-700">
              {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                `Welcome Back, ${application?.firstName || "Hacker"}!`
              }
            </div>
            <div className="text-xl font-medium text-slate-700">Status:</div>
            <ApplicationStatus status={application?.status ?? "IN_PROGRESS"} />
            {application?.status !== "REJECTED" ? (
              <div
                className="mx-auto mt-6 w-max cursor-pointer select-none rounded-2xl bg-primary-600 px-4 py-2.5 text-lg text-white transition-all hover:bg-primary-500"
                onClick={() =>
                  onButtonClick(application?.status ?? "IN_PROGRESS")
                }
              >
                {buttonStatus(application?.status ?? "IN_PROGRESS")}
              </div>
            ) : (
              <div className="text-slate-700">
                Due to the volume of applicants, we were unable to accept
                everyone. That doesn&apos;t mean it&apos;s the end of your Hack
                Western journey. We encourage you to apply again next year!
              </div>
            )}
            <Button
              variant="destructive"
              className="mx-auto w-fit"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
          <div
            id="right-panel"
            className="flex h-full w-full flex-col items-center justify-center bg-hw-linear-gradient-day"
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
      </main>
    </>
  );
};

export default Dashboard;
export const getServerSideProps = authRedirectHacker;

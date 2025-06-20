import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ApplyNavbar } from "~/components/apply/navbar";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import CloudBackground from "~/components/cloud-background";
import { disabledRedirect } from "~/utils/redirect";

/*
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const application = await db.query.applications.findFirst({
    where: (application, { eq }) => eq(application?.userId, session.user.id),
  });

  if (application?.status === "IN_PROGRESS") {
    return {
      redirect: {
        destination: "/apply?step=review",
        permanent: false,
      },
    };
  }

  return { props: {} };
}*/

export const getServerSideProps = disabledRedirect;

export default function Submitted() {
  const { data: application } = api.application.get.useQuery();
  return (
    <div className="flex h-svh flex-col">
      <ApplyNavbar />
      <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
        <CloudBackground />
        <div className="relative m-5 flex max-w-screen-sm flex-col items-start gap-2 rounded-lg border-primary-300 bg-violet-100 p-10 ">
          <h2 className="font-DM_Sans text-2xl font-bold">Submitted! ✈️</h2>
          <h4 className="font-DM_Sans text-xl font-medium">
            Thanks for applying, {application?.firstName}.
          </h4>
          <p className="font-DM_Sans">
            You&apos;ll hear back from us about your status in a few weeks. In
            the meantime, check out your Hacker Dashboard!
          </p>
          <Button asChild variant="primary" className="z-100 mt-2.5">
            <Link href="/dashboard">Go to Hacker Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

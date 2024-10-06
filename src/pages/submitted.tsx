import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ApplyNavbar } from "~/components/apply/navbar";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import Image from "next/image";

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
}

export default function Submitted() {
  const { data: application } = api.application.get.useQuery();
  return (
    <div className="flex h-svh flex-col">
      <ApplyNavbar></ApplyNavbar>
      <div className="relative flex flex-grow items-center justify-center bg-hw-linear-gradient-day">
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
          className="absolute left-0 top-0 select-none opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          layout="fill"
          objectFit="cover"
        />
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

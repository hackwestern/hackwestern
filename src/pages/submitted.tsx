import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import CanvasBackground from "~/components/canvas-background";
import { colors } from "~/constants/avatar";

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

  return (
    <div className="flex h-svh flex-col">
      <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
        <CanvasBackground />
        <div className="relative m-5 flex items-center gap-6 rounded-lg bg-violet-100 p-10">
          <div className="flex flex-col gap-6">
            <h2 className="font-dico text-4xl font-semibold text-heavy ">
              Your application has been submitted!
            </h2>
            <h4 className="font-figtree text-heavy">
              Thanks for applying to Hack Western XII, {application?.firstName}!
            </h4>
            <p className="font-figtree text-heavy">
              You&apos;ll hear back from us about your status in a few weeks!
            </p>
          </div>
          <div
            className="h-full w-full rounded-lg"
            style={{
              background: `${selectedColor?.bg} 30%`,
            }}
          >
            {pathStrings.length > 0 ? (
              <div className="rounded-lg">
                <svg className="h-64 w-full lg:h-72">
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
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

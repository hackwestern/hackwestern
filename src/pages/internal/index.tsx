import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import type { users } from "~/server/db/schema";
import NotAuthorizedCard from "~/components/notauthorized-card";
const Internal = ({
  userSession,
}: {
  userSession: typeof users.$inferSelect;
}) => {
  const router = useRouter();

  return userSession.type == "organizer" ? (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
      <h1 className="mb-5 text-3xl text-white">Internal Dashboard</h1>
      <div className="flex flex-col gap-3">
        <Button
          onClick={() => router.push("/internal/review")}
          className="rounded bg-white p-1 text-center text-black hover:bg-gray-300"
        >
          Review Portal
        </Button>
        <PreregistrationsButton />
        <ApplicationsButton />
      </div>
    </div>
  ) : (
    <NotAuthorizedCard />
  );
};

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/application/all.tswsl --set-default-version 2
 */
function ApplicationsButton() {
  return (
    <Link href="/api/application/all?format=csv&mlh">
      <Button className="w-full rounded bg-white p-1 text-center text-black hover:bg-gray-300">
        Export Applications
      </Button>
    </Link>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/preregistration/all.ts
 */
function PreregistrationsButton() {
  return (
    <Link href="/api/preregistration/all?format=csv">
      <Button className="mx-auto rounded bg-white p-1 text-center text-black hover:bg-gray-300">
        Export Preregistrations
      </Button>
    </Link>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "internal/login",
        permanent: false,
      },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  return {
    props: {
      userSession: user,
    },
  };
}

export default Internal;

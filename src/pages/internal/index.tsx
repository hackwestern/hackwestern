import { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";

const Internal = () => {
  const reset = api.auth.reset.useMutation();

  function ResetPasswordButton({email}: {email: string}) {
    return <div 
      onClick={
        () => reset.mutate({ email: email })
      }
      className="m-2 rounded bg-white p-2"
    >Reset Email</div>
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
        <div className="flex flex-col gap-3">
          <PreregistrationsButton />
          <ApplicationsButton />
          <ResetPasswordButton email="hunter.chen7@pm.me" />
        </div>
      </main>
    </>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/application/all.tswsl --set-default-version 2
 */
function ApplicationsButton() {
  return (
    <Link
      href="/api/application/all?format=csv&mlh"
      className="rounded bg-white p-1 text-center"
    >
      Export Applications
    </Link>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/preregistration/all.ts
 */
function PreregistrationsButton() {
  return (
    <Link
      href="/api/preregistration/all?format=csv"
      className="rounded bg-white p-1 text-center"
    >
      Export Preregistrations
    </Link>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });
  console.log(user);
  const userType = user?.type;

  if (userType !== "organizer") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};


export default Internal;
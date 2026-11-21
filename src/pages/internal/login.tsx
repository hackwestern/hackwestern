import SEO from "~/components/seo";
import { authOptions } from "~/server/auth";
import { getServerSession } from "next-auth";
import type { GetServerSidePropsContext } from "next";
import { db } from "~/server/db";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";
import { useRouter } from "next/router";
import { safeCallbackPath } from "~/lib/safe-callback";

export default function Login() {
  const router = useRouter();
  const callbackUrl = safeCallbackPath(router.query.callbackUrl) ?? "/internal";
  return (
    <>
      <SEO title="Organizer Login" noindex />
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Hack Western Organizer
          </h1>
          <div className="flex w-72 flex-col items-center gap-5">
            <GoogleAuthButton redirect={callbackUrl} />
            <GithubAuthButton redirect={callbackUrl} />
          </div>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);

  // If the user is already logged in, redirect.
  if (session) {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id),
    });

    if (user?.type === "organizer") {
      return {
        redirect: {
          destination:
            safeCallbackPath(context.query.callbackUrl) ?? "/internal",
          permanent: false,
        },
      };
    }

    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }
  return { props: {} };
}

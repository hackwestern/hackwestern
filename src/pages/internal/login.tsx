import { signIn, useSession } from "next-auth/react";
import Head from "next/head";

import Link from "next/link";
import { authOptions } from "~/server/auth";
import { getServerSession } from "next-auth";
import type { GetServerSidePropsContext } from "next";
import { db } from "~/server/db";
import { redirect } from "next/dist/server/api-utils";

export default function Login() {
  const { data: sessionData } = useSession();
  console.log(sessionData);
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Hack Western Organizer
          </h1>
          <div className="flex flex-col items-center gap-2">
            <button
              className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
              onClick={() =>
                void signIn("google", { callbackUrl: "/internal" })
              }
            >
              Sign in
            </button>
          </div>
        </div>
        <div className="relative flex w-full items-center md:py-5">
          <div className="flex-grow border-t border-gray-400"></div>
          <span className="mx-4 flex-shrink text-gray-400">or</span>
          <div className="flex-grow border-t border-gray-400"></div>
        </div>
        <p className="pb-5 text-white">Don't have an account?</p>
        <Link href="/internal/register">
          <button className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20">
            Register
          </button>
        </Link>
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

    return {
      redirect: {
        destination: "/internal",
        permanent: false,
      },
    };
  }
}

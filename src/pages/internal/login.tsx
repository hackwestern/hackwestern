import { useSession } from "next-auth/react";
import Head from "next/head";

import Link from "next/link";
import { authOptions } from "~/server/auth";
import { getServerSession } from "next-auth";
import type { GetServerSidePropsContext } from "next";
import { db } from "~/server/db";
import GoogleAuthButton from "~/components/hw-design/auth/googleauth-button";
import GithubAuthButton from "~/components/hw-design/auth/githubauth-button";

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
          <div className="flex w-72 flex-col items-center gap-5">
            <GoogleAuthButton redirect="/internal" />
            <GithubAuthButton redirect="/internal" />
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

    return {
      redirect: {
        destination: "/internal",
        permanent: false,
      },
    };
  }
  return { props: {} };
}

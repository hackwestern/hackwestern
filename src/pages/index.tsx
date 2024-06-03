import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";

import { api } from "~/utils/api";

export default function Home() {
  const hello = api.example.hello.useQuery({ text: "from tRPC" });
  const reset = api.login.reset.useMutation();

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
            Hack Western
          </h1>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello.data ? hello.data.greeting : "Loading tRPC query..."}
            </p>
            <AuthShowcase />
            <PreregistrationsButton />
            <ApplicationsButton />
            <div
              onClick={() => {
                reset.mutate({ email: "oscar45697@gmail.com" });
                reset.mutate({ email: "hunter.chen7@pm.me" });
                reset.mutate({ email: "basokanthan@gmail.com" });
              }}
              className="m-2 rounded bg-white p-2"
            >
              CLICK ME
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/application/all.ts
 */
function ApplicationsButton() {
  return (
    <Link
      href="/api/application/all?format=csv&mlh"
      className="rounded bg-white p-1"
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
      className="rounded bg-white p-1"
    >
      Export Preregistrations
    </Link>
  );
}

function AuthShowcase() {
  const { data: sessionData } = useSession();

  const { data: secretMessage } = api.example.getSecretMessage.useQuery(
    undefined, // no input
    { enabled: sessionData?.user !== undefined },
  );

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl text-white">
        {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
        {secretMessage && <span> - {secretMessage}</span>}
      </p>
      <button
        className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
        onClick={sessionData ? () => void signOut() : () => void signIn()}
      >
        {sessionData ? "Sign out" : "Sign in"}
      </button>
    </div>
  );
}

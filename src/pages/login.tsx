import { Check } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import GithubAuthButton from "~/components/hw-design/auth/githubauth-button";
import GoogleAuthButton from "~/components/hw-design/auth/googleauth-button";
import { api } from "~/utils/api";

export default function Login() {
  const hello = api.example.hello.useQuery({ text: "from tRPC" });

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

      <div className="flex h-screen flex-col items-center justify-center bg-purple-100">
        <div className="w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
          <h2 className="mb-2 text-4xl font-bold">Welcome Back!</h2>
          <h2 className="mb-6 text-lg">
            We can't wait to see what you will create.
          </h2>
          <h2 className="mb-2 text-sm">Email</h2>
          <Input className="mb-4" placeholder="Email" />
          <h2 className="mb-2 text-sm">Password</h2>
          <Input className="mb-8" placeholder="Password" />
          <Checkbox /> <span> Remember Me</span>
          <Button className="mt-8 w-full">Sign In</Button>
          <div className="relative flex w-full items-center md:py-5">
            <div className="flex-grow border-t border-gray-400"></div>
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400"></div>
          </div>
          <div className="mt-4">
            <GoogleAuthButton />
          </div>
          <div className="mt-4">
            <GithubAuthButton />
          </div>
        </div>

        <div className="mt-8 text-center">
          Don't have an account yet?{" "}
          <a
            className="text-purple-500 underline hover:text-violet-700"
            href="/register"
          >
            Create Account
          </a>
        </div>
      </div>
    </>
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
      <p className="text-center text-2xl">
        {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
        {secretMessage && <span> - {secretMessage}</span>}
      </p>
      <button
        className="rounded-full bg-black/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
        onClick={sessionData ? () => void signOut() : () => void signIn()}
      >
        {sessionData ? "Sign out" : "Sign in"}
      </button>
    </div>
  );
}

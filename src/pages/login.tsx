import { signIn } from "next-auth/react";
import Head from "next/head";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";
import Link from "next/link";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import { useToast } from "~/components/hooks/use-toast";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import CanvasBackground from "~/components/canvas-background";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  async function handleSubmit() {
    void signIn("credentials", {
      redirect: false,
      username: email,
      password,
    }).then((response) => {
      if (response && response.ok === false) {
        toast({
          title: "Error",
          description: "Invalid email or password",
          variant: "destructive",
        });
        return;
      }
      void router.push("/dashboard");
    });
  }

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

      <div className="flex h-screen flex-col items-center justify-center bg-hw-radial-gradient">
        <CanvasBackground />
        <div className="z-10 w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
          <h2 className="mb-2 text-4xl font-bold">Welcome Back!</h2>
          <h2 className="mb-6 text-lg">
            We can&apos;t wait to see what you will create.
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <h2 className="mb-2 text-sm">Email</h2>
            <Input
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4"
              placeholder="Email"
            />
            <h2 className="mb-2 text-sm">Password</h2>
            <Input
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              className="mb-8"
              placeholder="Password"
            />
            <Button variant="primary" type="submit" className="mt-8 w-full">
              Sign In
            </Button>
          </form>
          <div className="relative flex w-full items-center md:py-5">
            <div className="flex-grow border-t border-gray-400" />
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400" />
          </div>
          <div className="mt-4">
            <GoogleAuthButton redirect="/dashboard" />
          </div>
          <div className="mt-4">
            <GithubAuthButton redirect="/dashboard" />
          </div>
          <div className="mt-4">
            <DiscordAuthButton redirect="/dashboard" />
          </div>
          <div className="mt-4">
            Don&apos;t have an account yet?{" "}
            <Link
              className="text-purple-500 underline hover:text-violet-700"
              href="/register"
            >
              Create Account
            </Link>
          </div>
          <div>
            Forget password?{" "}
            <Link
              className="text-purple-500 underline hover:text-violet-700"
              href="/forgot-password"
            >
              Reset Password
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

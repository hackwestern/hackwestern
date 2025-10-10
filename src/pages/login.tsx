import { signIn } from "next-auth/react";
import Head from "next/head";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import type { FormEvent } from "react";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";
import Link from "next/link";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import { useToast } from "~/hooks/use-toast";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import CanvasBackground from "~/components/canvas-background";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    void signIn("credentials", {
      username: email,
      password,
      redirect: false,
    }).then((response) => {
      if (response && response.ok === false) {
        toast({
          title: "Error",
          description: "Invalid email or password",
          variant: "destructive",
        });
        setPending(false);
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

      <div className="m-auto flex h-screen flex-col items-center justify-center bg-hw-radial-gradient">
        <CanvasBackground />
        <div className="z-10 mx-4 flex-col items-center rounded-lg bg-background p-8 shadow-md sm:w-xl sm:p-12 md:w-2xl">
          <h2 className="mb-4 self-start font-dico text-[32px] text-heavy">
            Sign into your account
          </h2>
          <form onSubmit={handleSubmit}>
            <h2 className="mb-1 font-figtree text-medium">Email</h2>
            <Input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              className="mb-4 h-[60px] bg-highlight text-medium"
              placeholder="hello@hackwestern.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <h2 className="mb-1 font-figtree text-medium">Password</h2>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mb-8 h-[60px] bg-highlight text-medium"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              variant="primary"
              type="submit"
              size="lg"
              full
              isPending={pending}
            >
              {pending ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="relative flex w-full items-center py-2 md:py-6">
            <div className="flex-grow border-t border-gray-400 opacity-20" />
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400 opacity-20" />
          </div>
          <div className="flex flex-col items-stretch gap-4">
            <GoogleAuthButton redirect="/dashboard" />
            <GithubAuthButton redirect="/dashboard" />
            <DiscordAuthButton redirect="/dashboard" />
          </div>
          <div className="mt-6 font-figtree text-medium">
            Don&apos;t have an account yet?
            <Button
              asChild
              variant="tertiary"
              className="ml-2 h-max p-0 text-base"
            >
              <Link
                className="text-purple-500 hover:text-violet-700"
                href="/register"
              >
                Create Account
              </Link>
            </Button>
          </div>
          <div className="font-figtree text-medium">
            Forget password?
            <Button
              asChild
              variant="tertiary"
              className="ml-2 h-max p-0 text-base"
            >
              <Link
                className="text-purple-500 hover:text-violet-700"
                href="/forgot-password"
              >
                Reset Password
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

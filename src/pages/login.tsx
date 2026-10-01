import { signIn } from "next-auth/react";
import SEO from "~/components/seo";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import type { FormEvent } from "react";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";
import Link from "next/link";
import { disabledRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import { useToast } from "~/hooks/use-toast";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import { AuthLayout } from "~/components/auth/auth-layout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const callbackUrl = (router.query.callbackUrl as string) ?? "/dashboard";

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
      void router.push(callbackUrl);
    });
  }

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to your Hack Western account. Hack Western is one of Canada's largest student-run hackathons at Western University."
      />

      <AuthLayout title="Sign into your account">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-figtree text-md-p font-medium text-gray-4"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              className="h-12 bg-white font-figtree text-md-p"
              placeholder="hacker@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="font-figtree text-md-p font-medium text-gray-4"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-12 bg-white font-figtree text-md-p"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            variant="primary-2"
            type="submit"
            size="lg"
            full
            isPending={pending}
          >
            {pending ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-3/30" />
          <span className="font-figtree text-sm-p text-gray-3">or</span>
          <div className="h-px flex-1 bg-gray-3/30" />
        </div>

        <div className="flex flex-col gap-4">
          <GoogleAuthButton redirect={callbackUrl} />
          <GithubAuthButton redirect={callbackUrl} />
          <DiscordAuthButton redirect={callbackUrl} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 font-figtree text-md-p text-gray-6">
            <span>New here?</span>
            <Button asChild variant="tertiary" className="h-max p-0">
              <Link
                className="font-figtree text-light hover:text-medium"
                href="/register"
              >
                Create an account
              </Link>
            </Button>
          </div>
          <Button asChild variant="tertiary" className="h-max p-0">
            <Link
              className="font-figtree text-md-p text-light hover:text-medium"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </Button>
        </div>
      </AuthLayout>
    </>
  );
}

export const getServerSideProps = disabledRedirect;

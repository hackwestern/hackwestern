import SEO from "~/components/seo";
import { useState, type FormEvent } from "react";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { disabledRedirect } from "~/utils/redirect";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import { useRouter } from "next/router";
import { AuthLayout } from "~/components/auth/auth-layout";

export default function Register() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const router = useRouter();
  const { mutate: register } = api.auth.create.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.data?.zodError?.fieldErrors?.password?.[0] ?? error.message,
        variant: "destructive",
      });
      setPending(false);
    },
    onSuccess: () =>
      signIn("credentials", { username: email, password }).then(() => {
        toast({
          title: "Success",
          description: "Account created successfully",
          variant: "default",
        });
        setPending(false);
        void router.push("/dashboard");
      }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setPending(true);
    register({ email, password });
  };

  return (
    <>
      <SEO
        title="Register"
        description="Create your Hack Western account to apply. Join Canada's largest student-run hackathon at Western University in London, Ontario."
      />

      <AuthLayout title="Create your account">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-secondary text-md-p font-medium text-gray-4"
            >
              Email
            </label>
            <Input
              required
              id="email"
              // type="email", not "text": mobile keyboards autocapitalize text
              // inputs, which is how HW12 got mixed-case emails into the user
              // table and 7 duplicate accounts out of it.
              type="email"
              name="email"
              autoComplete="username"
              className="h-12 bg-white font-secondary text-md-p"
              placeholder="hacker@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="font-secondary text-md-p font-medium text-gray-4"
            >
              Password
            </label>
            <Input
              required
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              className="h-12 bg-white font-secondary text-md-p"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            size="lg"
            full
            isPending={pending}
          >
            {pending ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-3/30" />
          <span className="font-secondary text-sm-p text-gray-3">or</span>
          <div className="h-px flex-1 bg-gray-3/30" />
        </div>

        <div className="flex flex-col gap-4">
          <GoogleAuthButton redirect="/dashboard" register={true} />
          <GithubAuthButton redirect="/dashboard" register={true} />
          <DiscordAuthButton redirect="/dashboard" register={true} />
        </div>

        <div className="flex items-center gap-1.5 font-secondary text-md-p text-gray-6">
          <span>Already have an account?</span>
          <Button asChild variant="tertiary" className="h-max p-0">
            <Link href="/login" className="text-light hover:text-medium">
              Login
            </Link>
          </Button>
        </div>
      </AuthLayout>
    </>
  );
}

export const getServerSideProps = disabledRedirect;

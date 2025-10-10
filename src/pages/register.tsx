import Head from "next/head";
import { useState, type FormEvent } from "react";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/hooks/use-toast";
import { api } from "~/utils/api";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { hackerLoginRedirect } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import { useRouter } from "next/router";

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
        <div className="z-10 mx-4 flex-col items-center rounded-xl bg-background p-8 shadow-md sm:w-xl sm:p-12 md:w-2xl">
          <h2 className="mb-4 self-start font-dico text-[32px] text-heavy">
            Create your account
          </h2>
          <form onSubmit={handleSubmit}>
            <h2 className="mb-2 font-figtree text-medium">Email</h2>
            <Input
              required
              id="email"
              type="text"
              name="email"
              autoComplete="username"
              className="mb-4 h-[60px] bg-highlight text-medium"
              placeholder="hello@hackwestern.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <h2 className="mb-2 font-figtree text-medium">Password</h2>
            <Input
              required
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              className="mb-8 h-[60px] bg-highlight text-medium"
              placeholder="enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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

          <div className="relative flex w-full items-center py-2 md:py-5">
            <div className="flex-grow border-t border-gray-400 opacity-20" />
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400 opacity-20" />
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <GoogleAuthButton redirect="/dashboard" register={true} />
            <GithubAuthButton redirect="/dashboard" register={true} />
            <DiscordAuthButton redirect="/dashboard" register={true} />
          </div>
          <div className="mt-6 font-figtree text-medium">
            Already have an account?
            <Button
              asChild
              variant="tertiary"
              className="ml-2 h-max p-0 text-base"
            >
              <Link
                href="/login"
                className="text-purple-500 hover:text-violet-700"
              >
                Login
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

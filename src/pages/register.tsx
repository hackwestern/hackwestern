import Head from "next/head";
import { useRouter } from "next/router";
import { type FormEvent, useState } from "react";
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

export default function Register() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const { mutate: register } = api.auth.create.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.data?.zodError?.fieldErrors?.password?.[0] ?? error.message,
        variant: "destructive",
      });
    },
    onSuccess: () =>
      signIn("credentials", { username: email, password }).then(() => {
        toast({
          title: "Success",
          description: "Account created successfully",
          variant: "default",
        });
        void router.push("/dashboard");
      }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
        <div className="sm:w-xl md:w-2xl z-10 mx-4 flex-col items-center rounded-xl bg-violet-50 bg-white p-8 shadow-md sm:rounded-[48px] sm:p-12">
          <h2 className="mb-2 self-start font-dico text-[32px] text-heavy">Start Your Journey!</h2>
          <h2 className="mb-6 self-start font-figtree text-2xl text-medium">
            It&apos;s time to turn your ideas into realities
          </h2>
          <form onSubmit={(e) => handleSubmit(e)}>
            <h2 className="mb-2 font-jetbrains-mono text-sm text-medium">Email</h2>
            <Input
              required
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 h-[60px] bg-highlight font-jetbrains-mono text-medium"
              placeholder="Email"
            />
            <h2 className="mb-2 font-jetbrains-mono text-sm text-medium">Password</h2>
            <Input
              required
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              className="mb-8 h-[60px] bg-highlight font-jetbrains-mono text-medium"
              placeholder="Password"
            />
            <Button variant="primary" type="submit" size="default" full>
              Create Account
            </Button>
          </form>

          <div className="relative flex w-full items-center py-2 md:py-5">
            <div className="flex-grow border-t border-gray-400" />
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400" />
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <GoogleAuthButton redirect="/dashboard" register={true} />
            <GithubAuthButton redirect="/dashboard" register={true} />
            <DiscordAuthButton redirect="/dashboard" register={true} />
          </div>
          <div className="mt-4 font-figtree">
            Already have an account?
            <Button asChild variant="tertiary" className="ml-2 h-max p-0 text-base">
              <Link href="/login" className="text-purple-500 hover:text-violet-700">
                Login
              </Link>
            </Button>
          </div>
          <div className="font-figtree">
            Forget password?
            <Button asChild variant="tertiary" className="ml-2 h-max p-0 text-base">
              <Link href="/forgot-password">Reset Password</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

import Head from "next/head";
import { useActionState, useState, useRef } from "react";
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
import { TRPCClientError } from "@trpc/client";

export default function Register() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const { mutateAsync: register } = api.auth.create.useMutation();

  const [_message, handleSubmit, pending] = useActionState<
    string | null,
    FormData
  >(async (_prev, formData) => {
    try {
      await register({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });

      const response = await signIn("credentials", {
        redirect: false,
        username: formData.get("email"),
        password: formData.get("password"),
      });

      if (response?.ok) {
        toast({
          title: "Success",
          description: "Account created successfully",
          variant: "default",
        });
      }
    } catch (error) {
      // Handle all errors here to prevent page crashes
      console.error("Registration error:", error);

      // Handle Zod validation errors from TRPC
      if (error instanceof TRPCClientError) {
        // Type guard for the error data structure
        const errorData = error.data as { zodError?: { fieldErrors?: Record<string, string[]> } };
        const zodError = errorData?.zodError;

        if (zodError?.fieldErrors) {
          const allErrors: string[] = [];

          // Collect all error messages from all fields
          Object.values(zodError.fieldErrors).forEach((errors) => {
            if (Array.isArray(errors)) {
              allErrors.push(...errors);
            }
          });

          // Display only the first error
          toast({
            title: "Validation Error",
            description: allErrors[0] ?? "Invalid input",
            variant: "destructive",
          });
          return null;
        }
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : "An error occurred during registration";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }

    return null;
  }, null);

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
        <div className="z-10 mx-4 flex-col items-center rounded-xl bg-violet-50 bg-white p-8 shadow-md sm:w-xl sm:rounded-[48px] sm:p-12 md:w-2xl">
          <h2 className="mb-2 self-start font-dico text-[32px] text-heavy">
            Create your account
          </h2>
          <h2 className="mb-6 self-start font-figtree text-2xl text-medium">
            The world is your canvas.
          </h2>
          <form ref={formRef} action={handleSubmit}>
            <h2 className="mb-2 font-jetbrains-mono text-sm text-medium">
              Email
            </h2>
            <Input
              required
              id="email"
              type="text"
              name="email"
              autoComplete="username"
              className="mb-4 h-[60px] bg-highlight font-jetbrains-mono text-medium"
              placeholder="hello@hackwestern.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <h2 className="mb-2 font-jetbrains-mono text-sm text-medium">
              Password
            </h2>
            <Input
              required
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              className="mb-8 h-[60px] bg-highlight font-jetbrains-mono text-medium"
              placeholder="enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="primary"
              type="submit"
              size="default"
              full
              isPending={pending}
            >
              {pending ? "Creating Account..." : "Create Account"}
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
          <div className="font-figtree">
            Forget password?
            <Button
              asChild
              variant="tertiary"
              className="ml-2 h-max p-0 text-base"
            >
              <Link href="/forgot-password">Reset Password</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

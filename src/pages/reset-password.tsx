import Head from "next/head";
import { type FormEvent, useState } from "react";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useToast } from "~/components/hooks/use-toast";
import { api } from "~/utils/api";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/router";
import CanvasBackground from "~/components/canvas-background";

export default function ResetRequest() {
  const { toast } = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = api.auth.setPassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully!",
        variant: "default",
      });
      void router.push("/login");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message ?? "Error resetting password.",
        variant: "destructive",
      });
      console.log("error resetting password", error);
    },
  });

  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { isSuccess: isValidToken } = api.auth.checkValidToken.useQuery({
    token,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Password must be entered",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    reset.mutate({ password, token });
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
        <div className="z-10 w-full max-w-2xl rounded-lg bg-[rgba(248,245,255,0.75)] p-12 text-base shadow-md backdrop-blur-xl">
          {isValidToken ? (
            <>
              <h2 className="mb-2 text-3xl font-bold">Reset Password</h2>
              <h2>Enter your new password</h2>
              <form onSubmit={(e) => handleSubmit(e)}>
                <h2 className="mb-1 mt-6 text-sm">Password</h2>
                <Input
                  type="password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <h2 className=" mb-1 mt-4 text-sm">Confirm Password</h2>
                <Input
                  type="password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button variant="primary" className="mt-6 w-full" type="submit">
                  Reset Password
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-center text-lg font-bold">
                Password reset link is invalid or expired
              </h2>
              <div className="mt-4 text-center">
                Try requesting a new password reset link{" "}
                <Link
                  href="/forgot-password"
                  className="text-purple-500 underline hover:text-violet-700"
                >
                  here
                </Link>
              </div>
              <div className="mt-4 text-center">
                Or return to the{" "}
                <Link
                  href="/login"
                  className="text-purple-500 underline hover:text-violet-700"
                >
                  login
                </Link>{" "}
                or{" "}
                <Link
                  href="/register"
                  className="text-purple-500 underline hover:text-violet-700"
                >
                  registration
                </Link>{" "}
                page
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

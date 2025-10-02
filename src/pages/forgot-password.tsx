import Head from "next/head";
import { useState } from "react";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useToast } from "~/components/hooks/use-toast";
import { api } from "~/utils/api";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import CanvasBackground from "~/components/canvas-background";

export default function ResetRequest() {
  const [email, setEmail] = useState("");
  const [resetRequsted, setResetRequested] = useState(false);
  const { toast } = useToast();
  const reset = api.auth.reset.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent!",
        variant: "default",
      });
      setResetRequested(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message ?? "Error sending reset email.",
        variant: "destructive",
      });
      console.log("error sending email", error);
    },
  });

  async function handleSubmit() {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    if (resetRequsted) {
      toast({
        title: "Error",
        description:
          "You have already requested a password reset, please try again in a few minutes.",
        variant: "destructive",
      });
      return;
    }
    reset.mutate({ email });
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
        <div className="z-10 mx-4 flex-col items-center rounded-xl bg-violet-50 bg-white p-8 shadow-md sm:w-xl sm:rounded-[48px] sm:p-12 md:w-2xl">
          <h2 className="mb-2 text-3xl font-bold">Reset Password</h2>
          <h2>We&apos;ll send you a link to reset your password.</h2>
          <h2 className="mb-2 mt-6 text-sm">Email</h2>
          <Input
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            className="mb-8 h-[60px] bg-highlight font-jetbrains-mono text-medium"
            placeholder="hello@hackwestern.com"
          />
          <Button variant="primary" onClick={handleSubmit} size="default" full>
            Reset Password
          </Button>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

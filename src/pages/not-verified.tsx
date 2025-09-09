import Head from "next/head";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { useToast } from "~/components/hooks/use-toast";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { isVerifiedRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import CloudBackground from "~/components/cloud-background";

const NotVerified = () => {
  const { toast } = useToast();
  const router = useRouter();
  const { mutate: sendVerificationEmail } = api.auth.resendEmail.useMutation({
    onSuccess: () => {
      toast({
        title: "Verification Email Sent",
        description: "Check your inbox for a verification email.",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Error Sending Verification Email",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });
  const [verificationSent, setVerificationSent] = useState(false);

  const handleResendVerification = () => {
    if (!verificationSent) {
      sendVerificationEmail();
      setVerificationSent(true);
    } else {
      toast({
        title: "Verification Email Already Sent",
        description: "Check your inbox for a verification email.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Head>
        <title>Verify Email</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen flex-col items-center justify-center bg-hw-radial-gradient">
        <CloudBackground />
        <div className="z-10 flex w-full max-w-2xl flex-col justify-center gap-6 rounded-lg bg-violet-50 bg-white p-8 shadow-md">
          <p>
            You have registered successfully! Please verify your email before
            continuing. If you do not see an email, try requesting a new one.
          </p>
          <div className="flex justify-between">
            <Button
              variant="primary"
              className="w-fit text-sm"
              onClick={handleResendVerification}
            >
              Request New Verification Link
            </Button>

            <Button
              variant="destructive"
              onClick={() => signOut().then(() => void router.push("/login"))}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotVerified;
export const getServerSideProps = isVerifiedRedirect;

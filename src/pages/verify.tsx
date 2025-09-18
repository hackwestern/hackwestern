import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { useToast } from "~/components/hooks/use-toast";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import { isVerifiedRedirect } from "~/utils/redirect";
import CanvasBackground from "~/components/canvas-background";

const Verify = () => {
  const router = useRouter();
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const verifyToken = searchParams.get("token");

  const { mutate: verifyEmail } = api.auth.verify.useMutation({
    onSuccess: () => {
      setVerifySuccess(true);
      toast({
        title: "Email Verified",
        description: "Your email has been verified successfully!",
        variant: "default",
      });
      void router.push("/login");
    },
    onError: (error) => {
      toast({
        title: "Error Verifying Email",
        description: error.message,
        variant: "destructive",
      });
      setVerifyFailed(true);
    },
  });

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
  const { data: verifiedData } = api.auth.checkVerified.useQuery();

  if (verifiedData?.verified) {
    toast({
      title: "Email Already Verified",
      description: "You can now login.",
      variant: "default",
    });
    void router.push("/dashboard");
  }

  useEffect(() => {
    if (verifyToken) {
      verifyEmail({ token: verifyToken });
    } else {
      setVerifyFailed(true);
    }
  }, [verifyToken, verifyEmail]);

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
          {verifySuccess && (
            <div>
              <div className="text-center">Email Verified!</div>
              <div className="text-center">You can now login.</div>
            </div>
          )}
          {verifyFailed && (
            <div className="flex flex-col justify-center">
              <div className="text-center">
                Invalid or Expired Verification Token.
              </div>
              {verifyToken && (
                <Button
                  variant="primary"
                  className="mx-auto mt-6 w-fit text-sm"
                  onClick={handleResendVerification}
                >
                  Request New Verification Link
                </Button>
              )}
            </div>
          )}
          {!verifySuccess && !verifyFailed && (
            <div className="text-center">Verifying email...</div>
          )}
        </div>
      </div>
    </>
  );
};

export default Verify;
export const getServerSideProps = isVerifiedRedirect;

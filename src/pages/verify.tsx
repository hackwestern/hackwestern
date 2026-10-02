import { useSearchParams } from "next/navigation";
import SEO from "~/components/seo";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { useToast } from "~/hooks/use-toast";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import { isVerifiedRedirect } from "~/utils/redirect";
import { AuthLayout } from "~/components/auth/auth-layout";

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
      <SEO title="Verify Email" noindex />

      <AuthLayout title="Verify your email">
        {verifySuccess && (
          <div className="flex flex-col gap-2">
            <p className="text-center font-figtree text-md-p font-medium text-gray-6">
              Email Verified!
            </p>
            <p className="text-center font-figtree text-md-p text-gray-6">
              You can now login.
            </p>
          </div>
        )}
        {verifyFailed && (
          <div className="flex flex-col gap-6">
            <p className="font-figtree text-md-p text-gray-6">
              Invalid or Expired Verification Token.
            </p>
            {verifyToken && (
              <Button
                variant="primary-2"
                size="lg"
                full
                onClick={handleResendVerification}
              >
                Request New Verification Link
              </Button>
            )}
          </div>
        )}
        {!verifySuccess && !verifyFailed && (
          <p className="text-center font-figtree text-md-p text-gray-6">
            Verifying email...
          </p>
        )}
      </AuthLayout>
    </>
  );
};

export default Verify;
export const getServerSideProps = isVerifiedRedirect;

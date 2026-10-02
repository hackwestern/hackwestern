import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { useToast } from "~/hooks/use-toast";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { isVerifiedRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import { AuthLayout } from "~/components/auth/auth-layout";

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
      <SEO title="Verify Email" noindex />

      <AuthLayout title="Verify your email">
        <p className="font-figtree text-md-p text-gray-6">
          You have registered successfully! Please verify your email before
          continuing. If you do not see an email, try requesting a new one.
        </p>
        <div className="flex flex-col gap-4">
          <Button
            variant="primary-2"
            size="lg"
            full
            onClick={handleResendVerification}
          >
            Request New Verification Link
          </Button>

          <Button
            variant="secondary"
            size="lg"
            full
            onClick={() => signOut().then(() => void router.push("/login"))}
          >
            Sign Out
          </Button>
        </div>
      </AuthLayout>
    </>
  );
};

export default NotVerified;
export const getServerSideProps = isVerifiedRedirect;

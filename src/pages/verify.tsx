import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Head from "next/head";
import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import { useToast } from "~/components/hooks/use-toast";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {/* Clouds */}
        <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
          <Image
            src="/images/cloud5.svg"
            alt="hack western cloud"
            className="object-contain object-left-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 right-0 h-full w-full md:h-[90%] md:w-[70%] lg:h-[100%]">
          <Image
            src="/images/cloud6.svg"
            alt="hack western cloud"
            className="object-contain object-right-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
          <Image
            src="/images/cloud7.svg"
            alt="hack western cloud"
            className="object-contain object-left-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[40%] lg:h-[50%] lg:w-[30%]">
          <Image
            src="/images/cloud8.svg"
            alt="hack western cloud"
            className="object-contain object-right-bottom"
            fill
          />
        </div>
        {/* Stars */}
        <div className="absolute bottom-[20%] left-[20%] h-full w-[20%] md:w-[10%] lg:w-[5%]">
          <Image
            src="/images/star.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="absolute bottom-[40%] right-[10%] h-full w-[15%] md:w-[7%] lg:w-[3%]">
          <Image
            src="/images/star.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="absolute bottom-[25%] right-[15%] h-full w-[20%] md:w-[10%] lg:w-[5%] ">
          <Image
            src="/images/star2.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        {/* Grain Filter */}
        <Image
          className="absolute left-0 top-0 opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          layout="fill"
          objectFit="cover"
        />
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

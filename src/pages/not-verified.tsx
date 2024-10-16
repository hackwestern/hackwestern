import Image from "next/image";
import Head from "next/head";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { useToast } from "~/components/hooks/use-toast";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { isVerifiedRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";

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

import Head from "next/head";
import { useState } from "react";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useToast } from "~/components/hooks/use-toast";
import Image from "next/image";
import { api } from "~/utils/api";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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
        description: "You have already requested a password reset",
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
          className="absolute left-0 top-0 select-none opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          layout="fill"
          objectFit="cover"
        />
        <div className="z-10 w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
          <h2 className="mb-2 text-3xl font-bold">Reset Password</h2>
          <h2>We&apos;ll send you a link to reset your password.</h2>
          <h2 className="mb-2 mt-6 text-sm">Email</h2>
          <Input type="email" onChange={(e) => setEmail(e.target.value)} />
          <Button
            variant="primary"
            className="mt-6 w-full"
            onClick={handleSubmit}
          >
            Reset Password
          </Button>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

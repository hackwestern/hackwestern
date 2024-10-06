import Head from "next/head";
import { useRouter } from "next/router";
import { type FormEvent, useState } from "react";
import GithubAuthButton from "~/components/auth/githubauth-button";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/hooks/use-toast";

import { api } from "~/utils/api";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { hackerLoginRedirect } from "~/utils/redirect";
import Image from "next/image";

export default function Register() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const { mutate: register } = api.auth.create.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.data?.zodError?.fieldErrors?.password?.[0] ?? error.message,
        variant: "destructive",
      });
    },
    onSuccess: () =>
      signIn("credentials", { username: email, password }).then(() => {
        toast({
          title: "Success",
          description: "Account created successfully",
          variant: "default",
        });
        void router.push("/dashboard");
      }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    register({ email, password });
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
          className="absolute left-0 top-0 select-none opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          layout="fill"
          objectFit="cover"
        />
        <div className="z-10 w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
          <h2 className="mb-2 text-4xl font-bold">Start Your Journey!</h2>
          <h2 className="mb-6 text-lg">
            It&apos;s time to turn your ideas into realities
          </h2>
          <form onSubmit={(e) => handleSubmit(e)}>
            <h2 className="mb-2 text-sm">Email</h2>
            <Input
              required
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4"
              placeholder="Email"
            />
            <h2 className="mb-2 text-sm">Password</h2>
            <Input
              required
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              className="mb-8"
              placeholder="Password"
            />
            <Button variant="primary" type="submit" className=" w-full">
              Create Account
            </Button>
          </form>
          <div className="relative flex w-full items-center md:py-5">
            <div className="flex-grow border-t border-gray-400"></div>
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400"></div>
          </div>
          <div className="mt-4">
            <GoogleAuthButton redirect="/dashboard" register={true} />
          </div>
          <div className="mt-4">
            <GithubAuthButton redirect="/dashboard" register={true} />
          </div>
          <div className="mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-500 hover:text-purple-700">
              Login
            </Link>
          </div>
          <div>
            Forget password?{" "}
            <Link
              className="text-purple-500 underline hover:text-violet-700"
              href="/reset-password"
            >
              Reset Password
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

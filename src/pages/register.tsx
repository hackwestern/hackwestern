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
        router.push("/dashboard");
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
      <div className="flex h-screen flex-col items-center justify-center bg-purple-100">
        <div className="w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
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
        </div>
        <div className="my-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 hover:text-purple-700">
            Login
          </Link>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

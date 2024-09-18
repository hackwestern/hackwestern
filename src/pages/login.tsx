import { signIn } from "next-auth/react";
import Head from "next/head";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { useState } from "react";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
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

      <div className="flex h-screen flex-col items-center justify-center bg-purple-100">
        <div className="w-full max-w-2xl rounded-lg bg-violet-50 bg-white p-12 shadow-md">
          <h2 className="mb-2 text-4xl font-bold">Welcome Back!</h2>
          <h2 className="mb-6 text-lg">
            We can&apos;t wait to see what you will create.
          </h2>
          <form onSubmit={handleSubmit}>
            <h2 className="mb-2 text-sm">Email</h2>
            <Input
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4"
              placeholder="Email"
            />
            <h2 className="mb-2 text-sm">Password</h2>
            <Input
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              className="mb-8"
              placeholder="Password"
            />
            <Checkbox /> <span> Remember Me</span>
            <Button variant="primary" type="submit" className="mt-8 w-full">
              Sign In
            </Button>
          </form>
          <div className="relative flex w-full items-center md:py-5">
            <div className="flex-grow border-t border-gray-400"></div>
            <span className="mx-4 flex-shrink text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-400"></div>
          </div>
          <div className="mt-4">
            <GoogleAuthButton redirect="/dashboard" />
          </div>
          <div className="mt-4">
            <GithubAuthButton redirect="/dashboard" />
          </div>
        </div>

        <div className="mt-8 text-center">
          Don&apos;t have an account yet?{" "}
          <a
            className="text-purple-500 underline hover:text-violet-700"
            href="/register"
          >
            Create Account
          </a>
        </div>
      </div>
    </>
  );
}

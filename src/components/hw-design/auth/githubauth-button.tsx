import { signIn } from "next-auth/react";
import Image from "next/image";

function GithubAuthButton({ redirect }: { redirect: string }) {
  return (
    <button
      onClick={() => {
        void signIn("github", { callbackUrl: redirect });
      }}
      className="bg-github w-full rounded-md p-1 font-medium text-white outline outline-1 outline-gray-900"
    >
      <div className="flex flex-row items-center justify-center gap-1">
        <Image
          src="/images/githublogo.svg"
          alt="github logo"
          width={25}
          height={25}
        />
        <span>Sign in with Github</span>
      </div>
    </button>
  );
}

export default GithubAuthButton;

import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "../ui/button";

function GithubAuthButton({
  redirect,
  register,
}: {
  redirect: string;
  register?: boolean;
}) {
  return (
    <Button
      onClick={() => {
        void signIn("github", { callbackUrl: redirect });
      }}
      className="w-full rounded-md bg-githubbg p-1 font-medium text-white outline outline-1 outline-gray-900 hover:bg-black"
    >
      <div className="flex flex-row items-center justify-center gap-1">
        <Image
          src="/images/githublogo.svg"
          alt="github logo"
          width={25}
          height={25}
        />
        <span>Sign {register ? "up" : "in"} with Github</span>
      </div>

    </Button>
  );
}

export default GithubAuthButton;

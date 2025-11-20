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
      variant="secondary"
      size="lg"
      full
    >
      <div className="flex flex-row items-center justify-center gap-2">
        <Image
          src="/images/githublogo.svg"
          alt="github logo"
          width={20}
          height={20}
        />
        <span>Sign {register ? "up" : "in"} with Github</span>
      </div>
    </Button>
  );
}

export default GithubAuthButton;

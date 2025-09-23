import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "../ui/button";

function DiscordAuthButton({
  redirect,
  register,
}: {
  redirect: string;
  register?: boolean;
}) {
  return (
    <Button
      onClick={() => {
        void signIn("discord", { callbackUrl: redirect });
      }}
      variant="secondary"
      size="default"
      full
    >
      <div className="flex flex-row items-center justify-center gap-1">
        <Image
          src="/images/discordlogo.svg"
          alt="google logo"
          width={25}
          height={25}
        />
        <span>Sign {register ? "up" : "in"} with Discord</span>
      </div>
    </Button>
  );
}

export default DiscordAuthButton;

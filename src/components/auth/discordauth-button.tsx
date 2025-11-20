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
      size="lg"
      full
    >
      <div className="flex flex-row items-center justify-center gap-2">
        <Image
          src="/images/discordlogo.svg"
          alt="google logo"
          width={20}
          height={20}
        />
        <span>Sign {register ? "up" : "in"} with Discord</span>
      </div>
    </Button>
  );
}

export default DiscordAuthButton;

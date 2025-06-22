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
      className="w-full cursor-pointer rounded-md bg-[#E1E3FE] p-1 font-medium outline outline-1 outline-gray-400 hover:bg-white"
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

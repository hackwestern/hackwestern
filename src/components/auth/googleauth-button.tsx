import { signIn } from "next-auth/react";
import Image from "next/image";

function GoogleAuthButton({ redirect }: { redirect: string }) {
  return (
    <button
      onClick={() => {
        void signIn("google", { callbackUrl: redirect });
      }}
      className="w-full rounded-md bg-slate-50 p-1 font-medium outline outline-1 outline-gray-400"
    >
      <div className="flex flex-row items-center justify-center gap-1">
        <Image
          src="/images/googlelogo.svg"
          alt="google logo"
          width={25}
          height={25}
        />
        <span>Sign in with Google</span>
      </div>
    </button>
  );
}

export default GoogleAuthButton;

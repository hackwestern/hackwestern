import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "../ui/button";

function GoogleAuthButton({
	redirect,
	register,
}: {
	redirect: string;
	register?: boolean;
}) {
	return (
		<Button
			onClick={() => {
				void signIn("google", { callbackUrl: redirect });
			}}
			variant="secondary"
			size="default"
			className="w-[524px]"
		>
			<div className="flex flex-row items-center justify-center gap-1">
				<Image
					src="/images/googlelogo.svg"
					alt="google logo"
					width={25}
					height={25}
				/>
				<span>Sign {register ? "up" : "in"} with Google</span>
			</div>
		</Button>
	);
}

export default GoogleAuthButton;

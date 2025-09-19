import { signIn } from "next-auth/react";
import Head from "next/head";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import GoogleAuthButton from "~/components/auth/googleauth-button";
import GithubAuthButton from "~/components/auth/githubauth-button";
import Link from "next/link";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useRouter } from "next/router";
import { useToast } from "~/components/hooks/use-toast";
import DiscordAuthButton from "~/components/auth/discordauth-button";
import CanvasBackground from "~/components/canvas-background";

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const router = useRouter();
	const { toast } = useToast();

	async function handleSubmit() {
		void signIn("credentials", {
			redirect: false,
			username: email,
			password,
		}).then((response) => {
			if (response && response.ok === false) {
				toast({
					title: "Error",
					description: "Invalid email or password",
					variant: "destructive",
				});
				return;
			}
			void router.push("/dashboard");
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

			<div className="flex w-[684px] m-auto flex-col items-center justify-center bg-hw-radial-gradient">
				<CanvasBackground />
				<div className="flex flex-col items-center z-10 w-[684px] max-w-2xl rounded-[48px] bg-violet-50 bg-white p-12 shadow-md m-[50px]">
					<div className="w-[524px]">
						<h2 className="self-start mb-2 text-[32px] text-heavy font-dico">Sign into your account</h2>
						<h2 className="self-start mb-6 text-2xl text-medium font-figtree">
							The world is your canvas.
						</h2>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void handleSubmit();
							}}
						>
							<h2 className="mb-2 text-sm text-medium font-jetbrains-mono">Email</h2>
							<Input
								type="email"
								onChange={(e) => setEmail(e.target.value)}
								className="mb-4 text-medium bg-highlight font-jetbrains-mono h-[60px]"
								placeholder="Email"
							/>
							<h2 className="mb-2 text-sm text-medium font-jetbrains-mono">Password</h2>
							<Input
								type="password"
								onChange={(e) => setPassword(e.target.value)}
								className="mb-8 text-medium bg-highlight font-jetbrains-mono h-[60px]"
								placeholder="Password"
							/>
							<div className="flex">
								<Button variant="primary" type="submit" size="default" className="w-[524px]">
									Sign In
								</Button>
							</div>
						</form>

						<div className="relative flex w-full items-center md:py-5">
							<div className="flex-grow border-t border-gray-400" />
							<span className="mx-4 flex-shrink text-gray-400">or</span>
							<div className="flex-grow border-t border-gray-400" />
						</div>
						<div className="flex flex-col items-stretch">
							<div className="mt-3">
								<GoogleAuthButton redirect="/dashboard" />
							</div>
							<div className="mt-3">
								<GithubAuthButton redirect="/dashboard" />
							</div>
							<div className="mt-3">
								<DiscordAuthButton redirect="/dashboard" />
							</div>
						</div>
						<div className="mt-4 font-figtree">
							Don&apos;t have an account yet?{" "}

							<Button asChild variant="tertiary" size="default">

								<Link
									className="text-purple-500 hover:text-violet-700 font-figtree"
									href="/register"
								>
									Create Account
								</Link>
							</Button>
						</div>
						<div className="font-figtree">
							Forget password?{" "}
							<Button asChild variant="tertiary" size="default">
								<Link href="/forgot-password">
									Reset Password
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

export const getServerSideProps = hackerLoginRedirect;

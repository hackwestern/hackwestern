import SEO from "~/components/seo";
import { type FormEvent, useState } from "react";
import { hackerLoginRedirect } from "~/utils/redirect";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { AuthLayout } from "~/components/auth/auth-layout";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/router";

export default function ResetRequest() {
  const { toast } = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = api.auth.setPassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully!",
        variant: "default",
      });
      void router.push("/login");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message ?? "Error resetting password.",
        variant: "destructive",
      });
      console.log("error resetting password", error);
    },
  });

  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { isSuccess: isValidToken, isLoading: isCheckingToken } =
    api.auth.checkValidToken.useQuery(
      { token },
      // A bad or used token is a final answer, so show it right away.
      { retry: false },
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Password must be entered",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    reset.mutate({ password, token });
  }

  return (
    <>
      <SEO title="Reset Password" noindex />

      {isCheckingToken ? (
        <AuthLayout>
          <p className="font-figtree text-md-p text-gray-6">
            Checking your link...
          </p>
        </AuthLayout>
      ) : isValidToken ? (
        <AuthLayout title="Choose a new password">
          <p className="font-figtree text-md-p text-gray-6">
            Use at least 8 characters.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="font-figtree text-md-p font-medium text-gray-4"
              >
                New password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className="h-12 bg-white font-figtree text-md-p"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="confirmPassword"
                className="font-figtree text-md-p font-medium text-gray-4"
              >
                Confirm new password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="h-12 bg-white font-figtree text-md-p"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button
              variant="primary-2"
              type="submit"
              size="lg"
              full
              isPending={reset.isPending}
            >
              {reset.isPending ? "Saving..." : "Reset Password"}
            </Button>
          </form>
        </AuthLayout>
      ) : (
        <AuthLayout title="This link has expired">
          <p className="font-figtree text-md-p text-gray-6">
            Password reset links only work once and expire after a while. Ask
            for a new one and we&apos;ll email it to you.
          </p>

          <Button asChild variant="primary-2" size="lg" full>
            <Link href="/forgot-password">Send a new link</Link>
          </Button>

          <div className="flex items-center gap-1.5 font-figtree text-md-p text-gray-6">
            <span>Remembered it?</span>
            <Button asChild variant="tertiary" className="h-max p-0">
              <Link
                className="font-figtree text-light hover:text-medium"
                href="/login"
              >
                Back to sign in
              </Link>
            </Button>
          </div>
        </AuthLayout>
      )}
    </>
  );
}

export const getServerSideProps = hackerLoginRedirect;

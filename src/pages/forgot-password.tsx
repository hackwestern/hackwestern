import SEO from "~/components/seo";
import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { disabledRedirect } from "~/utils/redirect";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { AuthLayout } from "~/components/auth/auth-layout";

export default function ResetRequest() {
  const [email, setEmail] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const { toast } = useToast();
  const reset = api.auth.reset.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent!",
        variant: "default",
      });
      setResetRequested(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message ?? "Error sending reset email.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    if (resetRequested) {
      toast({
        title: "Error",
        description:
          "You have already requested a password reset, please try again in a few minutes.",
        variant: "destructive",
      });
      return;
    }
    reset.mutate({ email });
  }

  return (
    <>
      <SEO title="Forgot Password" noindex />

      <AuthLayout title="Reset your password">
        <p className="font-figtree text-md-p text-gray-6">
          We&apos;ll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-figtree text-md-p font-medium text-gray-4"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="h-12 bg-white font-figtree text-md-p"
              placeholder="hacker@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button
            variant="primary-2"
            type="submit"
            size="lg"
            full
            isPending={reset.isPending}
            disabled={resetRequested}
          >
            {reset.isPending ? "Sending..." : "Reset Password"}
          </Button>
        </form>

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
    </>
  );
}

export const getServerSideProps = disabledRedirect;

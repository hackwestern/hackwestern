import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { authRedirectOrganizer } from "~/utils/redirect";
import type { GetServerSidePropsContext } from "next";

// Format text: replace underscores with spaces and capitalize each word
const formatTitle = (text: string | null | undefined): string => {
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export default function RedeemErrorPage() {
  const router = useRouter();
  const [rewardName, setRewardName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const { reward, user, error } = router.query;
    if (reward && typeof reward === "string") {
      setRewardName(reward);
    }
    if (user && typeof user === "string") {
      setUserName(user);
    }
    if (error && typeof error === "string") {
      setErrorMessage(error);
    }
  }, [router.query]);

  const handleBackToRewards = () => {
    void router.push("/scavenger/redeem");
  };

  const getErrorMessage = () => {
    if (errorMessage) {
      if (errorMessage.includes("not have enough points")) {
        return "This user does not have enough points to redeem this reward.";
      }
      if (errorMessage.includes("out of stock")) {
        return "This reward is out of stock.";
      }
      if (errorMessage.includes("User not found")) {
        return "User not found. Please check the QR code.";
      }
      return errorMessage;
    }
    return "An error occurred during redemption.";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="font-dico text-3xl font-medium text-heavy">
          Redemption Failed
        </h1>

        {/* Reward Name */}
        {rewardName && (
          <div className="space-y-1">
            <p className="font-figtree text-sm text-medium">Reward:</p>
            <p className="font-figtree text-lg font-medium text-heavy">
              {formatTitle(rewardName)}
            </p>
          </div>
        )}

        {/* User Name */}
        {userName && (
          <div className="space-y-1">
            <p className="font-figtree text-sm text-medium">User:</p>
            <p className="font-figtree text-lg font-medium text-heavy">
              {userName}
            </p>
          </div>
        )}

        {/* Error Details */}
        <div className="space-y-1">
          <p className="font-figtree text-sm text-medium">Error:</p>
          <p className="font-figtree text-sm text-red-600">{getErrorMessage()}</p>
        </div>

        {/* Back Button */}
        <button
          onClick={handleBackToRewards}
          className="w-full rounded-lg bg-primary px-6 py-3 font-figtree font-medium text-primary-foreground transition-colors hover:bg-primary-700"
        >
          Back to Rewards
        </button>
      </div>
    </div>
  );
}

export const getServerSideProps = authRedirectOrganizer;


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

export default function RedeemSuccessPage() {
  const router = useRouter();
  const [rewardName, setRewardName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const { reward, user } = router.query;
    if (reward && typeof reward === "string") {
      setRewardName(reward);
    }
    if (user && typeof user === "string") {
      setUserName(user);
    }
  }, [router.query]);

  const handleBackToRewards = () => {
    void router.push("/scavenger/redeem");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="font-dico text-3xl font-medium text-heavy">
          Redemption Successful
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
            <p className="font-figtree text-sm text-medium">Redeemed by:</p>
            <p className="font-figtree text-lg font-medium text-heavy">
              {userName}
            </p>
          </div>
        )}

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

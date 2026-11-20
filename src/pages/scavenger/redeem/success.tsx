import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
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
  const [points, setPoints] = useState<string | null>(null);

  useEffect(() => {
    const { reward, user, points } = router.query;
    if (reward && typeof reward === "string") {
      setRewardName(reward);
    }
    if (user && typeof user === "string") {
      setUserName(user);
    }
    if (points && typeof points === "string") {
      setPoints(points);
    }
  }, [router.query]);

  const handleBackToRewards = () => {
    void router.push("/scavenger/redeem");
  };

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-dashboard-bg-nav p-6 font-figtree">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[10px] border border-dashboard-border-subtle bg-dashboard-bg-surface p-8 text-center shadow-dashboard-card">
        {/* Success Icon */}
        <div className="flex size-16 items-center justify-center rounded-full bg-dashboard-bg-highlight">
          <Check className="size-8 text-dashboard-status-live" />
        </div>

        {/* Success Message */}
        <h1 className="text-[32px] font-bold leading-[1.2] text-dashboard-text-heavy">
          Redemption Successful
        </h1>

        {/* Reward Name */}
        {rewardName && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-dashboard-text-light">
              Reward
            </p>
            <p className="text-lg font-semibold text-dashboard-text-heavy">
              {formatTitle(rewardName)}
            </p>
          </div>
        )}

        {/* User Name */}
        {userName && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-dashboard-text-light">
              Hacker
            </p>
            <p className="text-lg font-semibold text-dashboard-text-heavy">
              {userName}
            </p>
          </div>
        )}

        {/* Points Used */}
        {points && (
          <div className="space-y-1">
            <p className="font-secondary text-sm text-medium">Points used:</p>
            <p className="font-secondary text-lg font-medium text-heavy">
              {points}
            </p>
          </div>
        )}

        {/* Back Button */}
        <DashboardButton className="w-full" onClick={handleBackToRewards}>
          Back to Rewards
        </DashboardButton>
      </div>
    </div>
  );
}

export const getServerSideProps = authRedirectOrganizer;

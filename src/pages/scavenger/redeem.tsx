import { useRouter } from "next/router";
import { useEffect } from "react";
import { api } from "~/utils/api";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { ArrowLeft, ChevronRight, Gift } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import { cn } from "~/lib/utils";

// Function to stop all camera streams
const stopAllCameraStreams = () => {
  if (typeof document === "undefined") return;

  // Stop all video tracks from existing video elements
  const videoElements = document.querySelectorAll("video");
  videoElements.forEach((video) => {
    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      video.srcObject = null;
    }
  });
};

// Format text: replace underscores with spaces and capitalize each word
const formatTitle = (text: string | null | undefined): string => {
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

interface Reward {
  id: number;
  name: string;
  costPoints: number;
  description: string | null;
  quantity: number | null;
}

const RedeemPage = () => {
  const router = useRouter();
  const { data: rewards, isLoading } = api.scavengerHunt.getAllRewards.useQuery(
    undefined,
    {
      staleTime: 30000, // Cache for 30 seconds to reduce refetches
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnMount: false, // Don't refetch on mount if data is still fresh
      refetchOnReconnect: false, // Don't refetch on reconnect if data is still fresh
    },
  );

  // Stop camera when component mounts (when navigating back to rewards page)
  useEffect(() => {
    stopAllCameraStreams();

    // Cleanup on unmount as well
    return () => {
      stopAllCameraStreams();
    };
  }, []);

  const handleRewardClick = (rewardId: number): void => {
    void router.push(`/scavenger/redeem/${rewardId}`);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-dashboard-bg-page md:flex-row">
      <Topbar title="Redeem" isOrganizer />
      <Sidebar isOrganizer />
      <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-10 pt-6 font-figtree md:gap-10 md:p-12">
        {/* Header */}
        <header className="flex flex-col items-start gap-4">
          <DashboardButton
            variant="tertiary"
            onClick={() => {
              void router.push("/scavenger");
            }}
          >
            <ArrowLeft />
            Back
          </DashboardButton>
          <h1 className="dashboard-h1">Select prize to redeem</h1>
        </header>

        {/* Main Content */}
        <div className="flex flex-col gap-2 md:max-w-[640px]">
          {isLoading || !rewards || rewards.length === 0 ? (
            <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
              {isLoading ? "Loading prizes..." : "No prizes available"}
            </p>
          ) : (
            rewards.map((reward) => {
              const soldOut = reward.quantity !== null && reward.quantity <= 0;
              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => handleRewardClick(reward.id)}
                  className={cn(
                    "flex h-[69px] w-full items-center gap-3 rounded-dashboard-2xl border border-dashboard-border-faint bg-dashboard-bg-surface p-3 text-left font-medium leading-default shadow-dashboard-card transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
                    soldOut
                      ? "cursor-pixel-default opacity-dashboard-disabled"
                      : "cursor-pixel-hover hover:bg-dashboard-bg-highlight",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-[45px] shrink-0 items-center justify-center rounded-dashboard-iconBadge bg-dashboard-bg-nav text-dashboard-action-primary"
                  >
                    <Gift className="size-5" strokeWidth={1.67} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate text-base text-dashboard-text-heavy">
                      {formatTitle(reward.name)}
                    </span>
                    {reward.description && (
                      <span className="truncate text-sm text-dashboard-text-light">
                        {formatTitle(reward.description)}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <DashboardTag>{reward.costPoints} pts</DashboardTag>
                    <span className="text-xs text-dashboard-text-light">
                      {reward.quantity === null
                        ? "Unlimited"
                        : soldOut
                          ? "Out of stock"
                          : `${reward.quantity} left`}
                    </span>
                  </span>
                  {!soldOut && (
                    <ChevronRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-dashboard-text-light"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default RedeemPage;

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  if (user?.type !== "organizer") {
    return {
      redirect: {
        destination: "/live",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

import { useRouter } from "next/router";
import { useEffect } from "react";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import type { GetServerSidePropsContext } from "next";

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
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#f5f2f6" }}
    >
      {/* Header */}
      <header className="flex items-center p-4">
        <button
          onClick={() => {
            void router.push("/scavenger");
          }}
          className="font-figtree text-heavy transition-colors hover:text-emphasis"
        >
          Back
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 space-y-6 p-6">
        <h1 className="text-left font-dico text-3xl font-medium text-heavy">
          Select prize to redeem
        </h1>

        {isLoading && (
          <div className="text-center font-figtree text-medium">
            Loading prizes...
          </div>
        )}

        {!isLoading && (!rewards || rewards.length === 0) && (
          <div className="text-center font-figtree text-medium">
            No prizes available
          </div>
        )}

        {!isLoading && rewards && rewards.length > 0 && (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <button
                key={reward.id}
                onClick={() => handleRewardClick(reward.id)}
                className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left font-figtree shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
              >
                <div className="flex-1">
                  <div className="font-semibold text-heavy">
                    {formatTitle(reward.name)}
                  </div>
                  {reward.description && (
                    <div className="text-sm text-medium">
                      {formatTitle(reward.description)}
                    </div>
                  )}
                  <div className="mt-1 text-sm font-medium text-heavy">
                    {reward.costPoints} points
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="font-semibold text-heavy">
                    {reward.quantity ?? "∞"}
                  </div>
                  <div className="text-xs text-medium">left</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RedeemPage;
export const getServerSideProps = authRedirectOrganizer;

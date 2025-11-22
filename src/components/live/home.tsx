import Image from "next/image";
import AddToWallet from "~/components/wallet/add-to-wallet";
import { useState, useEffect } from "react";
import * as QRCode from "qrcode";
import { useSession, signIn } from "next-auth/react";
import { api } from "~/utils/api";

// Format text: replace underscores with spaces and capitalize each word
const formatTitle = (text: string | null | undefined): string => {
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const Home = () => {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<
    "all" | "activities" | "meals" | "redemptions"
  >("all");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Fetch scan history
  const { data: scans, isLoading: scansLoading } =
    api.scavengerHunt.getScans.useQuery(undefined, {
      enabled: !!session?.user?.id,
      refetchInterval: 5000,
    });

  // Fetch user points
  const { data: pointsData, isLoading: pointsLoading } =
    api.scavengerHunt.getPoints.useQuery(undefined, {
      enabled: !!session?.user?.id,
      refetchInterval: 5000,
    });

  useEffect(() => {
    if (session?.user?.id) {
      QRCode.toDataURL(session.user.id, {
        width: 300,
        errorCorrectionLevel: "H",
        color: {
          dark: "#5B2C6F",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("QR code generation error:", err));
    }
  }, [session?.user?.id]);

  // Filter scans based on active tab
  const filteredScans = scans?.filter((scan) => {
    if (activeTab === "all") return true;
    if (activeTab === "redemptions") {
      return scan.type === "redemption";
    }
    // For activities and meals tabs, exclude redemptions
    if (scan.type === "redemption") {
      return false;
    }
    if (activeTab === "meals") {
      return scan.itemCode?.endsWith("_meal");
    }
    if (activeTab === "activities") {
      return (
        scan.itemCode?.endsWith("_act") ||
        scan.itemCode?.endsWith("_att") ||
        scan.itemCode?.endsWith("_win") ||
        scan.itemCode?.endsWith("_ws") ||
        scan.itemCode?.endsWith("_bonus")
      );
    }
    return true;
  });

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center">
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4">
        <h2 className="font-figtree text-2xl font-semibold text-heavy">
          Sign In Required
        </h2>
        <p className="text-center text-medium">
          Please sign in to view your hacker pass and scan history.
        </p>
        <button
          onClick={() => signIn(undefined, { callbackUrl: "/live?tab=home" })}
          className="rounded-lg bg-primary-600 px-6 py-3 font-figtree text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Left Column */}
      <div className="flex w-full flex-col gap-6 lg:w-1/2">
        {/* Devpost Link Section */}
        <div className="rounded-2xl bg-primary-100 p-6">
          <h2 className="mb-4 font-figtree text-xl font-semibold text-heavy">
            Devpost Link
          </h2>
          <a
            href="https://hack-western-12.devpost.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-white p-4 shadow-sm transition-all hover:bg-primary-50 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="font-figtree text-sm font-medium text-heavy">
                  hack-western-12.devpost.com
                </span>
              </div>
              <svg
                className="h-4 w-4 text-medium"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>
        </div>

        {/* Scan History Section */}
        <div className="rounded-2xl bg-primary-100 p-6">
          <h2 className="mb-4 font-figtree text-xl font-semibold text-heavy">
            Scan History
          </h2>

          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-4 py-2 font-figtree text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-primary-600 text-white"
                  : "bg-primary-200 text-heavy hover:bg-primary-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("activities")}
              className={`rounded-lg px-4 py-2 font-figtree text-sm font-medium transition-colors ${
                activeTab === "activities"
                  ? "bg-primary-600 text-white"
                  : "bg-primary-200 text-heavy hover:bg-primary-300"
              }`}
            >
              Activities
            </button>
            <button
              onClick={() => setActiveTab("meals")}
              className={`rounded-lg px-4 py-2 font-figtree text-sm font-medium transition-colors ${
                activeTab === "meals"
                  ? "bg-primary-600 text-white"
                  : "bg-primary-200 text-heavy hover:bg-primary-300"
              }`}
            >
              Meals
            </button>
            <button
              onClick={() => setActiveTab("redemptions")}
              className={`rounded-lg px-4 py-2 font-figtree text-sm font-medium transition-colors ${
                activeTab === "redemptions"
                  ? "bg-primary-600 text-white"
                  : "bg-primary-200 text-heavy hover:bg-primary-300"
              }`}
            >
              Redemptions
            </button>
          </div>

          {/* Content */}
          <div className="rounded-xl bg-primary-50 p-4">
            {scansLoading ? (
              <p className="font-figtree text-sm text-medium">Loading...</p>
            ) : filteredScans && filteredScans.length > 0 ? (
              <div className="space-y-3">
                {filteredScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                  >
                    <div className="flex-1">
                      <p className="font-figtree text-sm font-semibold text-heavy">
                        {formatTitle(scan.itemDescription ?? scan.itemCode)}
                      </p>
                      <p className="font-figtree text-xs text-medium">
                        {scan.createdAt
                          ? new Date(scan.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Unknown time"}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p
                        className={`font-figtree text-sm font-semibold ${
                          scan.points < 0 ? "text-red-600" : "text-primary-600"
                        }`}
                      >
                        {scan.points > 0 ? "+" : ""}
                        {scan.points} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-figtree text-sm italic text-medium">
                {activeTab === "all"
                  ? "You haven't scanned any activities yet!"
                  : activeTab === "meals"
                    ? "You haven't scanned any meals yet!"
                    : activeTab === "redemptions"
                      ? "You haven't redeemed any prizes yet!"
                      : "You haven't scanned any activities yet!"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Your Hacker Pass */}
      <div className="flex w-full flex-col gap-6 pb-4 lg:w-1/2">
        {/* Points Section */}
        <div className="rounded-2xl bg-primary-100 p-6">
          <h2 className="mb-4 font-figtree text-xl font-semibold text-heavy">
            Your Points
          </h2>
          <div className="rounded-xl bg-primary-50 p-4">
            {pointsLoading ? (
              <p className="font-figtree text-sm text-medium">Loading...</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-figtree text-sm text-medium">
                    Current Balance:
                  </p>
                  <p className="font-figtree text-2xl font-bold text-primary-600">
                    {pointsData?.balance ?? 0}
                  </p>
                </div>
                {pointsData?.earned !== null &&
                  pointsData?.earned !== undefined && (
                    <div className="flex items-baseline justify-between border-t border-primary-200 pt-2">
                      <p className="font-figtree text-xs text-medium">
                        Total Earned:
                      </p>
                      <p className="font-figtree text-sm font-medium text-medium">
                        {pointsData.earned} pts
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* QR Code Section */}
        <div className="rounded-2xl bg-primary-100 p-6">
          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-6 shadow-md">
              {qrCodeUrl ? (
                <Image
                  src={qrCodeUrl}
                  alt="Your Hacker Pass QR Code"
                  width={300}
                  height={300}
                  className="h-auto w-full"
                />
              ) : (
                <div className="flex h-[300px] w-[300px] items-center justify-center bg-gray-100">
                  <p className="text-sm text-gray-500">Loading QR code...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Buttons */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <AddToWallet walletType="APPLE" />
            <AddToWallet walletType="GOOGLE" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

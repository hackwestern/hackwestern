import Image from "next/image";
import AddToWallet from "~/components/wallet/add-to-wallet";
import { useState, useEffect } from "react";
import * as QRCode from "qrcode";
import { useSession, signIn } from "next-auth/react";
import { api } from "~/utils/api";

const Home = () => {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"all" | "activities" | "meals">(
    "all",
  );
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const { data: scans, isLoading: isLoadingScans } =
    api.scavengerHunt.getScans.useQuery(undefined, {
      enabled: !!session?.user,
    });

  const filteredScans = scans?.filter((scan) => {
    if (activeTab === "all") return true;
    if (activeTab === "meals") return scan.itemCode?.endsWith("_meal");
    if (activeTab === "activities") return !scan.itemCode?.endsWith("_meal");
    return true;
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
        {/* Upcoming Section */}
        <div className="rounded-2xl bg-primary-100 p-6">
          <h2 className="mb-4 font-figtree text-xl font-semibold text-heavy">
            Upcoming
          </h2>
          <div className="rounded-xl bg-primary-50 p-4">
            <p className="font-figtree text-sm italic text-medium">
              No upcoming events yet, check back during the hackathon!
            </p>
          </div>
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
          </div>

          {/* Content */}
          <div className="min-h-[200px] rounded-xl bg-primary-50 p-4">
            {isLoadingScans ? (
              <div className="flex h-full items-center justify-center py-8">
                <p className="font-figtree text-sm italic text-medium">
                  Loading history...
                </p>
              </div>
            ) : !filteredScans || filteredScans.length === 0 ? (
              <div className="flex h-full items-center justify-center py-8">
                <p className="font-figtree text-sm italic text-medium">
                  {activeTab === "all"
                    ? "You haven't scanned anything yet!"
                    : `No ${activeTab} scans found.`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredScans.map((scan) => (
                  <div
                    key={`${scan.id}-${scan.createdAt?.getTime()}`}
                    className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-all hover:shadow-md"
                  >
                    <div>
                      <p className="font-figtree font-medium text-heavy">
                        {scan.itemDescription ?? scan.itemCode}
                      </p>
                      <p className="font-figtree text-xs text-medium">
                        {scan.createdAt?.toLocaleDateString()} •{" "}
                        {scan.createdAt?.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="rounded-full bg-primary-100 px-3 py-1">
                      <p className="font-figtree text-xs font-semibold text-primary-700">
                        +{scan.points} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Your Hacker Pass */}
      <div className="flex w-full flex-col gap-6 pb-4 lg:w-1/2">
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

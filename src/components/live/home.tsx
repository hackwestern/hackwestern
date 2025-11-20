import Image from "next/image";
import AddToWallet from "~/components/wallet/add-to-wallet";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { useSession } from "next-auth/react";

const Home = () => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"all" | "activities" | "meals">(
    "all",
  );
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

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

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:flex-row lg:gap-8 lg:p-10">
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
          <div className="rounded-xl bg-primary-50 p-4">
            <p className="font-figtree text-sm italic text-medium">
              You&apos;ll see activities you scan into logged here!
            </p>
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

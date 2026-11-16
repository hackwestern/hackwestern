import Image from "next/image";
import AddToWallet from "~/components/wallet/add-to-wallet";
import { useState, useEffect } from "react";
import * as QRCode from "qrcode";
import { useSession, signIn } from "next-auth/react";
import { api } from "~/utils/api";
import { isAdmittedStatus } from "~/lib/admission";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  ActivityCard,
  activityKindFromCode,
} from "~/components/internals/activity-card";
import { ExternalLink } from "lucide-react";
import AllScans from "~/components/live/all-scans";
import { HackerChecklist } from "~/components/live/hacker-checklist";
import { cn } from "~/lib/utils";
import { HW13_DEVPOST_URL } from "~/utils/urls";

// Format text: replace underscores with spaces and capitalize each word
const formatTitle = (text: string | null | undefined): string => {
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const Home = ({ isOrganizer = false }: { isOrganizer?: boolean }) =>
  isOrganizer ? <AllScans /> : <HackerHome />;

const HackerHome = () => {
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

  // Fetch the hacker's application status so we only show a working pass to
  // accepted hackers. The authoritative check lives server-side (the pass and
  // scan endpoints reject unapproved users); this is defense-in-depth / UX.
  const { data: application, isLoading: applicationLoading } =
    api.application.get.useQuery(
      { fields: ["status"] },
      { enabled: !!session?.user?.id },
    );
  const isApproved = isAdmittedStatus(application?.status);

  // Onboarding checklist for accepted hackers. Required: the rest of Home is
  // locked until they've RSVPed.
  const { data: onboarding } = api.onboarding.get.useQuery(undefined, {
    enabled: !!session?.user?.id,
  });
  const checklist = onboarding?.eligible ? onboarding : null;
  const locked =
    !!checklist && !checklist.steps.find((s) => s.id === "rsvp")?.done;

  useEffect(() => {
    if (session?.user?.id && isApproved) {
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
  }, [session?.user?.id, isApproved]);

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
        scan.itemCode?.endsWith("_sw") ||
        scan.itemCode?.endsWith("_bonus")
      );
    }
    return true;
  });

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center font-figtree text-dashboard-text-light">
        Loading...
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 font-figtree">
        <h2 className="text-2xl font-semibold text-dashboard-text-heavy">
          Sign In Required
        </h2>
        <p className="text-center text-dashboard-text-light">
          Please sign in to view your hacker pass and scan history.
        </p>
        <DashboardButton
          onClick={() => signIn(undefined, { callbackUrl: "/live?tab=home" })}
        >
          Sign In
        </DashboardButton>
      </div>
    );
  }

  const tabs = [
    ["all", "All"],
    ["activities", "Activities"],
    ["meals", "Meals"],
    ["redemptions", "Redemptions"],
  ] as const;

  const emptyMessage =
    activeTab === "meals"
      ? "You haven't scanned any meals yet!"
      : activeTab === "redemptions"
        ? "You haven't redeemed any prizes yet!"
        : "You haven't scanned any activities yet!";

  return (
    <div className="flex w-full flex-col gap-6">
      {checklist && !checklist.hidden && <HackerChecklist data={checklist} />}
      <div
        aria-disabled={locked || undefined}
        className={cn(
          "flex w-full flex-col gap-6 lg:flex-row lg:gap-8",
          locked && "pointer-events-none select-none opacity-45",
        )}
      >
        {/* Left Column */}
        <div className="flex w-full flex-col gap-6 lg:w-1/2">
          <DashboardPanel title="Devpost Link">
            <a
              href={HW13_DEVPOST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pixel-hover items-center justify-between gap-3 rounded-dashboard-lg border border-dashboard-border-faint p-3 text-base font-medium text-dashboard-text-heavy transition-colors hover:bg-dashboard-bg-highlight"
            >
              hack-western-13.devpost.com
              <ExternalLink
                aria-hidden="true"
                className="size-5 shrink-0 text-dashboard-text-light"
              />
            </a>
          </DashboardPanel>

          <DashboardPanel title="Scan History">
            <div className="flex flex-wrap gap-2">
              {tabs.map(([key, label]) => (
                <DashboardChip
                  key={key}
                  selected={activeTab === key}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </DashboardChip>
              ))}
            </div>

            {scansLoading ? (
              <p className="text-sm text-dashboard-text-light">Loading...</p>
            ) : filteredScans && filteredScans.length > 0 ? (
              <div className="flex flex-col gap-3">
                {filteredScans.map((scan) => {
                  const time = scan.createdAt
                    ? new Date(scan.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Unknown time";
                  return (
                    <ActivityCard
                      key={scan.id}
                      kind={activityKindFromCode(scan.itemCode)}
                      title={formatTitle(scan.itemDescription ?? scan.itemCode)}
                      meta={`${time} · ${scan.points > 0 ? "+" : ""}${scan.points} pts`}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="rounded-dashboard-lg bg-dashboard-bg-inset p-4 text-sm italic text-dashboard-text-light">
                {emptyMessage}
              </p>
            )}
          </DashboardPanel>
        </div>

        {/* Right Column - Your Hacker Pass */}
        <div className="flex w-full flex-col gap-6 pb-4 lg:w-1/2">
          <DashboardPanel title="Your Points">
            {pointsLoading ? (
              <p className="text-sm text-dashboard-text-light">Loading...</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-inset p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-dashboard-text-light">
                    Current Balance:
                  </p>
                  <p className="text-2xl font-bold text-dashboard-action-primary">
                    {pointsData?.balance ?? 0}
                  </p>
                </div>
                {pointsData?.earned !== null &&
                  pointsData?.earned !== undefined && (
                    <div className="flex items-baseline justify-between border-t border-dashboard-border-subtle pt-2">
                      <p className="text-xs text-dashboard-text-light">
                        Total Earned:
                      </p>
                      <p className="text-sm font-medium text-dashboard-text-medium">
                        {pointsData.earned} pts
                      </p>
                    </div>
                  )}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Your Hacker Pass:">
            <div className="flex justify-center">
              <div className="rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-surface p-6">
                {applicationLoading ? (
                  <div className="flex h-[300px] w-[300px] items-center justify-center bg-dashboard-bg-inset">
                    <p className="text-sm text-dashboard-text-light">
                      Loading QR code...
                    </p>
                  </div>
                ) : !isApproved ? (
                  <div className="flex h-[300px] w-[300px] flex-col items-center justify-center gap-2 bg-dashboard-bg-inset p-6 text-center">
                    <p className="text-sm font-semibold text-dashboard-text-heavy">
                      Hacker pass unavailable
                    </p>
                    <p className="text-xs text-dashboard-text-light">
                      Your hacker pass will appear here once your application
                      has been accepted.
                    </p>
                  </div>
                ) : qrCodeUrl ? (
                  <Image
                    src={qrCodeUrl}
                    alt="Your Hacker Pass QR Code"
                    width={300}
                    height={300}
                    className="h-auto w-full"
                  />
                ) : (
                  <div className="flex h-[300px] w-[300px] items-center justify-center bg-dashboard-bg-inset">
                    <p className="text-sm text-dashboard-text-light">
                      Loading QR code...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {isApproved && (
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                <AddToWallet walletType="APPLE" />
                <AddToWallet walletType="GOOGLE" />
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
};

export default Home;

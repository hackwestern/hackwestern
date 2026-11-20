"use client";

import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { api } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { realmLabel, realmTint, type Realm } from "~/constants/realms";
import jsQR from "jsqr";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

// Type for legacy navigator APIs
interface LegacyNavigator extends Navigator {
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (error: Error) => void,
  ) => void;
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (error: Error) => void,
  ) => void;
  mozGetUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (error: Error) => void,
  ) => void;
  msGetUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (error: Error) => void,
  ) => void;
}

type HeldResult = {
  kind: "success" | "already" | "error";
  name?: string;
  realm?: Realm | null;
  shirtSize?: string | null;
  message?: string;
};

const HELD_STYLES = {
  success: {
    title: "✓ Checked in",
    tint: "bg-dashboard-status-live/15",
    text: "text-dashboard-status-live",
  },
  already: {
    title: "Already checked in",
    tint: "bg-dashboard-status-warning/15",
    text: "text-dashboard-status-warning",
  },
  error: {
    title: "✗ Can't check in",
    tint: "bg-red-100",
    text: "text-red-800",
  },
} as const;

// Covers the camera until Next (or "Photo ID checked") is tapped, or Enter
const HeldResultOverlay = ({
  result,
  onNext,
}: {
  result: HeldResult;
  onNext: () => void;
}) => {
  const style = HELD_STYLES[result.kind];
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={style.title}
      className="fixed inset-0 z-50 bg-dashboard-bg-surface font-figtree"
    >
      <div
        className={cn(
          "flex h-full w-full flex-col gap-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]",
          style.tint,
        )}
      >
        <p className={cn("text-2xl font-bold", style.text)}>{style.title}</p>
        <div className="flex flex-1 flex-col justify-center gap-4">
          {result.name && (
            <p className="break-words text-[44px] font-bold leading-[1.1] text-dashboard-text-heavy md:text-[64px]">
              {result.name}
            </p>
          )}
          {result.realm && (
            <span
              className="self-start rounded-full px-4 py-1 text-lg font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: realmTint[result.realm].tintColor,
                color: realmTint[result.realm].accent,
              }}
            >
              {realmLabel[result.realm]} Realm
            </span>
          )}
          {result.shirtSize && (
            <p className="text-2xl font-semibold text-dashboard-text-heavy">
              Shirt size: {result.shirtSize}
            </p>
          )}
          {result.message && (
            <p className={cn("text-xl font-semibold", style.text)}>
              {result.message}
            </p>
          )}
        </div>
        {/* A new check-in can't be cleared without confirming the ID */}
        <DashboardButton
          autoFocus
          onClick={onNext}
          className="h-16 w-full text-xl font-semibold"
        >
          {result.kind === "success" ? "Photo ID checked" : "Next"}
        </DashboardButton>
      </div>
    </div>
  );
};

const ScanActivityPage = () => {
  const router = useRouter();
  const activityParam = router.query?.activity as string;
  const itemId =
    activityParam && !isNaN(Number(activityParam))
      ? Number(activityParam)
      : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<"scanning" | "success" | "error">(
    "scanning",
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [_testMode, _setTestMode] = useState(false);
  const [activityType, setActivityType] = useState<"attendance" | "win">(
    "attendance",
  );
  const activityTypeRef = useRef(activityType);
  activityTypeRef.current = activityType;
  // The camera keeps running after a scan, so ignore the same QR for a few seconds
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const [_testUserId, _setTestUserId] = useState("");

  // tRPC mutations and queries
  const scanMutation = api.scavengerHunt.scan.useMutation();
  const _utils = api.useUtils();

  const { data: itemData, isLoading: itemLoading } =
    api.scavengerHunt.getScavengerHuntItemById.useQuery(
      { id: itemId! },
      { enabled: !!itemId },
    );

  const activityName = itemData?.name ?? "Activity";
  const isWinnable = itemData?.winPoints != null;
  // Check-in holds each result on screen until the organizer taps Next, so
  // they can compare the name with the hacker's photo ID
  const holdResults = /regist|check[\s-]?in/i.test(itemData?.name ?? "");
  const [held, setHeld] = useState<HeldResult | null>(null);

  // QR Code scanning using camera stream
  const scanQRCode = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current || status !== "scanning") {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Decode QR code using jsQR
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        return code.data;
      }
    } catch (error) {
      console.error("Error decoding QR code:", error);
      // Continue scanning even if one frame fails
    }

    return null;
  };

  // Function to start camera (can be called manually on iOS)
  const startCamera = async () => {
    try {
      setCameraError(null);
      // Check if navigator is available
      if (typeof navigator === "undefined" || !navigator) {
        throw new Error("Navigator not available");
      }

      let stream: MediaStream | null = null;

      // Try to get getUserMedia function from various possible locations
      let getUserMedia:
        | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
        | null = null;

      // Try modern API first (most browsers including iOS Safari 11+)
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        getUserMedia = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
      }
      // Fallback for older browsers/iOS Safari - check legacy APIs
      else {
        const legacyNav = navigator as LegacyNavigator;
        if (
          legacyNav.getUserMedia &&
          typeof legacyNav.getUserMedia === "function"
        ) {
          const legacyGetUserMedia = legacyNav.getUserMedia;
          getUserMedia = (constraints: MediaStreamConstraints) => {
            return new Promise<MediaStream>((resolve, reject) => {
              legacyGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (
          legacyNav.webkitGetUserMedia &&
          typeof legacyNav.webkitGetUserMedia === "function"
        ) {
          const webkitGetUserMedia = legacyNav.webkitGetUserMedia;
          getUserMedia = (constraints: MediaStreamConstraints) => {
            return new Promise<MediaStream>((resolve, reject) => {
              webkitGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (
          legacyNav.mozGetUserMedia &&
          typeof legacyNav.mozGetUserMedia === "function"
        ) {
          const mozGetUserMedia = legacyNav.mozGetUserMedia;
          getUserMedia = (constraints: MediaStreamConstraints) => {
            return new Promise<MediaStream>((resolve, reject) => {
              mozGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (
          legacyNav.msGetUserMedia &&
          typeof legacyNav.msGetUserMedia === "function"
        ) {
          const msGetUserMedia = legacyNav.msGetUserMedia;
          getUserMedia = (constraints: MediaStreamConstraints) => {
            return new Promise<MediaStream>((resolve, reject) => {
              msGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        }
      }

      if (!getUserMedia) {
        // Provide helpful error message
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isHTTPS =
          window.location.protocol === "https:" ||
          window.location.hostname === "localhost";

        if (isIOS && !isHTTPS) {
          throw new Error(
            "Camera requires HTTPS. Please access this page via HTTPS or localhost.",
          );
        } else if (isIOS) {
          throw new Error(
            "Camera access requires a user gesture. Please tap the 'Start Camera' button.",
          );
        } else {
          throw new Error(
            "Camera API not available. Please use a modern browser with camera support.",
          );
        }
      }

      // Request camera access
      stream = await getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!stream) {
        throw new Error("Failed to get camera stream");
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadedmetadata", () => {
          setCameraActive(true);
          setCameraError(null);
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraActive(false);
      const errorMessage =
        error instanceof Error ? error.message : "Unable to access camera";
      setCameraError(errorMessage);
    }
  };

  // Initialize camera on mount (only once)
  useEffect(() => {
    // Try to start camera automatically, but don't fail silently on iOS
    void startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Only run once on mount

  // Start/stop scanning interval based on camera and test mode
  useEffect(() => {
    // Clear existing interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Start scanning only if camera is active, status is scanning, and item exists
    // Stop scanning when status is "success" or "error"
    if (cameraActive && status === "scanning" && !itemLoading && itemData) {
      scanIntervalRef.current = setInterval(() => {
        void (async () => {
          const qrCode = await scanQRCode();
          if (qrCode) {
            // QR code detected! Process it
            handleQRCodeDetected(qrCode);
          }
        })();
      }, 500); // Check every 500ms
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, status, itemLoading, itemData]); // handleQRCodeDetected and scanQRCode are stable functions

  const handleQRCodeDetected = (qrData: string) => {
    // Prevent multiple scans from being processed at the same time
    if (isProcessingRef.current) {
      return;
    }
    const last = lastScanRef.current;
    if (last && last.value === qrData && Date.now() - last.at < 3000) {
      return;
    }
    lastScanRef.current = { value: qrData, at: Date.now() };

    // QR code should contain userId
    // For now, we'll assume it's a simple userId string
    // You may need to parse JSON if your QR codes are more complex

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(qrData) as { userId?: string; id?: string };
      const userId = parsed.userId ?? parsed.id ?? qrData;
      void processScan(userId);
    } catch {
      // Not JSON, treat as plain userId string
      void processScan(qrData);
    }
  };

  // Look up a hacker's name and realm for the result, falling back to their ID
  const fetchUser = async (
    userId: string,
  ): Promise<{
    name: string;
    realm: Realm | null;
    shirtSize: string | null;
  }> => {
    try {
      const userResponse = await fetch(
        `/api/scavenger-hunt/get-user?userId=${encodeURIComponent(userId)}`,
      );
      if (!userResponse.ok)
        return { name: userId, realm: null, shirtSize: null };
      const userData = (await userResponse.json()) as {
        name?: string;
        email?: string;
        realm?: Realm | null;
        shirtSize?: string | null;
      };
      return {
        name: userData?.name ?? userData?.email ?? userId,
        realm: userData?.realm ?? null,
        shirtSize: userData?.shirtSize ?? null,
      };
    } catch (userError) {
      console.error("Error fetching user info:", userError);
      return { name: userId, realm: null, shirtSize: null };
    }
  };

  // Process scan: call backend API to record the scan, then show a toast
  const processScan = async (userId: string) => {
    // Prevent multiple scans from being processed at the same time
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    // Pause scanning while this one is processed (the camera stays on)
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      if (!itemData) {
        throw new Error("Item not found. Please check the activity.");
      }
      await scanMutation.mutateAsync({
        userId,
        itemId: itemData.id,
        activityType: isWinnable ? activityTypeRef.current : undefined,
      });
      const { name: userName, realm, shirtSize } = await fetchUser(userId);
      setStatus("success");
      if (holdResults) {
        setHeld({ kind: "success", name: userName, realm, shirtSize });
        return; // scanning resumes when the organizer taps Next
      }
      toast(
        <span>
          <span className="font-semibold">{userName}</span> scanned successfully
        </span>,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      setStatus("error");
      if (holdResults) {
        const { name: userName, realm, shirtSize } = await fetchUser(userId);
        // fetchUser falls back to the scanned code when nobody matches
        const name = userName !== userId ? userName : undefined;
        if (message.includes("already scanned")) {
          setHeld({ kind: "already", name, realm, shirtSize });
        } else if (/UNAUTHORIZED|FORBIDDEN|not an organizer/.test(message)) {
          setHeld({
            kind: "error",
            name,
            message: "Log in as an organizer to scan.",
          });
        } else {
          setHeld({
            kind: "error",
            name,
            message: message || "Failed to process scan. Please try again.",
          });
        }
        return; // scanning resumes when the organizer taps Next
      }
      if (message.includes("already scanned")) {
        const { name: userName } = await fetchUser(userId);
        toast.error(
          <span>
            <span className="font-semibold">{userName}</span> was already
            scanned
          </span>,
        );
      } else if (/UNAUTHORIZED|FORBIDDEN|not an organizer/.test(message)) {
        toast.error("Log in as an organizer to scan.");
      } else {
        // Server errors (like an unapproved hacker) are expected, so only log unexpected ones
        if (!(error instanceof TRPCClientError)) {
          console.error("Error processing scan:", error);
        }
        toast.error(message || "Failed to process scan. Please try again.");
      }
    }

    // Resume scanning shortly after (the useEffect restarts it when status changes back to "scanning")
    setTimeout(() => {
      setStatus("scanning");
      isProcessingRef.current = false;
    }, 1500);
  };

  // Navigation is now handled directly in processScan after setting success status

  // Close the held result and scan again. The same badge is ignored for a few
  // seconds in case it's still in front of the camera.
  const next = () => {
    const last = lastScanRef.current;
    if (last) lastScanRef.current = { value: last.value, at: Date.now() };
    setHeld(null);
    setStatus("scanning");
    isProcessingRef.current = false;
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-dashboard-bg-nav font-figtree">
      {held && <HeldResultOverlay result={held} onNext={next} />}
      {itemLoading && (
        <p className="fixed inset-0 flex items-center justify-center text-base font-medium text-dashboard-text-medium">
          Loading activity...
        </p>
      )}
      {/* Top Bar */}
      <header
        className={cn(
          "flex flex-col items-start gap-3 px-6 pb-6 pt-5",
          itemLoading && "invisible",
        )}
      >
        <DashboardButton
          variant="tertiary"
          className="font-semibold text-dashboard-text-heavy md:text-[16px]"
          onClick={() => {
            void router.push("/scavenger");
          }}
        >
          <ArrowLeft />
          Back
        </DashboardButton>
        <h1 className="text-[32px] font-bold leading-[1.2] text-dashboard-text-heavy">
          {activityName}
        </h1>
        {!itemLoading && !itemData && itemId !== null && (
          <p className="text-sm font-medium text-dashboard-status-warning">
            Item not found
          </p>
        )}
        {isWinnable && (
          <Tabs
            value={activityType}
            onValueChange={(value) =>
              setActivityType(value as "attendance" | "win")
            }
          >
            <TabsList aria-label="What to scan for" className="border-2">
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="win">Win</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      {/* Camera View - Takes up rest of screen */}
      <div
        className={cn(
          "relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-t-[10px] border border-dashboard-border-subtle bg-dashboard-bg-surface shadow-dashboard-card",
          itemLoading && "invisible",
        )}
      >
        {/* Video element for camera. Pinned to the box so it fills it: as a plain
            flex child it kept the camera's own shape and left grey bars. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />

        {/* Hidden canvas for QR code detection */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner frame overlay - Always show since test mode is disabled */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="aspect-square w-[87%] max-w-[340px] border-2 border-white" />
        </div>

        {/* Camera Error / Start Camera Button */}
        {!cameraActive && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dashboard-bg-inset p-6">
            <p className="text-center text-base font-medium text-dashboard-text-medium">
              {cameraError}
            </p>
            <DashboardButton onClick={startCamera}>
              Start Camera
            </DashboardButton>
          </div>
        )}

        {/* Test Mode UI - COMMENTED OUT: Forcing camera mode only */}
        {/* {testMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-6">
            <div className="text-center space-y-2">
              <p className="font-secondary text-lg text-heavy font-medium">
                Test Mode - No Camera Required
              </p>
              <p className="font-secondary text-sm text-medium">
                Enter a user ID or QR code data to simulate scanning
              </p>
            </div>
            
            <div className="w-full max-w-md space-y-4">
              <input
                type="text"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Enter user ID (e.g., user123 or a QR code)"
                className="w-full px-4 py-3 rounded-lg border-2 border-white bg-white font-secondary text-heavy placeholder:text-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && testUserId.trim()) {
                    handleQRCodeDetected(testUserId.trim());
                  }
                }}
              />
              <button
                onClick={() => {
                  if (testUserId.trim()) {
                    handleQRCodeDetected(testUserId.trim());
                  }
                }}
                disabled={!testUserId.trim() || status !== "scanning"}
                className="w-full px-4 py-3 rounded-lg bg-white hover:bg-violet-100 active:bg-violet-200 font-secondary font-medium text-heavy shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simulate Scan
              </button>
              <button
                onClick={() => {
                  setTestMode(false);
                  setTestUserId("");
                  // Try to restart camera
                  if (!cameraActive && !streamRef.current) {
                    const startCamera = async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: "environment" },
                        });
                        streamRef.current = stream;
                        if (videoRef.current) {
                          videoRef.current.srcObject = stream;
                          videoRef.current.addEventListener("loadedmetadata", () => {
                            setCameraActive(true);
                          });
                        }
                      } catch (error) {
                        console.error("Error accessing camera:", error);
                        setTestMode(true);
                      }
                    };
                    startCamera();
                  }
                }}
                className="w-full px-4 py-2 rounded-lg bg-violet-200 hover:bg-violet-300 font-secondary font-medium text-heavy transition-colors text-sm"
              >
                Try Camera Again
              </button>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default ScanActivityPage;

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

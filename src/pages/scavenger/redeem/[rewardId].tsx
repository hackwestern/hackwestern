"use client";

import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";
import jsQR from "jsqr";
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

// Format text: replace underscores with spaces and capitalize each word
const formatTitle = (text: string | null | undefined): string => {
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

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

const RedeemScanPage = () => {
  const router = useRouter();
  const rewardIdParam = router.query?.rewardId as string;
  const rewardId = rewardIdParam ? Number(rewardIdParam) : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<"scanning" | "success" | "error">(
    "scanning",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // tRPC mutations and queries
  const redeemMutation = api.scavengerHunt.redeemForUser.useMutation();
  const utils = api.useUtils();

  // Fetch reward details
  const { data: rewardData, isLoading: rewardLoading } =
    api.scavengerHunt.getRewardById.useQuery(
      { id: rewardId! },
      {
        enabled: !!rewardId,
        staleTime: 10000, // Cache for 10 seconds
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch on mount if data is still fresh
        refetchOnReconnect: false, // Don't refetch on reconnect if data is still fresh
      },
    );

  const rewardName = formatTitle(rewardData?.name ?? "Reward");

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

  // Function to start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (typeof navigator === "undefined" || !navigator) {
        throw new Error("Navigator not available");
      }

      let stream: MediaStream | null = null;

      // Try to get getUserMedia function from various possible locations
      let getUserMedia:
        | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
        | null = null;

      // Try modern API first
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        getUserMedia = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
      }
      // Fallback for older browsers
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
          facingMode: "environment",
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
      setErrorMessage(
        `Unable to access camera: ${errorMessage}. Please check permissions.`,
      );
    }
  };

  // Initialize camera on mount
  useEffect(() => {
    void startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start/stop scanning interval based on camera
  useEffect(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (cameraActive && status === "scanning" && !rewardLoading && rewardData) {
      scanIntervalRef.current = setInterval(() => {
        void (async () => {
          const qrCode = await scanQRCode();
          if (qrCode) {
            handleQRCodeDetected(qrCode);
          }
        })();
      }, 500);
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraActive, status, rewardLoading, rewardData]);

  // Stop camera when scan is successful
  useEffect(() => {
    if (status === "success") {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraActive(false);
      }
    }
  }, [status]);

  const handleQRCodeDetected = (qrData: string) => {
    if (isProcessingRef.current) {
      return;
    }

    try {
      const parsed = JSON.parse(qrData) as { userId?: string; id?: string };
      const userId = parsed.userId ?? parsed.id ?? qrData;
      void processRedemption(userId);
    } catch {
      void processRedemption(qrData);
    }
  };

  // Process redemption: call backend API to redeem reward for user
  const processRedemption = async (userId: string) => {
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    // Stop camera and scanning immediately
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }

    // Also clear video element's srcObject to fully release the camera
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    try {
      // Validate that we have a reward
      if (!rewardId) {
        setErrorMessage("No reward selected");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      if (!rewardLoading && !rewardData) {
        setErrorMessage("Reward not found. Please check the reward.");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      if (rewardLoading) {
        setErrorMessage("Loading reward details...");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 2000);
        return;
      }

      // Call the redeem mutation
      try {
        const result = await redeemMutation.mutateAsync({
          userId,
          rewardId: rewardData!.id,
          expectedCost: rewardData!.costPoints,
        });

        // Success - use user info from mutation response (no extra API call needed!)
        const userName = result.user?.name ?? result.user?.email ?? userId;
        setStatus("success");

        // Invalidate rewards queries to update quantities in cache
        void utils.scavengerHunt.getAllRewards.invalidate();
        void utils.scavengerHunt.getRewardById.invalidate({
          id: rewardData!.id,
        });

        // Navigate to success page
        void router.push({
          pathname: "/scavenger/redeem/success",
          query: {
            reward: formatTitle(rewardData?.name ?? "Reward"),
            user: userName,
            points: result.pointsUsed,
          },
        });
        return;
      } catch (redeemError: unknown) {
        let message = "";
        let errorCode = "";

        if (redeemError && typeof redeemError === "object") {
          if ("message" in redeemError) {
            message = String(redeemError.message);
          } else if (
            "data" in redeemError &&
            typeof redeemError.data === "object" &&
            redeemError.data &&
            "message" in redeemError.data
          ) {
            message = String(redeemError.data.message);
          }

          if ("code" in redeemError) {
            errorCode = String(redeemError.code);
          } else if (
            "data" in redeemError &&
            typeof redeemError.data === "object" &&
            redeemError.data &&
            "code" in redeemError.data
          ) {
            errorCode = String(redeemError.data.code);
          }
        }

        // For errors, try to get user info - use cached query if available, otherwise fetch
        let userName = userId;
        try {
          // Try to use cached query first (may already be in cache from a previous scan)
          const cachedUser = utils.scavengerHunt.getUserById.getData({
            userId,
          });
          if (cachedUser) {
            userName = cachedUser.name ?? cachedUser.email ?? userId;
          } else {
            // If not in cache, fetch it
            const userData = await utils.scavengerHunt.getUserById.fetch({
              userId,
            });
            userName = userData?.name ?? userData?.email ?? userId;
          }
        } catch (userError) {
          console.error("Error fetching user info:", userError);
          // Fallback to userId if query fails - user info is nice-to-have for errors
        }

        // The price or stock may have changed, so show the latest when back
        void utils.scavengerHunt.getRewardById.invalidate({
          id: rewardData!.id,
        });

        // Navigate to error page with appropriate message
        void router.push({
          pathname: "/scavenger/redeem/error",
          query: {
            reward: formatTitle(rewardData?.name ?? "Reward"),
            user: userName,
            error: message || "Unknown error",
          },
        });
        return;
      }
    } catch (error: unknown) {
      console.error("Error processing redemption:", error);
      let errorMsg = "Failed to process redemption. Please try again.";

      if (error && typeof error === "object" && "message" in error) {
        errorMsg = String(error.message);
      }

      setErrorMessage(errorMsg);
      setStatus("error");

      setTimeout(() => {
        setStatus("scanning");
        setErrorMessage(null);
        isProcessingRef.current = false;
      }, 3000);
    } finally {
      if (status !== "success") {
        // Reset will happen in setTimeout
      }
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-dashboard-bg-nav font-figtree">
      {rewardLoading && (
        <p className="fixed inset-0 flex items-center justify-center text-base font-medium text-dashboard-text-medium">
          Loading reward...
        </p>
      )}
      {/* Top Bar */}
      <header
        className={cn(
          "flex flex-col items-start gap-3 px-6 pb-6 pt-5",
          rewardLoading && "invisible",
        )}
      >
        <DashboardButton
          variant="tertiary"
          className="font-semibold text-dashboard-text-heavy md:text-[16px]"
          onClick={() => {
            void router.push("/scavenger/redeem");
          }}
        >
          <ArrowLeft />
          Back
        </DashboardButton>
        <h1 className="text-[32px] font-bold leading-[1.2] text-dashboard-text-heavy">
          {rewardName}
        </h1>
        {rewardData && (
          <div className="flex flex-col gap-1 text-sm font-medium text-dashboard-text-medium">
            {rewardData.description && (
              <p>{formatTitle(rewardData.description)}</p>
            )}
            <p className="text-dashboard-text-heavy">
              Cost: {rewardData.costPoints} points
            </p>
            <p>Quantity left: {rewardData.quantity ?? "∞"}</p>
          </div>
        )}
        {!rewardLoading && !rewardData && rewardId && (
          <p className="text-sm font-medium text-dashboard-status-warning">
            Reward not found
          </p>
        )}
      </header>

      {/* Camera View - Takes up rest of screen */}
      <div
        className={cn(
          "relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-t-[10px] border border-dashboard-border-subtle bg-dashboard-bg-surface shadow-dashboard-card",
          rewardLoading && "invisible",
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner frame overlay */}
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
      </div>

      {/* Error Overlay */}
      {status === "error" && errorMessage && (
        <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-dashboard-border-subtle bg-dashboard-bg-surface px-4 py-3 text-sm font-medium text-dashboard-status-warning shadow-dashboard-card">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default RedeemScanPage;

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

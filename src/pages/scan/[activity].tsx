"use client";

import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import { api } from "~/utils/api";
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

const ScanActivityPage = () => {
  const router = useRouter();
  const activityParam = router.query?.activity as string;
  // Try to parse as itemId (number), fallback to code if it's a string
  const itemId = activityParam
    ? isNaN(Number(activityParam))
      ? null
      : Number(activityParam)
    : null;
  const itemCode =
    activityParam && isNaN(Number(activityParam)) ? activityParam : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<"scanning" | "success" | "error">(
    "scanning",
  );
  const [scannedName, setScannedName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [_testMode, _setTestMode] = useState(false);
  const [_testUserId, _setTestUserId] = useState("");

  // tRPC mutations and queries
  const scanMutation = api.scavengerHunt.scan.useMutation();
  const _utils = api.useUtils();

  // Fetch item details - try by ID first, then by code
  const { data: itemDataById, isLoading: loadingById } =
    api.scavengerHunt.getScavengerHuntItemById.useQuery(
      { id: itemId! },
      { enabled: !!itemId },
    );

  const { data: itemDataByCode, isLoading: loadingByCode } =
    api.scavengerHunt.getScavengerHuntItem.useQuery(
      { code: itemCode! },
      { enabled: !!itemCode && !itemId },
    );

  const itemData = itemDataById ?? itemDataByCode;
  const itemLoading = loadingById ?? loadingByCode;

  const activityName = itemData?.description ?? itemData?.code ?? "Activity";

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
      setErrorMessage(
        `Unable to access camera: ${errorMessage}. Please check permissions.`,
      );
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

  // Stop camera when scan is successful
  useEffect(() => {
    if (status === "success") {
      // Stop scanning interval
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }

      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraActive(false);
      }
    }
  }, [status]);

  const handleQRCodeDetected = (qrData: string) => {
    // Prevent multiple scans from being processed at the same time
    if (isProcessingRef.current) {
      return;
    }

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

  // Process scan: call backend API to record the scan
  const processScan = async (userId: string) => {
    // Prevent multiple scans from being processed at the same time
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    // Stop camera and scanning immediately when scan is detected
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }

    try {
      // Validate that we have an item
      if (!itemId && !itemCode) {
        setErrorMessage("No activity selected");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      // If itemData is loaded and doesn't match, or if itemLoading is false and itemData is null, item doesn't exist
      if (!itemLoading && !itemData) {
        setErrorMessage("Item not found. Please check the activity.");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      // If we're still loading item data, wait a bit
      if (itemLoading) {
        setErrorMessage("Loading item details...");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 2000);
        return;
      }

      // Call the scan mutation with itemId (preferred) or itemCode
      try {
        await scanMutation.mutateAsync({
          userId,
          itemId: itemData?.id,
          itemCode: itemData?.code,
        });
      } catch (scanError: unknown) {
        // Check if it's an "already scanned" error before re-throwing
        let message = "";
        let errorCode = "";

        if (scanError && typeof scanError === "object") {
          if ("message" in scanError) {
            message = String(scanError.message);
          } else if (
            "data" in scanError &&
            typeof scanError.data === "object" &&
            scanError.data &&
            "message" in scanError.data
          ) {
            message = String(scanError.data.message);
          } else if (
            "shape" in scanError &&
            typeof scanError.shape === "object" &&
            scanError.shape &&
            "message" in scanError.shape
          ) {
            message = String(scanError.shape.message);
          }

          if ("code" in scanError) {
            errorCode = String(scanError.code);
          } else if (
            "data" in scanError &&
            typeof scanError.data === "object" &&
            scanError.data &&
            "code" in scanError.data
          ) {
            errorCode = String(scanError.data.code);
          }
        }

        const isAlreadyScannedError =
          message &&
          (message.includes("already scanned") ||
            message.includes("Item already scanned") ||
            (errorCode === "BAD_REQUEST" &&
              message.toLowerCase().includes("scan")));

        if (isAlreadyScannedError) {
          // Fetch user info to display their name
          let userName = userId;
          try {
            // Directly query the database since getUserById might not be available
            const userResponse = await fetch(
              `/api/scavenger-hunt/get-user?userId=${encodeURIComponent(userId)}`,
            );
            if (userResponse.ok) {
              const userData = (await userResponse.json()) as {
                name?: string;
                email?: string;
              };
              userName = userData?.name ?? userData?.email ?? userId;
            }
          } catch (userError) {
            // If we can't get user info, just use userId
            console.error(
              "Error fetching user info for already scanned:",
              userError,
            );
          }

          // Navigate to already-scanned page with activity name and user name
          const activityName =
            itemData?.description ?? activityParam ?? "Activity";
          void router.push({
            pathname: "/scan/already-scanned",
            query: {
              activity: activityName,
              user: userName,
            },
          });
          isProcessingRef.current = false; // Reset flag before navigation
          return; // Exit early, don't throw error and don't continue to success
        }

        // Re-throw if it's not an "already scanned" error
        throw scanError;
      }

      // Only execute success flow if mutation succeeded (no error thrown)
      // Fetch user info to display their name
      let userName = userId;
      try {
        // Fetch user data via API
        const userResponse = await fetch(
          `/api/scavenger-hunt/get-user?userId=${encodeURIComponent(userId)}`,
        );
        if (userResponse.ok) {
          const userData = (await userResponse.json()) as {
            name?: string;
            email?: string;
          };
          userName = userData?.name ?? userData?.email ?? userId;
        }
        setScannedName(userName);
      } catch (userError) {
        // If we can't get user info, just use userId
        console.error("Error fetching user info:", userError);
        setScannedName(userId);
      }

      // Set success status
      setStatus("success");

      // Navigate to success page with activity name, user name, and activity param for redirect
      const activityName = itemData?.description ?? activityParam ?? "Activity";
      void router.push({
        pathname: "/scan/success",
        query: {
          activity: activityName,
          user: userName,
          activityParam: activityParam ?? "",
        },
      });
      return; // Exit early after successful navigation

      // The useEffect will automatically resume scanning when status changes back to "scanning"
    } catch (error: unknown) {
      // Extract error message from various possible error formats FIRST
      // to check if it's "already scanned" before logging
      let message = "";
      let errorCode = "";
      if (error && typeof error === "object") {
        // Try different possible error message locations
        if ("message" in error) {
          message = String(error.message);
        } else if (
          "data" in error &&
          typeof error.data === "object" &&
          error.data &&
          "message" in error.data
        ) {
          message = String(error.data.message);
        } else if (
          "shape" in error &&
          typeof error.shape === "object" &&
          error.shape &&
          "message" in error.shape
        ) {
          message = String(error.shape.message);
        }

        // Also check for error code
        if ("code" in error) {
          errorCode = String(error.code);
        } else if (
          "data" in error &&
          typeof error.data === "object" &&
          error.data &&
          "code" in error.data
        ) {
          errorCode = String(error.data.code);
        }
      }

      // Check if it's an "already scanned" error BEFORE logging
      // The error message should be "Item already scanned" or contain "already scanned"
      const isAlreadyScannedError =
        message &&
        (message.includes("already scanned") ||
          message.includes("Item already scanned") ||
          (errorCode === "BAD_REQUEST" &&
            message.toLowerCase().includes("scan")));

      if (isAlreadyScannedError) {
        // Don't log "already scanned" errors - just navigate silently
        // Fetch user info to display their name
        let userName = userId;
        try {
          // Fetch user data via API
          const userResponse = await fetch(
            `/api/scavenger-hunt/get-user?userId=${encodeURIComponent(userId)}`,
          );
          if (userResponse.ok) {
            const userData = (await userResponse.json()) as {
              name?: string;
              email?: string;
            };
            userName = userData?.name ?? userData?.email ?? userId;
          }
        } catch (userError) {
          // If we can't get user info, just use userId
          console.error(
            "Error fetching user info for already scanned:",
            userError,
          );
        }

        // Navigate to already-scanned page with activity name, user name, and activity param for redirect
        const activityName =
          itemData?.description ?? activityParam ?? "Activity";
        void router.push({
          pathname: "/scan/already-scanned",
          query: {
            activity: activityName,
            user: userName,
            activityParam: activityParam ?? "",
          },
        });
        return; // Exit early, don't set error state
      }

      // Handle other errors - only log if not "already scanned"
      console.error("Error processing scan:", error);
      let errorMsg = "Failed to process scan. Please try again.";

      if (message?.includes("not found")) {
        errorMsg = message;
        setErrorMessage(errorMsg);
      } else if (
        message &&
        (message.includes("UNAUTHORIZED") ||
          message.includes("FORBIDDEN") ||
          message.includes("not an organizer"))
      ) {
        errorMsg =
          "Authentication required. Please log in as an organizer to scan. (This is normal for testing - you can still use test mode to see how it works!)";
        setErrorMessage(errorMsg);
      } else if (message) {
        errorMsg = message;
        setErrorMessage(errorMsg);
      } else {
        setErrorMessage(errorMsg);
      }

      setStatus("error");

      // Reset after error (the useEffect will handle restarting scanning)
      setTimeout(() => {
        setStatus("scanning");
        setErrorMessage(null);
        isProcessingRef.current = false; // Reset processing flag
      }, 3000);
    } finally {
      // Reset processing flag if we didn't navigate away
      // (navigation happens in try/catch blocks, so this is a safety net)
      if (status !== "success") {
        // Only reset if we're not navigating (navigation will unmount component)
        // Actually, we don't need this since navigation unmounts the component
      }
    }
  };

  // Navigation is now handled directly in processScan after setting success status

  return (
    <div
      className="flex min-h-screen w-full flex-col"
      style={{ backgroundColor: "#f5f2f6" }}
    >
      {/* Top Bar */}
      <header className="w-full space-y-2 p-4">
        <button
          onClick={() => {
            void router.push("/scavenger");
          }}
          className="font-figtree text-heavy transition-colors hover:text-emphasis"
        >
          Back
        </button>
        <div className="space-y-1">
          <h1 className="text-left font-dico text-3xl font-medium capitalize text-heavy">
            {activityName}
          </h1>
          {itemLoading && (
            <p className="font-figtree text-sm text-medium">
              Loading item details...
            </p>
          )}
          {itemData && (
            <div className="space-y-1">
              {itemData.description && (
                <p className="font-figtree text-sm text-medium">
                  {itemData.description}
                </p>
              )}
              <p className="font-figtree text-sm font-medium text-heavy">
                Points: {itemData.points}
              </p>
            </div>
          )}
          {!itemLoading && !itemData && (itemId ?? itemCode) && (
            <p className="font-figtree text-sm text-red-600">Item not found</p>
          )}
        </div>
      </header>

      {/* Camera View or Test Mode - Takes up rest of screen */}
      <div className="relative flex w-full flex-1 items-center justify-center bg-gray-300">
        {/* Video element for camera - Always show since test mode is disabled */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />

        {/* Hidden canvas for QR code detection */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner frame overlay - Always show since test mode is disabled */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="aspect-square w-[88%] rounded-lg border-2 border-white md:w-[60%] lg:w-[50%]" />
        </div>

        {/* Camera Error / Start Camera Button */}
        {!cameraActive && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-300 p-6">
            <p className="mb-4 text-center font-figtree text-heavy">
              {cameraError}
            </p>
            <button
              onClick={startCamera}
              className="rounded-lg bg-white px-6 py-3 font-figtree font-medium text-heavy shadow-md transition-colors hover:bg-violet-100 active:bg-violet-200"
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Test Mode UI - COMMENTED OUT: Forcing camera mode only */}
        {/* {testMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-6">
            <div className="text-center space-y-2">
              <p className="font-figtree text-lg text-heavy font-medium">
                Test Mode - No Camera Required
              </p>
              <p className="font-figtree text-sm text-medium">
                Enter a user ID or QR code data to simulate scanning
              </p>
            </div>
            
            <div className="w-full max-w-md space-y-4">
              <input
                type="text"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Enter user ID (e.g., user123 or a QR code)"
                className="w-full px-4 py-3 rounded-lg border-2 border-white bg-white font-figtree text-heavy placeholder:text-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="w-full px-4 py-3 rounded-lg bg-white hover:bg-violet-100 active:bg-violet-200 font-figtree font-medium text-heavy shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full px-4 py-2 rounded-lg bg-violet-200 hover:bg-violet-300 font-figtree font-medium text-heavy transition-colors text-sm"
              >
                Try Camera Again
              </button>
            </div>
          </div>
        )} */}
      </div>

      {/* Success Overlay */}
      {status === "success" && scannedName && (
        <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-white px-4 py-3 font-figtree text-heavy opacity-100 shadow-lg transition-opacity duration-300">
          {scannedName} scanned successfully
        </div>
      )}

      {/* Error Overlay - only show for non-"already scanned" errors */}
      {status === "error" && errorMessage && (
        <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-3 font-figtree text-red-700 opacity-100 shadow-lg transition-opacity duration-300">
          {errorMessage}
        </div>
      )}
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

"use client";

import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import { api } from "~/utils/api";

const ScanActivityPage = () => {
  const router = useRouter();
  const activity = router.query?.activity as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<"scanning" | "success" | "error">(
    "scanning",
  );
  const [scannedName, setScannedName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testUserId, setTestUserId] = useState("");

  // tRPC mutations and queries
  const scanMutation = api.scavengerHunt.scan.useMutation();
  const utils = api.useUtils();

  // Format activity name: convert slug to readable format
  const formatActivityName = (slug: string): string => {
    if (!slug) return "Activity";
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const activityName = activity ? formatActivityName(activity) : "Activity";

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

    // Try to decode QR code using jsQR or similar
    // For now, we'll use a simple text decoder approach
    // In production, use a proper QR code library like jsQR or html5-qrcode

    // This is a placeholder - you'll need to integrate a QR code library
    // For example: const code = jsQR(imageData.data, imageData.width, imageData.height);

    return null;
  };

  // Initialize camera on mount (only once)
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // Use back camera on mobile
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
        setCameraActive(false);
        // If camera fails, show error but don't automatically enable test mode
        // setTestMode(true); // Commented out - forcing camera mode only
        setErrorMessage("Unable to access camera. Please check permissions.");
      }
    };

    startCamera();

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

    // Start scanning only if camera is active and status is scanning
    // testMode check removed - forcing camera mode only
    if (cameraActive && status === "scanning") {
      scanIntervalRef.current = setInterval(async () => {
        const qrCode = await scanQRCode();
        if (qrCode) {
          // QR code detected! Process it
          handleQRCodeDetected(qrCode);
        }
      }, 500); // Check every 500ms
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraActive, status]); // Removed testMode dependency - forcing camera mode only

  const handleQRCodeDetected = (qrData: string) => {
    // QR code should contain userId
    // For now, we'll assume it's a simple userId string
    // You may need to parse JSON if your QR codes are more complex

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(qrData);
      const userId = parsed.userId || parsed.id || qrData;
      processScan(userId);
    } catch {
      // Not JSON, treat as plain userId string
      processScan(qrData);
    }
  };

  // Process scan: call backend API to record the scan
  const processScan = async (userId: string) => {
    try {
      // Validate that we have an activity
      if (!activity) {
        setErrorMessage("No activity selected");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      // The activity slug is used as the itemCode
      // The itemCode should match a code in the scavengerHuntItems table
      // If your item codes are different from the activity slugs, you'll need to map them here
      // For example: "friday-dinner" might map to "FRIDAY_DINNER" or stay as "friday-dinner"
      const itemCode = activity; // Using activity slug directly - adjust if needed

      // Call the scan mutation
      await scanMutation.mutateAsync({
        userId,
        itemCode,
      });

      // Fetch user info to display their name
      try {
        const userData = await utils.scavengerHunt.getUserById.fetch({
          userId,
        });
        setScannedName(userData.name || userData.email || userId);
      } catch (userError) {
        // If we can't get user info, just use userId
        console.error("Error fetching user info:", userError);
        setScannedName(userId);
      }

      // Set success status
      setStatus("success");

      // The useEffect will automatically resume scanning when status changes back to "scanning"
    } catch (error: unknown) {
      console.error("Error processing scan:", error);

      // Handle different error types
      let errorMsg = "Failed to process scan. Please try again.";

      if (error && typeof error === "object" && "message" in error) {
        const message = error.message as string;
        if (message.includes("already scanned")) {
          errorMsg = "This item has already been scanned for this user.";
        } else if (message.includes("not found")) {
          errorMsg = message;
        } else if (
          message.includes("UNAUTHORIZED") ||
          message.includes("FORBIDDEN") ||
          message.includes("not an organizer")
        ) {
          errorMsg =
            "Authentication required. Please log in as an organizer to scan. (This is normal for testing - you can still use test mode to see how it works!)";
        } else {
          errorMsg = message;
        }
      }

      setErrorMessage(errorMsg);
      setStatus("error");

      // Reset after error (the useEffect will handle restarting scanning)
      setTimeout(() => {
        setStatus("scanning");
        setErrorMessage(null);
      }, 3000);
    }
  };

  // Auto-reset after success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        setStatus("scanning");
        setScannedName(null);
        // Clear test input after successful scan - COMMENTED OUT: Test mode disabled
        // if (testMode) {
        //   setTestUserId("");
        // }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [status, scannedName]); // Removed testMode dependency since it's disabled

  return (
    <div
      className="flex min-h-screen w-full flex-col"
      style={{ backgroundColor: "#f5f2f6" }}
    >
      {/* Top Bar */}
      <header className="w-full space-y-2 p-4">
        <button
          onClick={() => router.push("/scavenger")}
          className="font-figtree text-heavy transition-colors hover:text-emphasis"
        >
          Back
        </button>
        <h1 className="text-left font-dico text-3xl font-medium capitalize text-heavy">
          {activityName}
        </h1>
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

      {/* Error Overlay */}
      {status === "error" && errorMessage && (
        <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-3 font-figtree text-red-700 opacity-100 shadow-lg transition-opacity duration-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default ScanActivityPage;

"use client";

import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { api } from "~/utils/api";

// Hardcoded test scanner info
const TEST_SCANNER_ID = "37507f9f-5e9b-4daf-bb65-6a6798495b76";
const TEST_SCANNER_NAME = "Jasmine Gu";
const TEST_SCANNER_EMAIL = "jazz.gu2004@gmail.com";

const TestQRScanPage = () => {
  const router = useRouter();
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
  const [itemId, setItemId] = useState<number | null>(null);
  const [itemCode, setItemCode] = useState<string | null>(null);
  const [lastScannedUserId, setLastScannedUserId] = useState<string | null>(
    null,
  );

  // Fetch all items for selection
  const { data: items } = api.scavengerHunt.getAllScavengerHuntItems.useQuery();

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
      const jsQR = (await import("jsqr")).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        return code.data;
      }
    } catch (error) {
      console.error("Error decoding QR code:", error);
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

      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } else {
        throw new Error("Camera API not available");
      }

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

  // Initialize camera on mount
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start/stop scanning interval - stop when success
  useEffect(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Only scan when status is "scanning" (not "success" or "error")
    if (cameraActive && status === "scanning" && itemId) {
      scanIntervalRef.current = setInterval(async () => {
        const qrCode = await scanQRCode();
        if (qrCode) {
          handleQRCodeDetected(qrCode);
        }
      }, 500);
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraActive, status, itemId]);

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

    try {
      const parsed = JSON.parse(qrData);
      const userId = parsed.userId || parsed.id || qrData;
      setLastScannedUserId(userId);
      processScan(userId);
    } catch {
      setLastScannedUserId(qrData);
      processScan(qrData);
    }
  };

  // Process scan with test scanner
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
      if (!itemId) {
        setErrorMessage("Please select an item first");
        setStatus("error");
        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
        }, 3000);
        return;
      }

      console.log("Scanning user:", userId, "for item:", itemId);

      // Call test scan API endpoint
      const response = await fetch("/api/scavenger-hunt/test-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          itemId,
          scannerId: TEST_SCANNER_ID,
        }),
      });

      const data = await response.json();

      // Check for "already scanned" error in the response data first, even if response.ok is true
      // (in case the API returns 200 with an error message)
      const errorMsg = data.message || "";
      if (
        errorMsg.includes("already scanned") ||
        errorMsg.includes("Item already scanned")
      ) {
        // Fetch user info to display their name
        let userName = userId;
        try {
          const userResponse = await fetch(
            `/api/scavenger-hunt/test-get-user?userId=${userId}`,
          );
          const userData = await userResponse.json();
          userName = userData?.name || userData?.email || userId;
        } catch {
          // Use userId if fetch fails
        }

        // Get activity name from selected item
        const selectedItem = items?.find((item) => item.id === itemId);
        const activityName =
          selectedItem?.description || selectedItem?.code || "Activity";

        // Navigate to already-scanned page with activity name and user name
        router.push({
          pathname: "/scan/already-scanned",
          query: {
            activity: activityName,
            user: userName,
          },
        });
        isProcessingRef.current = false; // Reset flag before navigation
        return; // Exit early, don't continue to success flow
      }

      if (!response.ok) {
        // For other errors, throw as before
        const finalErrorMsg = errorMsg || "Failed to process scan";
        console.error("Scan error:", finalErrorMsg, "User ID:", userId);
        throw new Error(`${finalErrorMsg} (User ID: ${userId})`);
      }

      // Fetch user info to display their name
      let userName = userId;
      try {
        const userResponse = await fetch(
          `/api/scavenger-hunt/test-get-user?userId=${userId}`,
        );
        const userData = await userResponse.json();
        if (userData && userData.name) {
          userName = userData.name || userData.email || userId;
          setScannedName(userName);
        } else {
          setScannedName(userId);
        }
      } catch {
        setScannedName(userId);
      }

      setStatus("success");

      // Get activity name from selected item
      const selectedItem = items?.find((item) => item.id === itemId);
      const activityName =
        selectedItem?.description || selectedItem?.code || "Activity";

      // Navigate to success page with activity name and user name
      router.push({
        pathname: "/scan/success",
        query: {
          activity: activityName,
          user: userName,
        },
      });
      isProcessingRef.current = false; // Reset flag before navigation
      return; // Exit early after successful navigation to prevent any error handling
    } catch (error) {
      // Check if it's "already scanned" before logging
      let errorMsg = "Failed to process scan. Please try again.";
      let isAlreadyScanned = false;

      if (error instanceof Error) {
        const message = error.message;
        if (
          message.includes("already scanned") ||
          message.includes("Item already scanned")
        ) {
          isAlreadyScanned = true;
          // Fetch user info to display their name
          let userName = userId;
          try {
            const userResponse = await fetch(
              `/api/scavenger-hunt/test-get-user?userId=${userId}`,
            );
            const userData = await userResponse.json();
            userName = userData?.name || userData?.email || userId;
          } catch {
            // Use userId if fetch fails
          }

          // Get activity name from selected item
          const selectedItem = items?.find((item) => item.id === itemId);
          const activityName =
            selectedItem?.description || selectedItem?.code || "Activity";

          // Navigate to already-scanned page with activity name and user name
          router.push({
            pathname: "/scan/already-scanned",
            query: {
              activity: activityName,
              user: userName,
            },
          });
          return; // Exit early, don't set error state or log
        } else {
          errorMsg = message;
          setErrorMessage(errorMsg);
        }
      } else {
        setErrorMessage(errorMsg);
      }

      // Only log and show error if it's not "already scanned"
      if (!isAlreadyScanned) {
        console.error("Error processing scan:", error);
        setStatus("error");

        setTimeout(() => {
          setStatus("scanning");
          setErrorMessage(null);
          isProcessingRef.current = false; // Reset processing flag
        }, 3000);
      } else {
        // Reset flag even for already scanned (though we navigate away)
        isProcessingRef.current = false;
      }
    }
  };

  // Navigation is now handled directly in processScan after setting success status

  const selectedItem = items?.find((item) => item.id === itemId);

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
        <div className="space-y-1">
          <h1 className="text-left font-dico text-3xl font-medium text-heavy">
            Test QR Scanner
          </h1>
          <p className="font-figtree text-sm text-medium">
            Scanner: {TEST_SCANNER_NAME} ({TEST_SCANNER_EMAIL})
          </p>
          <p className="font-figtree text-xs text-medium">
            Note: The scanned user ID must exist in the database
          </p>
          {lastScannedUserId && (
            <p className="font-figtree text-xs text-medium">
              Last scanned User ID:{" "}
              <span className="font-mono">{lastScannedUserId}</span>
            </p>
          )}

          {/* Item Selection */}
          <div className="mt-4">
            <label className="font-figtree text-sm font-medium text-heavy">
              Select Item to Scan:
            </label>
            <select
              value={itemId || ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setItemId(id);
                const item = items?.find((i) => i.id === id);
                setItemCode(item?.code || null);
              }}
              className="mt-2 w-full rounded-lg border-2 border-white bg-white px-4 py-2 font-figtree text-heavy"
            >
              <option value="">-- Select an item --</option>
              {items?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.description || item.code} ({item.points} pts)
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="mt-2 space-y-1">
              <p className="font-figtree text-sm text-medium">
                Selected: {selectedItem.description || selectedItem.code}
              </p>
              <p className="font-figtree text-sm font-medium text-heavy">
                Points: {selectedItem.points}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Camera View */}
      <div className="relative flex w-full flex-1 items-center justify-center bg-gray-300">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner frame overlay */}
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

        {!itemId && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-300 bg-opacity-90">
            <p className="font-figtree text-lg font-medium text-heavy">
              Please select an item above to start scanning
            </p>
          </div>
        )}
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

export default TestQRScanPage;

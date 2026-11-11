import React, { useState } from "react";
import Image from "next/image";
import { api } from "~/utils/api";

const AddToWallet = ({
  walletType,
  className,
  onAdded,
}: {
  walletType: "GOOGLE" | "APPLE";
  className?: string;
  /** Called once the pass was generated, or if generating it failed */
  onAdded?: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // pkpass raw src isn't stored for UI use currently; keep setter only if needed later
  const [_pkpassSrc, setPkpassSrc] = useState<string | null>(null);
  const [googleWalletUrl, setGoogleWalletUrl] = useState<string | null>(null);

  const generatePass = api.qrRouter.generate.useMutation();

  const isLoading = generatePass.isPending || loading;

  const handleGeneratePass = async () => {
    setLoading(true);
    setError(null);

    try {
      generatePass.mutate(
        { walletType },
        {
          onSuccess: (data) => {
            console.log("Pass generated:", data);

            if (!data) {
              setError("No data received from server");
              return;
            }

            if (
              data.walletType === "APPLE" &&
              "pkpass" in data &&
              typeof data.pkpass === "string"
            ) {
              // store raw pkpass only if needed later in UI
              setPkpassSrc(data.pkpass);
              void handleDownloadPkpass(data.pkpass);
              onAdded?.();
            } else if (
              data.walletType === "GOOGLE" &&
              "googleWalletUrl" in data &&
              typeof data.googleWalletUrl === "string"
            ) {
              setGoogleWalletUrl(data.googleWalletUrl);
              // Redirect to Google Wallet
              window.open(data.googleWalletUrl, "_blank");
              onAdded?.();
            }
          },
          onError: (err) => {
            console.error("Failed to generate pass:", err);

            // Don't block the onboarding checklist on a pass we couldn't make
            onAdded?.();

            // Check if it's a NOT_FOUND error (pass doesn't exist in R2)
            const isNotFound =
              err &&
              typeof err === "object" &&
              "data" in err &&
              err.data &&
              typeof err.data === "object" &&
              "code" in err.data &&
              err.data.code === "NOT_FOUND";

            if (isNotFound) {
              setError(
                "There was an error generating your wallet pass. Please contact an organizer!",
              );
            } else {
              const errorMessage =
                err && typeof err === "object" && "message" in err
                  ? String(err.message)
                  : String(err);
              setError(
                errorMessage === "UNAUTHORIZED"
                  ? "Please verify your email before generating a Wallet Pass."
                  : errorMessage,
              );
            }
          },
          onSettled: () => {
            setLoading(false);
          },
        },
      );
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleDownloadPkpass = async (pkpassUrlOrBase64: string) => {
    if (!pkpassUrlOrBase64) return;

    // Check if it's a URL (starts with http) or base64
    if (pkpassUrlOrBase64.startsWith("http")) {
      // It's a URL - for Apple Wallet, we need to trigger download
      // On iOS/macOS, downloading a .pkpass file automatically opens Wallet
      try {
        const response = await fetch(pkpassUrlOrBase64);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();

        // Ensure the blob has the correct MIME type
        const typedBlob = new Blob([blob], {
          type: "application/vnd.apple.pkpass",
        });

        const url = window.URL.createObjectURL(typedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hackwestern-badge.pkpass";
        // Add attributes for better compatibility
        a.setAttribute("download", "hackwestern-badge.pkpass");
        document.body.appendChild(a);
        a.click();

        // Cleanup after a short delay to ensure download starts
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      } catch (error) {
        console.error("Failed to download pass from URL:", error);
        // Fallback: try opening URL directly (may work on some devices)
        window.location.href = pkpassUrlOrBase64;
      }
    } else {
      // It's base64, convert to blob
      try {
        const byteCharacters = atob(pkpassUrlOrBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.apple.pkpass",
        });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hackwestern-badge.pkpass";
        a.setAttribute("download", "hackwestern-badge.pkpass");
        document.body.appendChild(a);
        a.click();

        // Cleanup after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      } catch (error) {
        console.error("Failed to process base64 pass:", error);
        setError("Failed to process wallet pass. Please try again.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Plain button: the badge SVGs are the whole button. The shared
          Button's pill background and shadow showed around the Apple one. */}
      <button
        type="button"
        onClick={handleGeneratePass}
        disabled={isLoading}
        className={`block cursor-pixel-hover rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isLoading ? "cursor-not-allowed opacity-40" : ""
        } ${className ?? ""}`}
      >
        <Image
          src={
            walletType === "GOOGLE"
              ? "/portal/wallet/GoogleWallet.svg"
              : "/portal/wallet/AppleWallet.svg"
          }
          alt={
            walletType === "GOOGLE"
              ? "Add to Google Wallet"
              : "Add to Apple Wallet"
          }
          width={180}
          height={60}
          className="h-12 w-auto"
        />
      </button>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/*{googleWalletUrl && (
        <p className="mt-2 text-sm text-green-600">
          Opening Google Wallet... If it didn&apos;t open,{" "}
          <a
            href={googleWalletUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            click here
          </a>
        </p>
      )}*/}
    </div>
  );
};

export default AddToWallet;

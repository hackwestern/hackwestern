import React, { useState } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { api } from "~/utils/api";

const AddToWallet = ({
  walletType,
  className,
}: {
  walletType: "GOOGLE" | "APPLE";
  className?: string;
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

            if (data.walletType === "APPLE" && data.pkpass) {
              // store raw pkpass only if needed later in UI
              setPkpassSrc(data.pkpass);
              handleDownloadPkpass(data.pkpass);
            } else if (data.walletType === "GOOGLE" && data.googleWalletUrl) {
              setGoogleWalletUrl(data.googleWalletUrl);
              // Redirect to Google Wallet
              window.open(data.googleWalletUrl, "_blank");
            }
          },
          onError: (err) => {
            console.error("Failed to generate pass:", err);
            const errorMessage =
              err && typeof err === "object" && "message" in err
                ? String(err.message)
                : String(err);
            setError(
              errorMessage === "UNAUTHORIZED"
                ? "Please verify your email before generating a Wallet Pass."
                : errorMessage,
            );
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

  const handleDownloadPkpass = (pkpassBase64: string) => {
    if (!pkpassBase64) return;

    // Convert base64 to blob
    const byteCharacters = atob(pkpassBase64);
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
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handleGeneratePass}
        disabled={isLoading}
        className={`h-auto w-[130px] p-0 transition-opacity sm:w-[160px] md:w-[180px] ${
          isLoading ? "cursor-not-allowed opacity-40" : ""
        }`}
      >
        <Image
          src={
            walletType === "GOOGLE"
              ? "/images/wallet/GoogleWallet.svg"
              : "/images/wallet/AppleWallet.svg"
          }
          alt={
            walletType === "GOOGLE"
              ? "Add to Google Wallet"
              : "Add to Apple Wallet"
          }
          width={180}
          height={60}
          className="h-auto w-full object-contain"
        />
      </Button>

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

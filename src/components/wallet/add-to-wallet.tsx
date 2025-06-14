import React, { useState } from 'react'
import Image from 'next/image'
import { Button } from '../ui/button'
import { api } from '~/utils/api';

const AddToWallet = ({
  walletType,
  className,
}: {
  walletType: "GOOGLE" | "APPLE",
  className?: string,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pkpassSrc, setPkpassSrc] = useState<string | null>(null);
  const generateQR = api.qrRouter.generate.useMutation();

  const generateAppleWallet = async () => {
    setLoading(true);
    setError(null);

    try {
      generateQR.mutate(
        undefined,
        {
          onSuccess: (data) => {
            console.log("QR Code:", data.qrCode);
            setPkpassSrc(data.pkpass)
          },
          onError: (err) => {
            console.error("Failed to generate QR:", err.message);
            setError(err.message === "UNAUTHORIZED" ? "Please verify your email before generating a Wallet Pass." : err.message);
          },
        }
      );
      handleDownloadPkpass();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateGoogleWallet = async () => {
    setLoading(true);
    setError(null);

    try {
      // enter error mode
      setError("Google Wallet integration is not yet implemented.");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadPkpass = () => {
    if (!pkpassSrc) return;

    // Convert base64 to blob
    const byteCharacters = atob(pkpassSrc);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.apple.pkpass' });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hackwestern-badge.pkpass';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={walletType === "GOOGLE" ? generateGoogleWallet : generateAppleWallet}
        disabled={loading}
        className={`flex items-center gap-2 ${className || ""}`}
      >
        <Image
          src={walletType === "GOOGLE" ? "/images/wallet/GoogleWallet.svg" : "/images/wallet/AppleWallet.svg"}
          alt={walletType === "GOOGLE" ? "Google Wallet" : "Apple Wallet"}
          width={300}
          height={200}
        />
      </Button>
      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}

export default AddToWallet

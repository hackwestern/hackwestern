"use client";
import AddToWallet from "~/components/wallet/add-to-wallet";

export default function GenerateQR() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Add Your Pass to Wallet</h1>

      <div className="flex flex-col items-center gap-4 md:flex-row">
        <AddToWallet walletType="APPLE" className="w-64" />
        <AddToWallet walletType="GOOGLE" className="w-64" />
      </div>

      <p className="max-w-md text-center text-sm text-gray-500">
        Choose your preferred wallet app. Your pass will include a QR code for
        event check-in and access to your profile.
      </p>
    </div>
  );
}

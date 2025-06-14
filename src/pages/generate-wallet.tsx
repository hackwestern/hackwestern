"use client";
import AddToWallet from "~/components/wallet/add-to-wallet";

export default function GenerateQR() {
  return (
    <div className=" h-32 w-1/2 flex justify-center items-center">
      <AddToWallet walletType="APPLE" className="w-1/2" />
    </div>
  )
}


// Make it look better
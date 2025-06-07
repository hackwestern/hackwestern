import React from "react";

interface WalletButtonProps {
  saveToWalletUrl: string;
}

const WalletButton: React.FC<WalletButtonProps> = ({ saveToWalletUrl }) => {
  if (!saveToWalletUrl) {
    return null; // Don't render anything if the URL isn't available
  }

  return (
    <a
      href={saveToWalletUrl}
      target="_blank" // Open in a new tab, standard behavior for these links
      rel="noopener noreferrer" // Security best practice for target="_blank"
      className="inline-block" // Allows for better styling if needed
    >
      {/* You can use the official Google Wallet button image here */}
      {/* For now, a simple styled button/link: */}
      <img
        src="/images/enCA_add_to_google_wallet_add-wallet-badge.svg" // Corrected path
        alt="Add to Google Wallet"
        className="h-12 hover:opacity-90" // Adjust height as needed
      />
      {/* Or a text button:
      <button
        className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
      >
        Add to Google Wallet
      </button>
      */}
    </a>
  );
};

export default WalletButton;

import Image from "next/image";

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
      <Image
        src="/images/enCA_add_to_google_wallet_add-wallet-badge.svg"
        alt="Add to Google Wallet"
        height={500}
        width={500}
        // className="h-12 hover:opacity-90" // Adjust height as needed
      />
    </a>
  );
};

export default WalletButton;

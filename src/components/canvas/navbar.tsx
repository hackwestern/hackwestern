import { motion } from "framer-motion";
import { useState } from "react";
import SingleButton from "./single-button";
import { HALF_MULT } from "./canvas";

interface NavbarProps {
  onResetViewAndItems?: () => void;
  panOffset?: { x: number; y: number };
  zoom?: number;
  isResetting?: boolean;
  style?: React.CSSProperties;
}

export default function Navbar({
  onResetViewAndItems,
  panOffset = { x: 0, y: 0 },
  zoom = 1,
  isResetting = false,
}: NavbarProps) {
  const [expandedButton, setExpandedButton] = useState<string | null>(null);

  // Check if canvas is at center position or currently resetting
  // The center position is actually { x: -width, y: -height } based on the canvas logic
  // We need to get the window dimensions to calculate the correct center position
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 0;

  const centerX = -windowWidth * HALF_MULT;
  const centerY = -windowHeight * HALF_MULT;

  const isAtCenter =
    (panOffset.x === centerX && panOffset.y === centerY && zoom === 1) ||
    isResetting;

  const handleButtonClick = (buttonId: string) => {
    if (buttonId === "home" && onResetViewAndItems) {
      // Reset view and items when home is clicked
      onResetViewAndItems();
      setExpandedButton(null); // Collapse any expanded button
    } else {
      // If clicking the same button, collapse it. Otherwise, expand the new one
      setExpandedButton(expandedButton === buttonId ? null : buttonId);
    }
  };

  return (
    <motion.div className="flex items-center justify-center gap-1 rounded-[10px] border-[1px] border-border bg-offwhite p-1 shadow-[0_6px_12px_rgba(0,0,0,0.10)]">
      <div className="flex items-center gap-1">
        <SingleButton
          label="Home"
          icon="Home"
          onClick={() => handleButtonClick("home")}
          isPushed={isAtCenter}
        />
        <SingleButton
          label="Hack Western 11 Projects"
          icon="Folders"
          link="https://dorahacks.io/hackathon/hackwestern-11/buidl"
          isPushed={expandedButton === "projects"}
        />
        <SingleButton
          label="Hack Western 11 Site"
          icon="ExternalLink"
          link="https://archive.hackwestern.com/2024"
          isPushed={expandedButton === "site"}
        />
        <SingleButton
          label="Sponsor Us!"
          icon="Handshake"
          emailAddress="sponsorship@hackwestern.com"
          isPushed={expandedButton === "settings"}
        />
      </div>
    </motion.div>
  );
}

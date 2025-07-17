import { motion } from "framer-motion";
import { useState } from "react";
import SingleButton from "./single-button";
import { coordinates } from "~/constants/canvas-coordinates";

interface NavbarProps {
  setPanOffset?: (offset: { x: number; y: number }) => void;
  onResetViewAndItems?: () => void;
}

export default function Navbar({
  setPanOffset,
  onResetViewAndItems,
}: NavbarProps) {
  const [expandedButton, setExpandedButton] = useState<string | null>("home");

  const handlePan = (button: string) => {
    setExpandedButton(button);
    const coords = coordinates[button as keyof typeof coordinates];
    setPanOffset?.({ x: coords.x, y: coords.y });
  };

  const handleHome = () => {
    setExpandedButton("home");
    onResetViewAndItems?.();
  };

  return (
    <motion.div className="flex items-center justify-center gap-1 rounded-[10px] border-[1px] border-border bg-offwhite p-1 shadow-[0_6px_12px_rgba(0,0,0,0.10)]">
      <div className="flex items-center gap-1">
        <SingleButton
          label="Home"
          icon="Home"
          onClick={handleHome}
          isPushed={expandedButton === "home"}
        />
        <SingleButton
          label="About"
          icon="Info"
          onClick={() => handlePan("about")}
          isPushed={expandedButton === "about"}
        />
        <SingleButton
          label="Projects"
          icon="Code"
          onClick={() => handlePan("projects")}
          isPushed={expandedButton === "projects"}
        />
        <SingleButton
          label="Sponsors"
          icon="CircleDollarSign"
          onClick={() => handlePan("sponsors")}
          isPushed={expandedButton === "sponsors"}
        />
        <SingleButton
          label="FAQ"
          icon="HelpCircle"
          onClick={() => handlePan("faq")}
          isPushed={expandedButton === "faq"}
        />
        <SingleButton
          label="Team"
          icon="Users"
          onClick={() => handlePan("team")}
          isPushed={expandedButton === "team"}
        />
      </div>
    </motion.div>
  );
}

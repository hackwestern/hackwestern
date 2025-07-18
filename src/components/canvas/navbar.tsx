import { motion } from "framer-motion";
import { useState } from "react";
import SingleButton from "./single-button";
import { CanvasSection, coordinates } from "~/constants/canvas";

interface NavbarProps {
  setPanOffset?: (offset: { x: number; y: number }) => void;
  onResetViewAndItems?: () => void;
}

export default function Navbar({
  setPanOffset,
  onResetViewAndItems,
}: NavbarProps) {
  const [expandedButton, setExpandedButton] = useState<string | null>("home");

  const handlePan = (section: CanvasSection) => {
    setExpandedButton(section);
    const coords = coordinates[section];
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
          onClick={() => handlePan(CanvasSection.About)}
          isPushed={expandedButton === CanvasSection.About}
        />
        <SingleButton
          label="Projects"
          icon="LayoutDashboard"
          onClick={() => handlePan(CanvasSection.Projects)}
          isPushed={expandedButton === CanvasSection.Projects}
        />
        <SingleButton
          label="Sponsors"
          icon="Handshake"
          onClick={() => handlePan(CanvasSection.Sponsors)}
          isPushed={expandedButton === CanvasSection.Sponsors}
        />
        <SingleButton
          label="FAQ"
          icon="HelpCircle"
          onClick={() => handlePan(CanvasSection.FAQ)}
          isPushed={expandedButton === CanvasSection.FAQ}
        />
        <SingleButton
          label="Team"
          icon="Users"
          onClick={() => handlePan(CanvasSection.Team)}
          isPushed={expandedButton === CanvasSection.Team}
        />
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import SingleButton from "./single-button";
import { CanvasSection, coordinates } from "~/constants/canvas";

interface NavbarProps {
  panOffset: { x: number; y: number };
  zoom: number;
  panToOffset: (offset: { x: number; y: number }) => void;
  onResetViewAndItems: () => void;
}

export default function Navbar({
  panToOffset,
  onResetViewAndItems,
  panOffset,
  zoom,
}: NavbarProps) {
  const [expandedButton, setExpandedButton] = useState<string | null>("home");

  useEffect(() => {
    // if value of panOffset doesn't match any coordinates, there should be no expanded button
    const section = Object.keys(coordinates).find(
      (key) =>
        coordinates[key as CanvasSection].x === Math.round(-panOffset.x) &&
        coordinates[key as CanvasSection].y === Math.round(-panOffset.y),
    );

    if (!section || zoom !== 1) {
      setExpandedButton(null);
    }
  }, [panOffset, zoom]);

  const handlePan = (section: CanvasSection) => {
    setExpandedButton(section);
    const coords = coordinates[section];
    panToOffset({ x: coords.x, y: coords.y });
  };

  const handleHome = () => {
    setExpandedButton(CanvasSection.Home);
    onResetViewAndItems();
  };

  return (
    <div
      className="bottom-10 md:bottom-4 "
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        pointerEvents: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* padding to prevent edge bug */}
      <div className="px-4 md:px-8">
        <motion.div className="flex select-none items-center justify-center gap-1 rounded-[10px] border-[1px] border-border bg-offwhite p-1 shadow-[0_6px_12px_rgba(0,0,0,0.10)]">
          <div className="flex items-center gap-1">
            <SingleButton
              label="Home"
              icon="Home"
              onClick={handleHome}
              isPushed={expandedButton === CanvasSection.Home}
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
              label="FAQ"
              icon="HelpCircle"
              onClick={() => handlePan(CanvasSection.FAQ)}
              isPushed={expandedButton === CanvasSection.FAQ}
            />
            <SingleButton
              label="Sponsors"
              icon="Handshake"
              onClick={() => handlePan(CanvasSection.Sponsors)}
              isPushed={expandedButton === CanvasSection.Sponsors}
            />
            <SingleButton
              label="Team"
              icon="Users"
              onClick={() => handlePan(CanvasSection.Team)}
              isPushed={expandedButton === CanvasSection.Team}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

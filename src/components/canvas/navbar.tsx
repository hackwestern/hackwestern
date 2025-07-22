import { motion, useMotionValueEvent } from "framer-motion";
import { useState, useRef } from "react";
import SingleButton from "./single-button";
import { CanvasSection, coordinates } from "~/constants/canvas";
import { useCanvasContext } from "~/contexts/CanvasContext";
import useWindowDimensions from "~/hooks/useWindowDimensions";

interface NavbarProps {
  panToOffset: (
    offset: { x: number; y: number },
    onComplete?: () => void,
    zoom?: number,
  ) => void;
  onReset: () => void;
}

export default function Navbar({ panToOffset, onReset }: NavbarProps) {
  const { x, y, scale } = useCanvasContext();
  const [expandedButton, setExpandedButton] = useState<string | null>("home");
  const activePans = useRef(0);

  const { height, width } = useWindowDimensions();

  // smaller default scale for smaller screens, larger for larger screens
  // default is for 1920x1080p screens
  let defaultZoom = 1;
  if (width < 768) {
    defaultZoom = 0.6; // mobile
  } else if (width < 1440) {
    defaultZoom = 0.8; // tablet
  } else if (width < 1920) {
    defaultZoom = 0.9; // small desktop
  } else if (width < 2560) {
    defaultZoom = 1; // medium desktop
  } else {
    defaultZoom = 1.2; // large desktop
  }

  const updateExpandedButton = () => {
    // activePans.current is only > 0 during a programmatic pan via button click
    if (activePans.current > 0) return;

    const currentX = -x.get();
    const currentY = -y.get();
    const currentScale = scale.get();

    const section = Object.keys(coordinates).find(
      (key) =>
        coordinates[key as CanvasSection].x === Math.round(currentX) &&
        coordinates[key as CanvasSection].y === Math.round(currentY),
    );

    if (section && currentScale === 1) {
      setExpandedButton(section);
    } else {
      setExpandedButton(null);
    }
  };

  useMotionValueEvent(x, "change", updateExpandedButton);
  useMotionValueEvent(y, "change", updateExpandedButton);
  useMotionValueEvent(scale, "change", updateExpandedButton);

  const handlePan = (section: CanvasSection) => {
    setExpandedButton(section);
    activePans.current++;
    const coords = coordinates[section];

    // Calculate the center of the section
    const sectionCenterX = coords.x + coords.width / 2;
    const sectionCenterY = coords.y + height / 2;

    // Calculate the required pan offset to center the section in the viewport
    const targetX = width / 2 - sectionCenterX * defaultZoom;
    const targetY = height / 2 - sectionCenterY * defaultZoom;

    panToOffset(
      { x: -targetX, y: -targetY },
      () => {
        activePans.current--;
      },
      defaultZoom,
    );
  };

  const handleHome = () => {
    setExpandedButton(CanvasSection.Home);
    activePans.current++;
    onReset();
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

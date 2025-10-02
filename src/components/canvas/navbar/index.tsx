import { motion, useMotionValueEvent } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import SingleButton from "./single-button";
import { CanvasSection, coordinates } from "~/constants/canvas";
import { useCanvasContext } from "~/contexts/CanvasContext";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import { usePerformanceMode } from "~/hooks/usePerformanceMode";
import {
  ScreenSizeEnum,
  getScreenSizeEnum,
  getSectionPanCoordinates,
} from "~/lib/canvas";

interface NavbarProps {
  panToOffset: (
    offset: { x: number; y: number },
    onComplete?: () => void,
    zoom?: number,
  ) => void;
  onReset: () => void;
}

export const RESPONSIVE_ZOOM_MAP: Record<ScreenSizeEnum, number> = {
  [ScreenSizeEnum.SMALL_MOBILE]: 0.5,
  [ScreenSizeEnum.MOBILE]: 0.6,
  [ScreenSizeEnum.TABLET]: 0.8,
  [ScreenSizeEnum.SMALL_DESKTOP]: 0.9,
  [ScreenSizeEnum.MEDIUM_DESKTOP]: 1,
  [ScreenSizeEnum.LARGE_DESKTOP]: 1.25,
  [ScreenSizeEnum.HUGE_DESKTOP]: 1.5,
} as const;

export default function Navbar({ panToOffset, onReset }: NavbarProps) {
  const { x, y, scale, animationStage } = useCanvasContext();
  const [expandedButton, setExpandedButton] = useState<string | null>(null);
  const activePans = useRef(0);
  const panTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounce state
  const debounceBlocked = useRef(false);
  const debounceCooldownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { height, width } = useWindowDimensions();
  const { mode } = usePerformanceMode();

  const defaultZoom = RESPONSIVE_ZOOM_MAP[getScreenSizeEnum(width)];

  // Derive debounce duration from performance mode
  const debounceMs = (() => {
    console.log("Performance mode:", mode);
    switch (mode) {
      case "high":
        return 0;
      case "medium":
        return 100;
      case "low":
        return 400;
      default:
        return 0;
    }
  })();

  // Leading-edge debounce handler
  const handleDebouncedClick = useCallback(
    (callback: () => void) => {
      if (debounceMs === 0) {
        callback();
        return;
      }

      if (debounceBlocked.current) {
        // We're in the cooldown window; ignore this click
        return;
      }

      // Enter cooldown and perform the click immediately
      debounceBlocked.current = true;
      callback();

      if (debounceCooldownTimeout.current) {
        clearTimeout(debounceCooldownTimeout.current);
      }

      debounceCooldownTimeout.current = setTimeout(() => {
        debounceBlocked.current = false;
        debounceCooldownTimeout.current = null;
      }, debounceMs);
    },
    [debounceMs],
  );

  const updateExpandedButton = () => {
    // reset activePans if no movement has occurred recently
    if (panTimeout.current) clearTimeout(panTimeout.current);
    panTimeout.current = setTimeout(() => {
      activePans.current = 0;
    }, 500);

    if (activePans.current == 0) setExpandedButton(null);
  };

  useMotionValueEvent(x, "change", updateExpandedButton);
  useMotionValueEvent(y, "change", updateExpandedButton);
  useMotionValueEvent(scale, "change", updateExpandedButton);

  const handlePan = useCallback(
    function handlePan(section: CanvasSection) {
      setExpandedButton(section);
      activePans.current++;

      if (section === CanvasSection.Home) {
        onReset();
        return;
      }

      const panCoords = getSectionPanCoordinates({
        windowDimensions: { width, height },
        coords: coordinates[section],
        targetZoom: defaultZoom,
        negative: true,
      });

      panToOffset(
        panCoords,
        () => {
          activePans.current--;
        },
        defaultZoom,
      );
    },
    [panToOffset, onReset, width, height, defaultZoom],
  );

  // Clean up timers on unmount
  useEffect(() => {
    if (animationStage < 2) return;
    handlePan(CanvasSection.Home);
    return () => {
      if (panTimeout.current) clearTimeout(panTimeout.current);
      if (debounceCooldownTimeout.current) clearTimeout(debounceCooldownTimeout.current);
    };
  }, [handlePan, animationStage]);

  return (
    <div
      className="bottom-12 md:bottom-4"
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
              onClick={() => handlePan(CanvasSection.Home)}
              isPushed={expandedButton === CanvasSection.Home}
              onDebouncedClick={handleDebouncedClick}
            />
            <SingleButton
              label="About"
              icon="Info"
              onClick={() => handlePan(CanvasSection.About)}
              isPushed={expandedButton === CanvasSection.About}
              onDebouncedClick={handleDebouncedClick}
            />
            <SingleButton
              label="Projects"
              icon="LayoutDashboard"
              onClick={() => handlePan(CanvasSection.Projects)}
              isPushed={expandedButton === CanvasSection.Projects}
              onDebouncedClick={handleDebouncedClick}
            />
            <SingleButton
              label="Sponsors"
              icon="Handshake"
              onClick={() => handlePan(CanvasSection.Sponsors)}
              isPushed={expandedButton === CanvasSection.Sponsors}
              onDebouncedClick={handleDebouncedClick}
            />
            <SingleButton
              label="FAQ"
              icon="HelpCircle"
              onClick={() => handlePan(CanvasSection.FAQ)}
              isPushed={expandedButton === CanvasSection.FAQ}
              onDebouncedClick={handleDebouncedClick}
            />
            <SingleButton
              label="Team"
              icon="Users"
              onClick={() => handlePan(CanvasSection.Team)}
              isPushed={expandedButton === CanvasSection.Team}
              onDebouncedClick={handleDebouncedClick}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

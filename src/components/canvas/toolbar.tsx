import { type Point } from "framer-motion";
import { useEffect, useState } from "react";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import { canvasHeight, canvasWidth } from "./canvas";

const Toolbar = ({ zoom, panOffset }: { zoom: number; panOffset: Point }) => {
  const { width, height } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // The coordinates of the top-left of the viewport in the canvas's coordinate system
  const currentX = -panOffset.x / zoom;
  const currentY = -panOffset.y / zoom;

  // The coordinates of the initial top-left of the viewport in the canvas's coordinate system
  const originX = canvasWidth / 2 - width / (2 * zoom);
  const originY = canvasHeight / 2 - height / (2 * zoom);

  // The displayed coordinates are relative to the initial position
  const displayX = currentX - originX;
  const displayY = currentY - originY;

  return (
    <div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border-[1px] border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      data-toolbar-button
    >
      ({displayX.toFixed(0)}, {displayY.toFixed(0)})
      <span className="text-light"> |</span> {zoom.toFixed(2)}x
    </div>
  );
};

export default Toolbar;

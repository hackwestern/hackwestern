import { type Point } from "framer-motion";
import { useEffect, useState } from "react";

const Toolbar = ({
  zoom,
  panOffset,
  homeCoordinates = { x: 0, y: 0 },
}: {
  zoom: number;
  panOffset: Point;
  homeCoordinates?: Point;
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // coordinates of top left corner of screen, where (0, 0) is when at home
  const displayX = -(panOffset.x / zoom + homeCoordinates.x);
  const displayY = -(panOffset.y / zoom + homeCoordinates.y);

  if (displayX === 0 && displayY === 0 && zoom === 1) {
    return null; // don't show toolbar when at home
  }

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

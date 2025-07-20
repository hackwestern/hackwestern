import {
  type Point,
  type MotionValue,
  useAnimationFrame,
} from "framer-motion";
import { useState } from "react";

const Toolbar = ({
  x,
  y,
  scale,
  homeCoordinates = { x: 0, y: 0 },
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  homeCoordinates?: Point;
}) => {
  const [, forceRerender] = useState(0);

  // Force a re-render on every animation frame
  useAnimationFrame(() => {
    forceRerender((v) => v + 1);
  });

  const displayX = -(x.get() / scale.get() + homeCoordinates.x);
  const displayY = -(y.get() / scale.get() + homeCoordinates.y);

  if (displayX === 0 && displayY === 0 && scale.get() === 1) {
    return null; // don't show toolbar when at home
  }

  return (
    <div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border-[1px] border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      data-toolbar-button
    >
      ({displayX.toFixed(0)}, {displayY.toFixed(0)})
      <span className="text-light"> |</span> {scale.get().toFixed(2)}x
    </div>
  );
};

export default Toolbar;

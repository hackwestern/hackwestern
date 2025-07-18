import {
  type Point,
  type MotionValue,
  useAnimationFrame,
} from "framer-motion";
import { useEffect, useState } from "react";

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
  const [mounted, setMounted] = useState(false);
  // This state will hold the live, animated values
  const [animatedValues, setAnimatedValues] = useState({
    x: x.get(),
    y: y.get(),
    scale: scale.get(),
  });

  // Subscribe to animation frame updates to get smooth transitions
  useAnimationFrame(() => {
    setAnimatedValues({
      x: x.get(),
      y: y.get(),
      scale: scale.get(),
    });
  });

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Use animated values instead of static state
  const displayX = -(
    animatedValues.x / animatedValues.scale +
    homeCoordinates.x
  );
  const displayY = -(
    animatedValues.y / animatedValues.scale +
    homeCoordinates.y
  );

  if (displayX === 0 && displayY === 0 && animatedValues.scale === 1) {
    return null; // don't show toolbar when at home
  }

  return (
    <div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border-[1px] border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      data-toolbar-button
    >
      ({displayX.toFixed(0)}, {displayY.toFixed(0)})
      <span className="text-light"> |</span> {animatedValues.scale.toFixed(2)}x
    </div>
  );
};

export default Toolbar;

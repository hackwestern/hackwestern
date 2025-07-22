import {
  type Point,
  useMotionValueEvent,
} from "framer-motion";
import { useState } from "react";
import { useCanvasContext } from "~/contexts/CanvasContext";

const Toolbar = ({
  homeCoordinates = { x: 0, y: 0 },
}: {
  homeCoordinates?: Point;
}) => {
  const { x, y, scale } = useCanvasContext();
  const [values, setValues] = useState({
    x: x.get(),
    y: y.get(),
    scale: scale.get(),
  });

  useMotionValueEvent(x, "change", (latest) => {
    setValues((v) => ({ ...v, x: latest }));
  });

  useMotionValueEvent(y, "change", (latest) => {
    setValues((v) => ({ ...v, y: latest }));
  });

  useMotionValueEvent(scale, "change", (latest) => {
    setValues((v) => ({ ...v, scale: latest }));
  });

  const displayX = -(values.x / values.scale + homeCoordinates.x);
  const displayY = -(values.y / values.scale + homeCoordinates.y);

  if (displayX === 0 && displayY === 0 && values.scale === 1) {
    return null; // don't show toolbar when at home
  }

  return (
    <div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border-[1px] border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      data-toolbar-button
    >
      ({displayX.toFixed(0)}, {displayY.toFixed(0)})
      <span className="text-light"> |</span> {values.scale.toFixed(2)}x
    </div>
  );
};

export default Toolbar;

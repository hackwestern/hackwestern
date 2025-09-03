import { type Point, useTransform, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useCanvasContext } from "~/contexts/CanvasContext";

type ToolbarProps = {
  homeCoordinates?: Point;
};

const OPACITY_POS_EPS = 1; // px
const OPACITY_SCALE_EPS = 0.01; // scale delta

const Toolbar = ({ homeCoordinates = { x: 0, y: 0 } }: ToolbarProps) => {
  const { x, y, scale } = useCanvasContext();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // numeric MotionValues
  const rawDx = useTransform(
    [x, scale],
    ([lx, ls]) => -((lx as number) / (ls as number)) + homeCoordinates.x,
  );
  const rawDy = useTransform(
    [y, scale],
    ([ly, ls]) => -((ly as number) / (ls as number)) + homeCoordinates.y,
  );

  // formatted MotionValues
  const displayX = useTransform(rawDx, (v) => Math.round(v).toString());
  const displayY = useTransform(rawDy, (v) => Math.round(v).toString());
  const displayScale = useTransform(scale, (v) => v.toFixed(2));

  const opacity = useTransform([rawDx, rawDy, scale], ([dx, dy, ls]) =>
    Math.abs(dx as number) < OPACITY_POS_EPS &&
    Math.abs(dy as number) < OPACITY_POS_EPS &&
    Math.abs((ls as number) - 1) < OPACITY_SCALE_EPS
      ? 0
      : 1,
  );

  const handlePointerDown = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <motion.div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={handlePointerDown}
      data-toolbar-button
      style={{ opacity }}
    >
      {hasMounted ? (
        <>
          (<motion.span>{displayX}</motion.span>,{" "}
          <motion.span>{displayY}</motion.span>)
          <span className="text-light"> |</span>{" "}
          <motion.span>{displayScale}</motion.span>x
        </>
      ) : (
        <span style={{ opacity: 0 }}>(0, 0) | 1.00x</span>
      )}
    </motion.div>
  );
};

export default Toolbar;

import {
  type Point,
  type MotionValue,
  useTransform,
  motion,
} from "framer-motion";

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
  const displayX = useTransform([x, scale], (latest) => {
    const [latestX, latestScale] = latest as [number, number];
    return -(latestX / latestScale + homeCoordinates.x).toFixed(0);
  });
  const displayY = useTransform([y, scale], (latest) => {
    const [latestY, latestScale] = latest as [number, number];
    return -(latestY / latestScale + homeCoordinates.y).toFixed(0);
  });
  const displayScale = useTransform(scale, (latest) => latest.toFixed(2));

  const opacity = useTransform([x, y, scale], (latest) => {
    const [lx, ly, ls] = latest as [number, number, number];
    const dx = -(lx / ls + homeCoordinates.x);
    const dy = -(ly / ls + homeCoordinates.y);
    // Use a small epsilon for float comparison
    return Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && Math.abs(ls - 1) < 0.01
      ? 0
      : 1;
  });

  return (
    <motion.div
      className="absolute left-4 top-4 z-[1000] cursor-default select-none rounded-[10px] border-[1px] border-border bg-offwhite p-2 font-mono text-xs text-heavy shadow-[0_6px_12px_rgba(0,0,0,0.10)] md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      data-toolbar-button
      style={{ opacity }}
    >
      (<motion.span>{displayX}</motion.span>,{" "}
      <motion.span>{displayY}</motion.span>)
      <span className="text-light"> |</span> <motion.span>{displayScale}</motion.span>x
    </motion.div>
  );
};

export default Toolbar;

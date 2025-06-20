import { type Point } from "framer-motion";
import { useEffect, useState } from "react";
import useWindowDimensions from "~/hooks/useWindowDimensions";

const Toolbar = ({ zoom, panOffset }: { zoom: number; panOffset: Point }) => {
  const { width, height } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      className="absolute left-4 top-4 z-[1000] cursor-default rounded bg-white p-2 font-mono text-xs text-heavy shadow-md  md:text-sm"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
    >
      x: {(-panOffset.x / zoom - width).toFixed(2)} y:{" "}
      {(-panOffset.y / zoom - height).toFixed(2)} zoom: {zoom.toFixed(2)}x
    </div>
  );
};

export default Toolbar;

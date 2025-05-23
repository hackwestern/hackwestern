import { type Point } from "framer-motion";
import Image from "next/image";

const Toolbar = ({
  zoom,
  onResetViewAndItems,
  panOffset,
}: {
  zoom: number;
  onResetViewAndItems: () => void;
  panOffset: Point;
}) => {
  return (
    <>
      <div className="text- absolute bottom-4 right-4 z-[1000] flex gap-2">
        <button
          className="rounded bg-gray-700 p-1.5 font-mono text-xs text-white shadow-md transition-colors hover:bg-gray-600 md:text-sm"
          onClick={onResetViewAndItems}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        >
          <Image src="/images/reset.svg" alt="Reset" width={18} height={18} />
        </button>
        <div
          className="cursor-default rounded bg-gray-700 p-2 font-mono text-xs text-white shadow-md md:text-sm"
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        >
          Zoom: {zoom.toFixed(2)}x
        </div>
      </div>
      <div
        className="absolute bottom-4 left-4 z-[1000] cursor-default rounded bg-gray-700 p-2 font-mono text-xs text-white shadow-md md:text-sm"
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        x: {(-panOffset.x / zoom).toFixed(2)}, y:{" "}
        {(-panOffset.y / zoom).toFixed(2)}
      </div>
    </>
  );
};

export default Toolbar;

import Head from "next/head";
import { motion } from "framer-motion";
import {
  useState,
  useRef,
  type PointerEvent,
  type WheelEvent,
  type FC,
  useMemo,
} from "react";
import { Draggable } from "~/components/canvas/draggable";
import { CanvasProvider } from "~/contexts/CanvasContext";
import TestPage1 from "~/components/canvas-demo/test-page-1";

interface Point {
  x: number;
  y: number;
}

const useMemoizedPoint = (x: number, y: number): Point => {
  return useMemo(() => ({ x, y }), [x, y]);
};

const Canvas: FC = () => {
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  const onResetViewAndItems = (): void => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const handlePanStart = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsPanning(true);
    setPanStartPoint({ x: event.clientX, y: event.clientY });
    setInitialPanOffsetOnDrag({ x: panOffset.x, y: panOffset.y });
    if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
  };
  const handlePanMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isPanning) return;
    event.preventDefault();

    const deltaX = event.clientX - panStartPoint.x;
    const deltaY = event.clientY - panStartPoint.y;

    setPanOffset({
      x: initialPanOffsetOnDrag.x + deltaX,
      y: initialPanOffsetOnDrag.y + deltaY,
    });
  };

  const handlePanEnd = (): void => {
    if (isPanning) {
      setIsPanning(false);
      if (viewportRef.current) viewportRef.current.style.cursor = "grab";
    }
  };

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>): void => {
    const zoomFactor = 0.1;
    const newZoom =
      event.deltaY > 0 ? zoom * (1 - zoomFactor) : zoom * (1 + zoomFactor);
    const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));

    if (!viewportRef.current) return;
    const viewportRect = viewportRef.current.getBoundingClientRect();

    const mouseX = event.clientX - viewportRect.left;
    const mouseY = event.clientY - viewportRect.top;

    const sceneMouseX = (mouseX - panOffset.x) / zoom;
    const sceneMouseY = (mouseY - panOffset.y) / zoom;

    const newPanX = mouseX - sceneMouseX * clampedZoom;
    const newPanY = mouseY - sceneMouseY * clampedZoom;

    setZoom(clampedZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  return (
    <>
      <Head>
        <title>Canvas</title>
        <meta name="description" content="Interactive Canvas" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Type for div attributes is inferred, but we can be explicit with refs */}
      <CanvasProvider zoom={zoom} panOffset={panOffset}>
        <div
          ref={viewportRef}
          className="relative h-screen w-screen touch-none select-none overflow-hidden"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerLeave={handlePanEnd}
          onWheel={handleWheelZoom}
        >
          <motion.div
            ref={sceneRef}
            className="scene absolute bg-blue-100"
            style={{
              width: "0",
              height: "0",
              transformOrigin: "0 0",
            }}
            animate={{ x: panOffset.x, y: panOffset.y, scale: zoom }}
            transition={{ duration: 0.05 }}
          >
            <Draggable
              initialPos={useMemoizedPoint(100, 100)}
              drag
              className="w-32 cursor-grab rounded bg-blue-500 p-4 text-center text-white shadow-lg"
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            >
              Draggable 1
            </Draggable>
            <Draggable
              initialPos={useMemoizedPoint(600, 300)}
              drag
              className="w-32 cursor-grab rounded bg-red-500 p-4 text-center text-white shadow-lg"
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            >
              Draggable 2
            </Draggable>
            <TestPage1 />
          </motion.div>
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <button
              className="min-w-[120px] rounded bg-gray-700 p-2 font-mono text-sm text-white shadow-md hover:bg-gray-600"
              onClick={onResetViewAndItems}
            >
              Reset All
            </button>
            <div className="rounded bg-gray-700 p-2 font-mono text-sm text-white shadow-md">
              Zoom: {zoom.toFixed(2)}x
            </div>
          </div>
        </div>
      </CanvasProvider>
    </>
  );
};

export default Canvas;

import Head from "next/head";
import { motion, useAnimationControls } from "framer-motion";
import {
  useState,
  useRef,
  type PointerEvent,
  type WheelEvent,
  type FC,
  useEffect,
} from "react";
import { CanvasProvider } from "~/contexts/CanvasContext";
import TestPage1 from "~/components/canvas-demo/test-page-1";
import MainPage from "~/components/canvas-demo/main-page";
import Image from "next/image";

interface Point {
  x: number;
  y: number;
}

const Canvas: FC = () => {
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });

  const sceneControls = useAnimationControls();
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void sceneControls.start(
      { x: panOffset.x, y: panOffset.y, scale: zoom },
      { duration: 0.3 },
    );
  }, []);

  useEffect(() => {
    void sceneControls.start(
      {
        x: panOffset.x,
        y: panOffset.y,
        scale: zoom,
      },
      { duration: 0.01 },
    );
  }, [panOffset, zoom, sceneControls]);

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
          className="relative h-screen w-screen touch-none select-none overflow-hidden bg-gray-300"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerLeave={handlePanEnd}
          onWheel={handleWheelZoom}
        >
          <motion.div
            ref={sceneRef}
            className="scene absolute h-0 w-0 origin-top-left"
            animate={sceneControls}
          >
            <MainPage />
            <TestPage1 />
          </motion.div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              className="rounded bg-gray-700 p-1.5 font-mono text-sm text-white shadow-md transition-colors hover:bg-gray-600"
              onClick={onResetViewAndItems}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            >
              <Image
                src="/images/reset.svg"
                alt="Reset"
                width={18}
                height={18}
              />
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

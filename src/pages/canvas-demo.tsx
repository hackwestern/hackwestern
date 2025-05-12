import Head from "next/head";
import { motion, type Point, useAnimationControls } from "framer-motion";
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
import Toolbar from "~/components/canvas-demo/toolbar";
import Navbar from "~/components/canvas-demo/navbar";
import TestPageMap from "~/components/canvas-demo/test-page-map";
import TestPageBoxes from "~/components/canvas-demo/test-page-boxes";
import TestPage2 from "~/components/canvas-demo/test-page-2";
import Hero from "~/components/promo/Hero";

export const OFFSETS = [
  // 0.001 to avoid the reset when 0,0
  { x: 0, y: 0.001 },
  { x: 4000, y: 0 },
  { x: -4000, y: 0 },
  { x: 0, y: 2000 },
  { x: 0, y: -2000 },
  { x: 4000, y: 2000 },
  { x: -4000, y: -2000 },
  { x: 4000, y: -2000 },
  { x: -4000, y: 2000 },
] as const;

export type OffsetIndex = Exclude<
  keyof typeof OFFSETS,
  keyof (typeof OFFSETS)[]
>;

const OffsetComponent = ({
  offset,
  children,
}: {
  offset: Point;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        position: "absolute",
        top: offset.y,
        left: offset.x,
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </motion.div>
  );
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

  const sceneControls = useAnimationControls();
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void sceneControls.start({ x: 0, y: 0, scale: 1 }, { duration: 0.3 });
  }, [sceneControls]);

  useEffect(() => {
    sceneControls.set({
      x: panOffset.x,
      y: panOffset.y,
      scale: zoom,
    });
  }, [panOffset, zoom, sceneControls]);

  const onResetViewAndItems = (): void => {
    void sceneControls
      .start({ x: 0, y: 0, scale: 1 }, { duration: 0.2 })
      .then(() => {
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
      });
  };

  const panToOffset = (offset: Point): void => {
    if (!viewportRef.current) return;
    void sceneControls
      .start(
        {
          x: -offset.x,
          y: -offset.y,
          scale: 1,
        },
        { duration: 0.3 },
      )
      .then(() => {
        setZoom(1);
        setPanOffset({ x: -offset.x, y: -offset.y });
      });
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
          <Navbar onClick={panToOffset} />
          <motion.div
            ref={sceneRef}
            className="scene absolute z-20 h-0 w-0 origin-top-left"
            animate={sceneControls}
          >
            {[
              <MainPage key="main" />,
              <TestPage1 key="tp1" />,
              <TestPage2 key="tp2" />,
              <TestPageMap key="tpm" />,
              <TestPageBoxes key="tpb" />,
              <div key="index" className="w-screen">
                <Hero />
              </div>,
            ].map((Component, index) => (
              <OffsetComponent
                key={index}
                offset={OFFSETS[index.toString() as OffsetIndex]}
              >
                {Component}
              </OffsetComponent>
            ))}
          </motion.div>
          <Toolbar
            onResetViewAndItems={onResetViewAndItems}
            panOffset={panOffset}
            zoom={zoom}
          />
        </div>
      </CanvasProvider>
    </>
  );
};

export default Canvas;

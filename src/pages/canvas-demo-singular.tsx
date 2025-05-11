import Head from "next/head";
import {
  motion,
  useAnimationControls,
  AnimationControls // Import type
} from "framer-motion";
import { useState, useRef, useEffect, PointerEvent, WheelEvent, FC } from "react"; // Import React event types and FC

// Define a Point type for coordinates
interface Point {
  x: number;
  y: number;
}

// Initial positions for items
const initialItem1Pos: Point = { x: 50, y: 50 };
const initialItem2Pos: Point = { x: 200, y: 100 };

const Canvas: FC = () => { // Use FC (Functional Component) type
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({ x: 0, y: 0});

  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Type the animation controls
  const item1Controls: AnimationControls = useAnimationControls();
  const item2Controls: AnimationControls = useAnimationControls();

  const resetItemsToInitialPositions = async (): Promise<void> => {
    try {
      await Promise.all([
        item1Controls.start({ x: initialItem1Pos.x, y: initialItem1Pos.y, transition: { type: "spring", stiffness: 300, damping: 30 } }),
        item2Controls.start({ x: initialItem2Pos.x, y: initialItem2Pos.y, transition: { type: "spring", stiffness: 300, damping: 30 } })
      ]);
      // console.log("Items reset animations completed.");
    } catch (error) {
      console.error("Error during item reset animation:", error);
    }
  };

  const onResetViewAndItems = (): void => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
    void resetItemsToInitialPositions();
  };

  // --- Panning Handlers ---
  const handlePanStart = (event: PointerEvent<HTMLDivElement>): void => {
    // Ensure event.target is an HTMLElement before comparing with refs
    const targetElement = event.target as HTMLElement;
    if (targetElement !== viewportRef.current && targetElement !== sceneRef.current) {
      // A more robust check might be to see if the targetElement is a child of a draggable item.
      // For now, this basic check, combined with stopPropagation on items, is often sufficient.
      // If draggable items have a specific class, you could check:
      // if (targetElement.closest('.draggable-item-class')) return;
      return;
    }

    event.preventDefault();
    setIsPanning(true);
    setPanStartPoint({ x: event.clientX, y: event.clientY });
    setInitialPanOffsetOnDrag({x: panOffset.x, y: panOffset.y});
    if (viewportRef.current) viewportRef.current.style.cursor = 'grabbing';
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

  const handlePanEnd = (): void => { // event is not used, so can be omitted or typed if needed later
    if (isPanning) {
      setIsPanning(false);
      if (viewportRef.current) viewportRef.current.style.cursor = 'grab';
    }
  };

  // --- Zoom Handler ---
  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>): void => {
    event.preventDefault();

    const zoomFactor = 0.1;
    const newZoom = event.deltaY > 0 ? zoom * (1 - zoomFactor) : zoom * (1 + zoomFactor);
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

  useEffect(() => {
    const initPositions = async (): Promise<void> => {
      await resetItemsToInitialPositions();
    };
    void initPositions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item1Controls, item2Controls]);


  return (
    <>
      <Head>
        <title>Canvas</title>
        <meta
          name="description"
          content="Interactive Canvas"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Type for div attributes is inferred, but we can be explicit with refs */}
      <div
        ref={viewportRef}
        className="relative h-screen w-screen select-none overflow-hidden touch-none bg-gray-100"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerLeave={handlePanEnd}
        onWheel={handleWheelZoom}
      >
        <motion.div
          ref={sceneRef}
          className="scene absolute"
          style={{
            width: '4000px',
            height: '3000px',
            transformOrigin: '0 0',
          }}
          animate={{ x: panOffset.x, y: panOffset.y, scale: zoom }}
          transition={{ type: "tween", duration: 0.1, ease: "linear" }}
        >
          <motion.div
            className="absolute w-32 cursor-grab rounded bg-blue-500 p-4 text-center text-white shadow-lg"
            drag
            dragMomentum={false}
            animate={item1Controls}
            // Type for onPointerDown event in Framer Motion components is inferred
            // but can be specified as React.PointerEvent if needed for clarity
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          >
            Draggable 1
          </motion.div>

          <motion.div
            className="absolute w-40 cursor-grab rounded bg-red-500 p-4 text-center text-white shadow-lg"
            drag
            dragMomentum={false}
            animate={item2Controls}
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          >
            Draggable 2 (React Component!)
          </motion.div>
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
    </>
  );
}

export default Canvas;
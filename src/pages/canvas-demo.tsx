import { motion } from "framer-motion";
import Head from "next/head";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent,
  type FC,
} from "react";

import GroupComponent, {
  type GroupSubItemData,
} from "~/components/canvas/group-component";

interface Point {
  x: number;
  y: number;
}

const ZOOM_LEVELS: readonly number[] = [
  0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.33, 1.4,
  1.5, 1.75, 2, 2.5, 3, 4, 5,
];
const DEFAULT_ZOOM_INDEX: number =
  ZOOM_LEVELS.indexOf(1) > -1 ? ZOOM_LEVELS.indexOf(1) : 0;

export interface SubItem {
  id: string;
  initialPosInPage: Point;
  isDraggable: boolean;
  content: React.ReactNode;
}

interface GroupItemData {
  id: string;
  initialPos: Point;
  isDraggable: boolean;
  subItems: GroupSubItemData[];
  groupVisualClassName?: string;
  groupSize?: { width: number; height: number };
}
const Canvas: FC = () => {
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [currentZoomIndex, setCurrentZoomIndex] =
    useState<number>(DEFAULT_ZOOM_INDEX);

  const zoom = ZOOM_LEVELS[currentZoomIndex] ?? 1;

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  const mainElements: GroupItemData[] = [
    {
      id: "group1",
      initialPos: { x: 300, y: 100 },
      isDraggable: false,
      groupVisualClassName: "border border-dashed border-blue-500 p-2",
      groupSize: { width: 600, height: 400 },
      subItems: [
        {
          id: "g1-item1",
          initialPosInGroup: { x: 20, y: 20 },
          isDraggable: true,
          content: <div className="bg-yellow-200 p-2">Draggable in Group</div>,
        },
        {
          id: "g1-item2",
          initialPosInGroup: { x: 150, y: 80 },
          isDraggable: false,
          content: <div className="bg-orange-200 p-2">Static in Group</div>,
        },
      ],
    },
    {
      id: "group2",
      initialPos: { x: 800, y: 1200 },
      isDraggable: false,
      groupVisualClassName: "border border-dashed border-blue-500 p-2",
      groupSize: { width: 600, height: 400 },
      subItems: [
        {
          id: "g1-item1",
          initialPosInGroup: { x: 20, y: 20 },
          isDraggable: true,
          content: <div className="bg-yellow-200 p-2">Draggable in Group</div>,
        },
        {
          id: "g1-item2",
          initialPosInGroup: { x: 150, y: 80 },
          isDraggable: false,
          content: <div className="bg-orange-200 p-2">Static in Group</div>,
        },
      ],
    },
  ];

  const onResetViewAndItems = (): void => {
    setPanOffset({ x: 0, y: 0 });
    setCurrentZoomIndex(DEFAULT_ZOOM_INDEX);
    console.warn("Resetting Items is not implemented for dynamic items yet.");
  };

  const handlePanStart = (event: PointerEvent<HTMLDivElement>): void => {
    const targetElement = event.target as HTMLElement;

    if (
      targetElement !== viewportRef.current &&
      targetElement !== sceneRef.current
    ) {
      return;
    }
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

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    const wheelHandler = (event: globalThis.WheelEvent) => {
      event.preventDefault();

      setCurrentZoomIndex((prevZoomIndex) => {
        // Calculate new Index based on prevZoomIndex
        let newZoomIndex = prevZoomIndex;
        if (event.deltaY > 0) {
          newZoomIndex = Math.max(0, prevZoomIndex - 1);
        } else {
          newZoomIndex = Math.min(ZOOM_LEVELS.length - 1, prevZoomIndex + 1);
        }

        if (newZoomIndex === prevZoomIndex) {
          return prevZoomIndex;
        }
        const oldZoom = ZOOM_LEVELS[prevZoomIndex]!;
        const newEffectiveZoom = ZOOM_LEVELS[newZoomIndex]!;

        if (!viewportRef.current) return prevZoomIndex;
        const viewportRect = viewportRef.current.getBoundingClientRect();

        const mouseX = event.clientX - viewportRect.left;
        const mouseY = event.clientY - viewportRect.top;

        setPanOffset((prevPanOffset) => {
          const sceneMouseX = (mouseX - prevPanOffset.x) / oldZoom;
          const sceneMouseY = (mouseY - prevPanOffset.y) / oldZoom;
          const newPanX = mouseX - sceneMouseX * newEffectiveZoom;
          const newPanY = mouseY - sceneMouseY * newEffectiveZoom;
          return { x: newPanX, y: newPanY };
        });

        return newZoomIndex;
      });
    };

    viewportElement.addEventListener("wheel", wheelHandler, {
      passive: false,
    });
    return () => {
      viewportElement.removeEventListener("wheel", wheelHandler);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Canvas demo</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        ref={viewportRef}
        className="relative h-screen w-screen touch-none select-none overflow-hidden bg-gray-100"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerLeave={handlePanEnd}
      >
        <motion.div
          ref={sceneRef}
          className="scene absolute"
          style={{
            width: "8000px",
            height: "6000px",
            transformOrigin: "0 0",
          }}
          animate={{ x: panOffset.x, y: panOffset.y, scale: zoom }}
          transition={{ type: "tween", duration: 0.01, ease: "linear" }}
        >
          {mainElements.map((element) => (
            <GroupComponent
              key={element.id}
              id={element.id}
              initialGroupPosOnCanvas={element.initialPos}
              canvasZoom={zoom} // Main canvas zoom
              subItemsData={element.subItems}
              groupVisualClassName={element.groupVisualClassName}
              groupSize={element.groupSize}
            />
          ))}
        </motion.div>

        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          <button
            className="min-w-[120px] rounded bg-gray-700 p-2 font-mono text-sm text-white shadow-md hover:bg-gray-600"
            onClick={onResetViewAndItems}
          >
            Reset View
          </button>
          <div className="rounded bg-gray-700 p-2 font-mono text-sm text-white shadow-md">
            Zoom: {zoom.toFixed(2)}x
          </div>
        </div>
      </div>
    </>
  );
};

export default Canvas;

import {
  type AnimationControls,
  motion,
  type Point,
  useAnimationControls,
} from "framer-motion";
import React, {
  useState,
  useRef,
  type PointerEvent,
  type FC,
  useEffect,
  useCallback,
} from "react";
import Reset from "~/components/canvas/reset";
import { CanvasProvider } from "~/contexts/CanvasContext";
import { getDistance, getMidpoint } from "~/lib/canvas";
import useWindowDimensions from "~/hooks/useWindowDimensions";

export const OffsetComponent = ({
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

interface Props {
  children: React.ReactNode;
}

async function panToOffsetScene(
  offset: Point,
  sceneControls: AnimationControls,
): Promise<void> {
  await sceneControls.start(
    {
      x: offset.x,
      y: offset.y,
      scale: 1,
    },
    {
      duration: 0.3,
    },
  );
}

const Canvas: FC<Props> = ({ children }) => {
  const { height, width } = useWindowDimensions();

  const sceneWidth = 3 * width;
  const sceneHeight = 3 * height;

  const [panOffset, setPanOffset] = useState<Point>({ x: width, y: height });
  const [zoom, setZoom] = useState<number>(1);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [maxZIndex, setMaxZIndex] = useState<number>(50);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const sceneControls = useAnimationControls();
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  const activePointersRef = useRef<Map<number, PointerEvent<HTMLDivElement>>>(
    new Map(),
  );
  const initialPinchStateRef = useRef<{
    distance: number;
    midpoint: Point;
    zoom: number;
    panOffset: Point;
  } | null>(null);

  useEffect(() => {
    sceneControls.set({
      x: panOffset.x,
      y: panOffset.y,
      scale: zoom,
    });
  }, [panOffset, zoom, sceneControls]);

  const onResetViewAndItems = (): void => {
    setIsResetting(true);
    void panToOffsetScene({ x: -width, y: -height }, sceneControls).then(() => {
      setIsResetting(false);
      setPanOffset({ x: -width, y: -height });
      setZoom(1);
    });
  };

  useEffect(() => {
    if (!isInitialized) {
      setIsResetting(true);
      void panToOffsetScene({ x: -width, y: -height }, sceneControls)
        .then(() => {
          setPanOffset({ x: -width, y: -height });
          setZoom(1);
        })
        .then(() => {
          setIsResetting(false);
          setIsInitialized(true);
        });
    }
  }, [height, width, isInitialized]);

  const panToOffset = (
    offset: Point,
    viewportRef: React.RefObject<HTMLDivElement | null>,
  ): void => {
    if (!viewportRef.current) return;
    void panToOffsetScene(offset, sceneControls).then(() => {
      setZoom(1);
      setPanOffset({ x: -offset.x, y: -offset.y });
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    activePointersRef.current.set(event.pointerId, event);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    sceneControls.stop();
    if (activePointersRef.current.size === 1) {
      const targetElement = event.target as HTMLElement;
      if (
        targetElement.closest("[data-toolbar-button]") ??
        targetElement.closest("[data-navbar-button]")
      ) {
        activePointersRef.current.delete(event.pointerId);
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        return;
      }

      setIsPanning(true);
      setPanStartPoint({ x: event.clientX, y: event.clientY });
      setInitialPanOffsetOnDrag({ ...panOffset });
      if (viewportRef.current)
        viewportRef.current.style.cursor = "url('/customcursor.svg'), grabbing";
    } else if (activePointersRef.current.size === 2) {
      setIsPanning(false);
      const pointers = Array.from(activePointersRef.current.values());
      initialPinchStateRef.current = {
        distance: getDistance(pointers[0]!, pointers[1]!),
        midpoint: getMidpoint(pointers[0]!, pointers[1]!),
        zoom: zoom,
        panOffset: { ...panOffset },
      };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (isPanning || activePointersRef.current.size >= 2) sceneControls.stop();
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, event);

    if (isPanning && activePointersRef.current.size === 1) {
      event.preventDefault();
      const deltaX = event.clientX - panStartPoint.x;
      const deltaY = event.clientY - panStartPoint.y;

      const minPanX = width - sceneWidth * zoom;
      const maxPanX = 0;
      const minPanY = height - sceneHeight * zoom;
      const maxPanY = 0;

      setPanOffset({
        x: Math.min(
          Math.max(initialPanOffsetOnDrag.x + deltaX, minPanX),
          maxPanX,
        ),
        y: Math.min(
          Math.max(initialPanOffsetOnDrag.y + deltaY, minPanY),
          maxPanY,
        ),
      });
    } else if (
      activePointersRef.current.size >= 2 &&
      initialPinchStateRef.current
    ) {
      event.preventDefault();
      const pointers = Array.from(activePointersRef.current.values());
      const p1 = pointers[0]!;
      const p2 = pointers[1]!;

      const currentDistance = getDistance(p1, p2);
      const currentMidpoint = getMidpoint(p1, p2);

      const {
        distance: initialDistance,
        zoom: initialZoom,
        panOffset: initialPanOffsetPinch,
      } = initialPinchStateRef.current;

      if (initialDistance === 0) return;

      let newZoom = initialZoom * (currentDistance / initialDistance);
      newZoom = Math.max(0.6, Math.min(newZoom, 10));

      const mx = currentMidpoint.x;
      const my = currentMidpoint.y;

      const newPanX =
        mx - ((mx - initialPanOffsetPinch.x) / initialZoom) * newZoom;
      const newPanY =
        my - ((my - initialPanOffsetPinch.y) / initialZoom) * newZoom;

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    }
  };

  const handlePointerUpOrCancel = (
    event: PointerEvent<HTMLDivElement>,
  ): void => {
    sceneControls.stop();
    event.preventDefault();
    if ((event.target as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    }
    activePointersRef.current.delete(event.pointerId);

    if (isPanning && activePointersRef.current.size < 1) {
      setIsPanning(false);
      if (viewportRef.current)
        viewportRef.current.style.cursor = "url('/customcursor.svg'), grab";
    }

    if (initialPinchStateRef.current && activePointersRef.current.size < 2) {
      initialPinchStateRef.current = null;
    }

    if (
      !isPanning &&
      activePointersRef.current.size === 1 &&
      !initialPinchStateRef.current
    ) {
      const lastPointer = Array.from(activePointersRef.current.values())[0]!;
      setIsPanning(true);
      setPanStartPoint({ x: lastPointer.clientX, y: lastPointer.clientY });
      setInitialPanOffsetOnDrag({ ...panOffset });
    }
  };

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      sceneControls.stop();
      const isPinch = event.ctrlKey || event.metaKey;

      if (isPinch) event.preventDefault();

      const zoomFactor = isPinch ? 0.08 : 0.16;

      const newZoomValue =
        event.deltaY > 0
          ? zoom * (1 - zoomFactor)
          : zoom * (1 / (1 - zoomFactor));
      const clampedZoom = Math.max(0.6, Math.min(newZoomValue, 10));

      let mouseX = event.clientX;
      let mouseY = event.clientY;

      if (viewportRef.current) {
        const viewportRect = viewportRef.current.getBoundingClientRect();
        mouseX = event.clientX - viewportRect.left;
        mouseY = event.clientY - viewportRect.top;
      }

      const minPanX = width - sceneWidth * clampedZoom;
      const maxPanX = 0;
      const minPanY = height - sceneHeight * clampedZoom;
      const maxPanY = 0;

      const newPanX = Math.min(
        Math.max(
          mouseX - ((mouseX - panOffset.x) / zoom) * clampedZoom,
          minPanX,
        ),
        maxPanX,
      );
      const newPanY = Math.min(
        Math.max(
          mouseY - ((mouseY - panOffset.y) / zoom) * clampedZoom,
          minPanY,
        ),
        maxPanY,
      );

      void sceneControls
        .start(
          {
            x: newPanX,
            y: newPanY,
            scale: clampedZoom,
          },
          {
            duration: 0.05,
            ease: [0.4, 0, 0.2, 1],
          },
        )
        .then(() => {
          setZoom(clampedZoom);
          setPanOffset({ x: newPanX, y: newPanY });
        });
    },
    [
      zoom,
      width,
      sceneWidth,
      height,
      sceneHeight,
      panOffset.x,
      panOffset.y,
      sceneControls,
    ],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (element) {
      element.addEventListener("wheel", handleWheelZoom, { passive: false });
      return () => {
        element.removeEventListener("wheel", handleWheelZoom);
      };
    }
  }, [handleWheelZoom]);

  return (
    <>
      {(zoom !== 1 || panOffset.x !== -width || panOffset.y !== -height) && (
        <Reset onResetViewAndItems={onResetViewAndItems} />
      )}
      <CanvasProvider
        zoom={zoom}
        panOffset={panOffset}
        isResetting={isResetting}
        maxZIndex={maxZIndex}
        setMaxZIndex={setMaxZIndex}
      >
        <div
          ref={viewportRef}
          className="relative h-screen w-screen touch-none select-none overflow-hidden"
          style={{
            touchAction: "none",
            overscrollBehavior: "contain",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerLeave={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
        >
          <motion.div
            ref={sceneRef}
            className="absolute z-20 h-[300vh] w-[300vw] origin-top-left"
            animate={sceneControls}
          >
            <Gradient />
            <Dots />
            <Filter />
            {children}
          </motion.div>
        </div>
      </CanvasProvider>
    </>
  );
};

interface OffsetPoints {
  x: string;
  y: string;
}

interface CanvasProps {
  children: React.ReactNode;
  offset?: OffsetPoints;
}

export const CanvasComponent: FC<CanvasProps> = ({ children, offset }) => {
  return (
    <div
      className={`absolute inset-0 z-30 flex h-full w-full items-center justify-center left-[${offset?.x ?? "0"}] top-[${offset?.y ?? "0"}]`}
    >
      {children}
    </div>
  );
};

const Gradient = () => (
  <div
    className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100"
    style={{
      backgroundImage: `radial-gradient(ellipse 300vw 300vh at 150vw 300vh, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`,
    }}
  />
);

const Dots = () => (
  <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1.5px,transparent_1px)] opacity-50 [background-size:20px_20px]" />
);

const Filter = () => (
  <div className="pointer-events-none absolute inset-0 hidden h-full w-full bg-noise opacity-100 brightness-[105%] contrast-[170%] filter sm:inline" />
);

export default Canvas;

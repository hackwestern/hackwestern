import {
  motion,
  type Point,
  useMotionValue,
  type MotionValue,
  animate,
} from "framer-motion";
import React, {
  useState,
  useRef,
  type PointerEvent,
  type FC,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import { CanvasProvider } from "~/contexts/CanvasContext";
import { getDistance, getMidpoint } from "~/lib/canvas";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import Navbar from "./navbar";
import Toolbar from "./toolbar";

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
  homeCoordinates?: { x: number; y: number };
  children: React.ReactNode;
}

const panSpring = {
  visualDuration: 0.34,
  type: "spring",
  stiffness: 200,
  damping: 25,
} as const;

async function panToOffsetScene(
  offset: Point,
  x: MotionValue<number>,
  y: MotionValue<number>,
  scale: MotionValue<number>,
): Promise<void> {
  const animX = animate(x, offset.x, panSpring);
  const animY = animate(y, offset.y, panSpring);
  const animScale = animate(scale, 1, panSpring);
  await Promise.all([animScale, animX, animY]);
}

const INTERACTIVE_SELECTOR =
  "button,[role='button'],input,textarea,[contenteditable='true']," +
  "[data-toolbar-button],[data-navbar-button]";

export const canvasWidth = 10000;
export const canvasHeight = 6500;

const ZOOM_BOUND = 1.05; // minimum zoom level to prevent zooming out too far
const MAX_ZOOM = 10;

const Canvas: FC<Props> = ({ children, homeCoordinates }) => {
  const { height, width } = useWindowDimensions();

  const sceneWidth = canvasWidth;
  const sceneHeight = canvasHeight;

  // center of the canvas
  const centerX = sceneWidth / 2;
  const centerY = sceneHeight / 2;

  const offsetHomeCoordinates = {
    x: -(homeCoordinates?.x ?? centerX),
    y: -(homeCoordinates?.y ?? centerY),
  };

  // tracks if user is panning the screen
  const [isPanning, setIsPanning] = useState<boolean>(false);
  // this one is moving from scene control, not from user
  const [isSceneMoving, setIsSceneMoving] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [maxZIndex, setMaxZIndex] = useState<number>(50);

  const x = useMotionValue(offsetHomeCoordinates.x);
  const y = useMotionValue(offsetHomeCoordinates.y);
  const scale = useMotionValue(1);

  const stopAllMotion = useCallback(() => {
    x.stop();
    y.stop();
    scale.stop();
  }, [x, y, scale]);

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

  const onResetViewAndItems = (): void => {
    setIsResetting(true);
    void panToOffsetScene(offsetHomeCoordinates, x, y, scale).then(() => {
      setIsResetting(false);
    });
  };

  const panToOffset = (
    offset: Point,
    viewportRef: React.RefObject<HTMLDivElement | null>,
  ): void => {
    if (!viewportRef.current) return;
    setIsSceneMoving(true);

    // Calculate bounds based on scene and viewport dimensions
    const viewportWidth = viewportRef.current.offsetWidth;
    const viewportHeight = viewportRef.current.offsetHeight;

    const minPanX = viewportWidth - sceneWidth * 1; // 1 is the zoom level after pan
    const maxPanX = 0;
    const minPanY = viewportHeight - sceneHeight * 1;
    const maxPanY = 0;

    // Clamp the offset to keep the scene within bounds
    const clampedX = Math.min(Math.max(offset.x, minPanX), maxPanX);
    const clampedY = Math.min(Math.max(offset.y, minPanY), maxPanY);

    void panToOffsetScene({ x: clampedX, y: clampedY }, x, y, scale).then(
      () => {
        setIsSceneMoving(false);
      },
    );
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    activePointersRef.current.set(event.pointerId, event);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    if (isResetting || isSceneMoving) return;
    stopAllMotion();
    if (activePointersRef.current.size === 1) {
      const targetElement = event.target as HTMLElement;
      if (targetElement.closest(INTERACTIVE_SELECTOR)) {
        activePointersRef.current.delete(event.pointerId);
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        return;
      }

      setIsPanning(true);
      setPanStartPoint({ x: event.clientX, y: event.clientY });
      setInitialPanOffsetOnDrag({ x: x.get(), y: y.get() });
      if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
    } else if (activePointersRef.current.size === 2) {
      setIsPanning(false);
      const pointers = Array.from(activePointersRef.current.values());
      initialPinchStateRef.current = {
        distance: getDistance(pointers[0]!, pointers[1]!),
        midpoint: getMidpoint(pointers[0]!, pointers[1]!),
        zoom: scale.get(),
        panOffset: { x: x.get(), y: y.get() },
      };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (isPanning || activePointersRef.current.size >= 2) {
      stopAllMotion();
    }
    if (!activePointersRef.current.has(event.pointerId) || isResetting) return;
    activePointersRef.current.set(event.pointerId, event);

    if (isPanning && activePointersRef.current.size === 1) {
      event.preventDefault();
      const deltaX = event.clientX - panStartPoint.x;
      const deltaY = event.clientY - panStartPoint.y;

      // UPDATE to use motion value
      const minPanX = width - sceneWidth * scale.get();
      const maxPanX = 0;
      const minPanY = height - sceneHeight * scale.get();
      const maxPanY = 0;

      const newX = Math.min(
        Math.max(initialPanOffsetOnDrag.x + deltaX, minPanX),
        maxPanX,
      );
      const newY = Math.min(
        Math.max(initialPanOffsetOnDrag.y + deltaY, minPanY),
        maxPanY,
      );
      x.set(newX);
      y.set(newY);
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
      newZoom = Math.max(
        (window.innerWidth / canvasWidth) * ZOOM_BOUND, // Ensure zoom is at least the width of the canvas
        (window.innerHeight / canvasHeight) * ZOOM_BOUND, // Ensure zoom is at least the height of the canvas
        Math.min(newZoom, 10),
      );

      const mx = currentMidpoint.x;
      const my = currentMidpoint.y;

      const minPanX = width - sceneWidth * newZoom;
      const maxPanX = 0;
      const minPanY = height - sceneHeight * newZoom;
      const maxPanY = 0;

      let newPanX =
        mx - ((mx - initialPanOffsetPinch.x) / initialZoom) * newZoom;
      let newPanY =
        my - ((my - initialPanOffsetPinch.y) / initialZoom) * newZoom;

      // Clamp pan to prevent leaving bounds
      newPanX = Math.min(Math.max(newPanX, minPanX), maxPanX);
      newPanY = Math.min(Math.max(newPanY, minPanY), maxPanY);

      scale.set(newZoom);
      x.set(newPanX);
      y.set(newPanY);
    }
  };

  const handlePointerUpOrCancel = (
    event: PointerEvent<HTMLDivElement>,
  ): void => {
    stopAllMotion();
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
      setInitialPanOffsetOnDrag({ x: x.get(), y: y.get() });
    }
  };

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      // pinch gesture on track
      const isPinch = event.ctrlKey || event.metaKey;
      const isMouseWheelZoom =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ||
        Math.abs(event.deltaY) >= 100;

      // mouse wheel zoom and track pad zoom have different sensitivities
      const ZOOM_SENSITIVITY = isMouseWheelZoom ? 0.0015 : 0.015;

      if (isPinch) {
        const currentZoom = scale.get();
        const nextZoom = Math.max(
          Math.min(
            currentZoom * (1 - event.deltaY * ZOOM_SENSITIVITY),
            MAX_ZOOM,
          ),
          (window.innerWidth / canvasWidth) * ZOOM_BOUND, // Ensure zoom is at least the width of the canvas
          (window.innerHeight / canvasHeight) * ZOOM_BOUND, // Ensure zoom is at least the height of the canvas
        );

        const rect = viewportRef.current?.getBoundingClientRect();

        if (!rect) return;

        const vpLeft = rect.left;
        const vpTop = rect.top;
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        const cursorSceneX = (event.clientX - vpLeft - x.get()) / currentZoom;
        const cursorSceneY = (event.clientY - vpTop - y.get()) / currentZoom;

        let newPanX = event.clientX - vpLeft - cursorSceneX * nextZoom;
        let newPanY = event.clientY - vpTop - cursorSceneY * nextZoom;

        const minPanX = viewportWidth - sceneWidth * nextZoom;
        const minPanY = viewportHeight - sceneHeight * nextZoom;
        const maxPanX = 0;
        const maxPanY = 0;

        newPanX = Math.min(maxPanX, Math.max(minPanX, newPanX));
        newPanY = Math.min(maxPanY, Math.max(minPanY, newPanY));

        x.set(newPanX);
        y.set(newPanY);
        scale.set(nextZoom);
      } else {
        stopAllMotion();

        const scrollSpeed = 1;
        const newPanX = x.get() - event.deltaX * scrollSpeed;
        const newPanY = y.get() - event.deltaY * scrollSpeed;

        const minPanX = width - sceneWidth * scale.get();
        const maxPanX = 0;
        const minPanY = height - sceneHeight * scale.get();
        const maxPanY = 0;

        const clampedPanX = Math.min(Math.max(newPanX, minPanX), maxPanX);
        const clampedPanY = Math.min(Math.max(newPanY, minPanY), maxPanY);

        x.set(clampedPanX);
        y.set(clampedPanY);
      }
    },
    [width, sceneWidth, height, sceneHeight, x, y, scale, stopAllMotion],
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
      <CanvasProvider
        zoom={scale.get()}
        panOffset={{ x: x.get(), y: y.get() }}
        isResetting={isResetting}
        maxZIndex={maxZIndex}
        setMaxZIndex={setMaxZIndex}
      >
        <Toolbar x={x} y={y} scale={scale} homeCoordinates={homeCoordinates} />
        <Navbar
          panToOffset={(offset: { x: number; y: number }) => {
            panToOffset(
              {
                x: -offset.x,
                y: -offset.y,
              },
              viewportRef,
            );
          }}
          onResetViewAndItems={onResetViewAndItems}
          panOffset={{ x: x.get(), y: y.get() }}
          zoom={scale.get()}
        />
        <div
          ref={viewportRef}
          className="relative h-screen touch-none select-none overflow-hidden"
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
            className="absolute z-20 origin-top-left"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              x,
              y,
              scale,
            }}
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
  x?: number;
  y?: number;
}

interface CanvasProps {
  children: React.ReactNode;
  offset?: OffsetPoints;
}

export const CanvasComponent: FC<CanvasProps> = ({ children, offset }) => {
  const margin = useMemo(() => {
    if (!offset) {
      return { margin: "auto" };
    }

    const style: React.CSSProperties = {};

    if (offset.x != null) {
      style.marginLeft = offset.x + "px";
    } else {
      style.marginLeft = "auto";
      style.marginRight = "auto";
    }

    if (offset.y != null) {
      style.marginTop = offset.y + "px";
    } else {
      style.marginTop = "auto";
      style.marginBottom = "auto";
    }

    return style;
  }, [offset]);

  return (
    <div
      className="absolute inset-0 z-30 flex h-max w-max"
      style={{
        ...margin,
      }}
    >
      {children}
    </div>
  );
};

const gradientBgImage = `radial-gradient(ellipse ${canvasWidth}px ${canvasHeight}px at ${canvasWidth / 2}px ${canvasHeight}px, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`;

const Gradient = () => (
  <div
    className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100"
    style={{
      backgroundImage: gradientBgImage,
    }}
  />
);

const Dots = () => (
  <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1.5px,transparent_1px)] opacity-40 [background-size:20px_20px]" />
);

const Filter = () => (
  <div className="pointer-events-none absolute inset-0 hidden h-full w-full bg-noise opacity-100 brightness-[105%] contrast-[170%] filter sm:inline" />
);

export default Canvas;

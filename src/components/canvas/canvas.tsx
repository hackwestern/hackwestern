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
import {
  getDistance,
  getMidpoint,
  getScreenSizeEnum,
  getSectionPanCoordinates,
  ScreenSizeEnum,
} from "~/lib/canvas";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import Navbar from "./navbar";
import Toolbar from "./toolbar";
import { SectionCoordinates } from "~/constants/canvas";

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
  homeCoordinates: SectionCoordinates;
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
  newZoom?: number,
): Promise<void> {
  const animX = animate(x, offset.x, panSpring);
  const animY = animate(y, offset.y, panSpring);
  const animScale = animate(scale, newZoom ?? 1, panSpring);
  await Promise.all([animScale, animX, animY]);
}

const INTERACTIVE_SELECTOR =
  "button,[role='button'],input,textarea,[contenteditable='true']," +
  "[data-toolbar-button],[data-navbar-button]";

export const canvasWidth = 8000;
export const canvasHeight = 5000;

const ZOOM_BOUND = 1.05; // minimum zoom level to prevent zooming out too far
const MAX_ZOOM = 10;

const MIN_ZOOMS: Record<ScreenSizeEnum, number> = {
  [ScreenSizeEnum.SMALL_MOBILE]: 0.25,
  [ScreenSizeEnum.MOBILE]: 0.2,
  [ScreenSizeEnum.TABLET]: 0.15,
  [ScreenSizeEnum.SMALL_DESKTOP]: 0.1,
  [ScreenSizeEnum.MEDIUM_DESKTOP]: 0.1,
  [ScreenSizeEnum.LARGE_DESKTOP]: 0.1,
  [ScreenSizeEnum.HUGE_DESKTOP]: 0.1,
} as const;

const stopAllMotion = (
  x: MotionValue<number>,
  y: MotionValue<number>,
  scale: MotionValue<number>,
) => {
  x.stop();
  y.stop();
  scale.stop();
};

const Canvas: FC<Props> = ({ children, homeCoordinates }) => {
  const { height, width } = useWindowDimensions();

  const sceneWidth = canvasWidth;
  const sceneHeight = canvasHeight;

  const MIN_ZOOM = MIN_ZOOMS[getScreenSizeEnum(width)];

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

  const x = useMotionValue(-3500);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

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

  const offsetHomeCoordinates = getSectionPanCoordinates({
    windowDimensions: { width, height },
    coords: homeCoordinates,
    targetZoom: 1,
  });

  const onResetViewAndItems = useCallback(
    (onComplete?: () => void): void => {
      setIsResetting(true);

      void panToOffsetScene(offsetHomeCoordinates, x, y, scale, 1).then(() => {
        setIsResetting(false);
        if (onComplete) onComplete();
      });
    },
    [x, y, scale, width],
  );

  useEffect(() => {
    // Reset the scene to the home coordinates on mount
    onResetViewAndItems();
  }, []);

  const panToOffset = useCallback(
    (
      offset: Point,
      viewportRef: React.RefObject<HTMLDivElement | null>,
      onComplete?: () => void,
      zoom?: number,
    ): void => {
      if (!viewportRef.current) return;
      setIsSceneMoving(true);

      // Calculate bounds based on scene and viewport dimensions
      const viewportWidth = viewportRef.current.offsetWidth;
      const viewportHeight = viewportRef.current.offsetHeight;

      const minPanX = viewportWidth - sceneWidth * (zoom ?? 1);
      const maxPanX = 0;
      const minPanY = viewportHeight - sceneHeight * (zoom ?? 1);
      const maxPanY = 0;

      // Clamp the offset to keep the scene within bounds, shouldn't be needed but still implemented
      const clampedX = Math.min(Math.max(offset.x, minPanX), maxPanX);
      const clampedY = Math.min(Math.max(offset.y, minPanY), maxPanY);

      void panToOffsetScene(
        { x: clampedX, y: clampedY },
        x,
        y,
        scale,
        zoom,
      ).then(() => {
        setIsSceneMoving(false);
        if (onComplete) onComplete();
      });
    },
    [sceneWidth, sceneHeight, x, y, scale],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      activePointersRef.current.set(event.pointerId, event);
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      if (isResetting || isSceneMoving) return;
      stopAllMotion(x, y, scale);
      // pan with 1 pointer, pinch with 2 pointers
      if (activePointersRef.current.size === 1) {
        // do not pan from interactive elements
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
    },
    [
      isResetting,
      isSceneMoving,
      setIsPanning,
      setPanStartPoint,
      setInitialPanOffsetOnDrag,
      x,
      y,
      scale,
      viewportRef,
    ],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (isPanning || activePointersRef.current.size >= 2) {
        stopAllMotion(x, y, scale);
      }
      if (!activePointersRef.current.has(event.pointerId) || isResetting)
        return;
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
          MIN_ZOOM, // Ensure zoom is not less than MIN_ZOOM
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
    },
    [
      isPanning,
      isResetting,
      panStartPoint,
      width,
      sceneWidth,
      height,
      sceneHeight,
      scale,
      initialPanOffsetOnDrag,
      x,
      y,
    ],
  );

  const handlePointerUpOrCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      stopAllMotion(x, y, scale);
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
    },
    [
      isPanning,
      setIsPanning,
      setPanStartPoint,
      setInitialPanOffsetOnDrag,
      viewportRef,
      initialPinchStateRef,
      x,
      y,
    ],
  );

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
          MIN_ZOOM,
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
        stopAllMotion(x, y, scale);

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
    [width, sceneWidth, height, sceneHeight, x, y, scale],
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

  const handlePanToOffset = useCallback(
    (
      offset: { x: number; y: number },
      onComplete?: () => void,
      zoom?: number,
    ) => {
      panToOffset(
        {
          x: -offset.x,
          y: -offset.y,
        },
        viewportRef,
        onComplete,
        zoom,
      );
    },
    [panToOffset, viewportRef],
  );

  return (
    <>
      <CanvasProvider
        x={x}
        y={y}
        scale={scale}
        isResetting={isResetting}
        maxZIndex={maxZIndex}
        setMaxZIndex={setMaxZIndex}
      >
        <Toolbar homeCoordinates={offsetHomeCoordinates} />
        <Navbar panToOffset={handlePanToOffset} onReset={onResetViewAndItems} />
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

interface CanvasProps {
  children: React.ReactNode;
  offset?: SectionCoordinates;
}

export const CanvasComponent: FC<CanvasProps> = ({ children, offset }) => {
  const margin = () => {
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
  };

  return (
    <div
      className="absolute inset-0 z-30 flex"
      style={{
        ...margin(),
        width: offset?.width ? offset.width + "px" : "100vw",
        height: offset?.height ? offset.height + "px" : "100vh",
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
  <div className="pointer-events-none absolute inset-0 hidden h-full w-full bg-none contrast-125 filter md:inline md:bg-noise" />
);

export default Canvas;

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
      type: "spring",
      visualDuration: 0.4,
      bounce: 0.2,
    },
  );
}

const INTERACTIVE_SELECTOR =
  "button,[role='button'],input,textarea,[contenteditable='true']," +
  "[data-toolbar-button],[data-navbar-button]";

// MULTIPLIER ** 2 is the number of screen-sized "tiles" in the canvas
export const MULTIPLIER = 5; // SHOULD ALWAYS BE AN ODD NUMBER
export const HALF_MULT = Math.floor(MULTIPLIER / 2);

const canvasWidth = `${MULTIPLIER * 100}vw`;
const canvasHeight = `${MULTIPLIER * 100}vh`;

const MIN_ZOOM = 1.05 / MULTIPLIER;
const MAX_ZOOM = 10;

const Canvas: FC<Props> = ({ children }) => {
  const { height, width } = useWindowDimensions();

  const sceneWidth = MULTIPLIER * width;
  const sceneHeight = MULTIPLIER * height;

  // left corner of center tile
  const centerX = HALF_MULT * width;
  const centerY = HALF_MULT * height;

  const [panOffset, setPanOffset] = useState<Point>({
    x: -centerX,
    y: -centerY,
  });
  const [zoom, setZoom] = useState<number>(1);

  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartPoint, setPanStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialPanOffsetOnDrag, setInitialPanOffsetOnDrag] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [maxZIndex, setMaxZIndex] = useState<number>(50);

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
    void panToOffsetScene({ x: -centerX, y: -centerY }, sceneControls).then(
      () => {
        setIsResetting(false);
        setPanOffset({ x: -centerX, y: -centerY });
        setZoom(1);
      },
    );
  };

  useEffect(() => {
    setIsResetting(true);
    void panToOffsetScene({ x: -centerX, y: -centerY }, sceneControls)
      .then(() => {
        setPanOffset({ x: -centerX, y: -centerY });
        setZoom(1);
      })
      .then(() => {
        setIsResetting(false);
      });
  }, [centerY, centerX]);

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
    if (isResetting) return;
    sceneControls.stop();
    if (activePointersRef.current.size === 1) {
      const targetElement = event.target as HTMLElement;
      if (targetElement.closest(INTERACTIVE_SELECTOR)) {
        activePointersRef.current.delete(event.pointerId);
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        return;
      }

      setIsPanning(true);
      setPanStartPoint({ x: event.clientX, y: event.clientY });
      setInitialPanOffsetOnDrag({ ...panOffset });
      if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
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
    if (!activePointersRef.current.has(event.pointerId) || isResetting) return;
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
      event.preventDefault();
      // pinch gesture on track
      const isPinch = event.ctrlKey || event.metaKey;
      const isMouseWheelZoom =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ||
        Math.abs(event.deltaY) >= 100;

      // mouse wheel zoom and track pad zoom have different sensitivities
      const ZOOM_SENSITIVITY = isMouseWheelZoom ? 0.0015 : 0.015;

      if (isPinch) {
        const nextZoom = Math.max(
          MIN_ZOOM,
          Math.min(zoom * (1 - event.deltaY * ZOOM_SENSITIVITY), MAX_ZOOM),
        );

        const rect = viewportRef.current?.getBoundingClientRect();

        if (!rect) return;

        const vpLeft = rect.left;
        const vpTop = rect.top;
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        const cursorSceneX = (event.clientX - vpLeft - panOffset.x) / zoom;
        const cursorSceneY = (event.clientY - vpTop - panOffset.y) / zoom;

        let newPanX = event.clientX - vpLeft - cursorSceneX * nextZoom;
        let newPanY = event.clientY - vpTop - cursorSceneY * nextZoom;

        // Clamp pan to prevent scene from escaping bounds
        const minPanX = viewportWidth - sceneWidth * nextZoom;
        const minPanY = viewportHeight - sceneHeight * nextZoom;
        const maxPanX = 0;
        const maxPanY = 0;

        newPanX = Math.min(maxPanX, Math.max(minPanX, newPanX));
        newPanY = Math.min(maxPanY, Math.max(minPanY, newPanY));

        sceneControls.set({ x: newPanX, y: newPanY, scale: nextZoom });
        setPanOffset({ x: newPanX, y: newPanY });
        setZoom(nextZoom);
      } else {
        sceneControls.stop();

        const scrollSpeed = 1;
        const newPanX = panOffset.x - event.deltaX * scrollSpeed;
        const newPanY = panOffset.y - event.deltaY * scrollSpeed;

        const minPanX = width - sceneWidth * zoom;
        const maxPanX = 0;
        const minPanY = height - sceneHeight * zoom;
        const maxPanY = 0;

        const clampedPanX = Math.min(Math.max(newPanX, minPanX), maxPanX);
        const clampedPanY = Math.min(Math.max(newPanY, minPanY), maxPanY);

        setPanOffset({ x: clampedPanX, y: clampedPanY });
      }
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
      <CanvasProvider
        zoom={zoom}
        panOffset={panOffset}
        isResetting={isResetting}
        maxZIndex={maxZIndex}
        setMaxZIndex={setMaxZIndex}
      >
        {(!(
          panOffset.x === -centerX &&
          panOffset.y === -centerY &&
          zoom === 1
        ) ||
          isResetting) && <Toolbar zoom={zoom} panOffset={panOffset} />}
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            pointerEvents: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Navbar
            onResetViewAndItems={onResetViewAndItems}
            panOffset={panOffset}
            zoom={zoom}
            isResetting={isResetting}
          />
        </div>
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
            }}
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
  x?: string;
  y?: string;
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
      style.marginLeft = offset.x;
    } else {
      style.marginLeft = "auto";
      style.marginRight = "auto";
    }

    if (offset.y != null) {
      style.marginTop = offset.y;
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

const gradientBgImage = `radial-gradient(ellipse ${MULTIPLIER * 100}vw ${MULTIPLIER * 100}vh at ${MULTIPLIER * 50}vw ${MULTIPLIER * 100}vh, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`;

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

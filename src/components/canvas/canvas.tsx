import {
  motion,
  type MotionValue,
  type Point,
  useMotionValue,
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
  calcInitialBoxWidth,
  canvasHeight,
  canvasWidth,
  getDistance,
  getMidpoint,
  getScreenSizeEnum,
  getSectionPanCoordinates,
  INTERACTIVE_SELECTOR,
  MAX_ZOOM,
  MIN_ZOOMS,
  panToOffsetScene,
  ZOOM_BOUND,
} from "~/lib/canvas";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import Navbar from "./navbar";
import Toolbar from "./toolbar";
import { type SectionCoordinates } from "~/constants/canvas";
import { CanvasWrapper, growTransition, MAX_DIM_RATIO } from "./wrapper";

interface Props {
  homeCoordinates: SectionCoordinates;
  children: React.ReactNode;
}

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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const sceneWidth = canvasWidth;
  const sceneHeight = canvasHeight;

  const MIN_ZOOM = MIN_ZOOMS[getScreenSizeEnum(windowWidth)];

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
  const [animationStage, setAnimationStage] = useState<number>(0); // 0: initial, 1: finish grow, 2: pan to home

  const initialBoxWidth = useMemo(
    () => calcInitialBoxWidth(windowWidth, windowHeight),
    [windowWidth, windowHeight],
  );

  // somewhere near the middle-ish
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(initialBoxWidth);

  const offsetHomeCoordinates = useMemo(
    () =>
      getSectionPanCoordinates({
        windowDimensions: { width: windowWidth, height: windowHeight },
        coords: homeCoordinates,
        targetZoom: 1,
      }),
    [homeCoordinates, windowWidth, windowHeight],
  );

  const onResetViewAndItems = useCallback(
    (onComplete?: () => void): void => {
      setIsResetting(true);

      void panToOffsetScene(offsetHomeCoordinates, x, y, scale, 1).then(() => {
        setIsResetting(false);
        if (onComplete) onComplete();
      });
    },
    [offsetHomeCoordinates, x, y, scale],
  );

  // grow canvas scale at same rate as CanvasWrapper
  useEffect(() => {
    const finalScale = Math.max(
      (windowWidth || 0) / canvasWidth,
      (windowHeight || 0) / canvasHeight,
    );

    // 2 stage animation: grow canvas to fill screen, then zoom & pan to home

    // 1. grow canvas to fill screen
    const stage1 = async () => {
      // compute initial wrapper 3:2 box dimensions to center within
      const aspectRatio = 3 / 2;
      const maxW = windowWidth * MAX_DIM_RATIO.width;
      const maxH = windowHeight * MAX_DIM_RATIO.height;
      const initWrapperWidth =
        maxW / aspectRatio <= maxH ? maxW : maxH * aspectRatio;
      const initWrapperHeight =
        maxW / aspectRatio <= maxH ? maxW / aspectRatio : maxH;

      const initialScale = initialBoxWidth;
      const initialCenterX =
        (initWrapperWidth - canvasWidth * initialScale) / 2;
      const initialCenterY =
        (initWrapperHeight - canvasHeight * initialScale) / 2;

      // set start as centered in the initial box (no animation)
      x.set(initialCenterX);
      y.set(initialCenterY);

      // compute final centered offsets for full viewport
      const finalCenterX = (windowWidth - canvasWidth * finalScale) / 2;
      const finalCenterY = (windowHeight - canvasHeight * finalScale) / 2;

      await Promise.all([
        animate(scale, finalScale, {
          duration: growTransition.duration,
          delay: growTransition.delay + 0.1,
          ease: "easeOut",
        }),
        animate(x, finalCenterX, {
          duration: growTransition.duration,
          delay: growTransition.delay + 0.1,
          ease: "easeOut",
        }),
        animate(y, finalCenterY, {
          duration: growTransition.duration,
          delay: growTransition.delay + 0.1,
          ease: "easeOut",
        }),
      ]);
    };

    // 2. pan to center the "home" section (seamless continuation)
    const stage2Transition = {
      duration: 0.75,
      ease: [0.25, 0.1, 0.25, 1], // smooth continuation easing
    } as const;

    const { x: homeX, y: homeY } = offsetHomeCoordinates;

    const stage2 = async () => {
      await Promise.all([
        animate(x, homeX, stage2Transition),
        animate(y, homeY, stage2Transition),
        animate(scale, 1, stage2Transition),
      ]);
    };

    void stage1().then(() => {
      setAnimationStage(1);
      void stage2().then(() => {
        setAnimationStage(2);
      });
    });
    // only want this to run on mount; it's a load-in animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Stable wheel listener wrapper that always calls the latest handler via ref
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const wheelWrapper = useCallback((e: WheelEvent) => {
    wheelHandlerRef.current?.(e);
  }, []);

  // Ensure wheel listener attaches when the element actually mounts (wrapper delays child mount)
  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up old listener if ref changes/unmounts
      if (viewportRef.current) {
        viewportRef.current.removeEventListener("wheel", wheelWrapper);
      }
      viewportRef.current = node;
      if (node) {
        node.addEventListener("wheel", wheelWrapper, { passive: false });
      }
    },
    [wheelWrapper],
  );

  const activePointersRef = useRef<Map<number, PointerEvent<HTMLDivElement>>>(
    new Map(),
  );
  const initialPinchStateRef = useRef<{
    distance: number;
    midpoint: Point;
    zoom: number;
    panOffset: Point;
  } | null>(null);

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
        const minPanX = windowWidth - sceneWidth * scale.get();
        const maxPanX = 0;
        const minPanY = windowHeight - sceneHeight * scale.get();
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

        const minPanX = windowWidth - sceneWidth * newZoom;
        const maxPanX = 0;
        const minPanY = windowHeight - sceneHeight * newZoom;
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
      x,
      y,
      scale,
      panStartPoint.x,
      panStartPoint.y,
      windowWidth,
      sceneWidth,
      windowHeight,
      sceneHeight,
      initialPanOffsetOnDrag.x,
      initialPanOffsetOnDrag.y,
      MIN_ZOOM,
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
    [x, y, scale, isPanning],
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

        const minPanX = windowWidth - sceneWidth * scale.get();
        const maxPanX = 0;
        const minPanY = windowHeight - sceneHeight * scale.get();
        const maxPanY = 0;

        const clampedPanX = Math.min(Math.max(newPanX, minPanX), maxPanX);
        const clampedPanY = Math.min(Math.max(newPanY, minPanY), maxPanY);

        x.set(clampedPanX);
        y.set(clampedPanY);
      }
    },
    [scale, MIN_ZOOM, x, y, sceneWidth, sceneHeight, windowWidth, windowHeight],
  );

  // Keep the wheel handler ref pointing to the latest implementation
  useEffect(() => {
    wheelHandlerRef.current = handleWheelZoom;
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
    <CanvasWrapper>
      <CanvasProvider
        x={x}
        y={y}
        scale={scale}
        isResetting={isResetting}
        maxZIndex={maxZIndex}
        setMaxZIndex={setMaxZIndex}
        animationStage={animationStage}
      >
        {animationStage >= 2 && (
          <>
            <Toolbar homeCoordinates={offsetHomeCoordinates} />
            <Navbar
              panToOffset={handlePanToOffset}
              onReset={onResetViewAndItems}
            />
          </>
        )}
        <div
          ref={setViewportRef}
          className="relative h-full w-full touch-none select-none overflow-hidden"
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
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              x,
              y,
              scale,
            }}
          >
            <Gradient />
            {animationStage >= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeIn" }}
              >
                <Dots />
              </motion.div>
            )}
            {animationStage >= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeIn" }}
              >
                <Filter />
              </motion.div>
            )}
            {children}
          </motion.div>
        </div>
      </CanvasProvider>
    </CanvasWrapper>
  );
};

export const gradientBgImage = `radial-gradient(ellipse ${canvasWidth}px ${canvasHeight}px at ${canvasWidth / 2}px ${canvasHeight}px, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`;

const Gradient = React.memo(function Gradient() {
  return (
    <div
      className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100"
      style={{
        backgroundImage: gradientBgImage,
      }}
    />
  );
});

const Dots = React.memo(function Dots() {
  return (
    <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1.5px,transparent_1px)] opacity-60 [background-size:22px_22px]" />
  );
});

const Filter = React.memo(function Filter() {
  return (
    <div className="contrast-60 pointer-events-none absolute inset-0 hidden h-full w-full bg-none opacity-60 filter md:inline md:bg-noise" />
  );
});

export default Canvas;

import Head from "next/head";
import { motion, type Point, useAnimationControls } from "framer-motion";
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

interface Props {
  children: React.ReactNode;
}

const Canvas: FC<Props> = ({ children }) => {
  const { height, width } = useWindowDimensions();

  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
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
    void sceneControls
      .start(
        { x: 0, y: 0, scale: 1 },
        { duration: 0.3, type: "spring", damping: 14, stiffness: 120, mass: 1 },
      )
      .then(() => {
        setIsResetting(false);
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
        { duration: 0.3, type: "spring", damping: 14, stiffness: 120, mass: 1 },
      )
      .then(() => {
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
      setInitialPanOffsetOnDrag({ ...panOffset }); // Use current panOffset
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
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, event);

    if (isPanning && activePointersRef.current.size === 1) {
      event.preventDefault();
      const deltaX = (event.clientX - panStartPoint.x) / zoom;
      const deltaY = (event.clientY - panStartPoint.y) / zoom;
      setPanOffset({
        x: Math.min(
          Math.max(
            initialPanOffsetOnDrag.x + deltaX,
            -zoom * width! + 0.5 * width!,
          ),
          zoom * width! - 0.5 * width!,
        ),
        y: Math.min(
          Math.max(
            initialPanOffsetOnDrag.y + deltaY,
            -zoom * height! + 0.5 * height!,
          ),
          zoom * height! - 0.5 * height!,
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
        midpoint: initialMidpointViewport,
        zoom: initialZoom,
        panOffset: initialPanOffsetPinch,
      } = initialPinchStateRef.current;

      if (initialDistance === 0) return;

      let newZoom = initialZoom * (currentDistance / initialDistance);
      newZoom = Math.max(0.1, Math.min(newZoom, 10));

      const initialMidpointSceneX =
        (initialMidpointViewport.x - initialPanOffsetPinch.x) / initialZoom;
      const initialMidpointSceneY =
        (initialMidpointViewport.y - initialPanOffsetPinch.y) / initialZoom;

      const newPanX = Math.min(
        Math.max(
          currentMidpoint.x - initialMidpointSceneX * newZoom,
          -zoom * width!,
        ),
        zoom * width!,
      );
      const newPanY = Math.min(
        Math.max(
          currentMidpoint.y - initialMidpointSceneY * newZoom,
          -zoom * height!,
        ),
        zoom * height!,
      );

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    }
  };

  const handlePointerUpOrCancel = (
    event: PointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    if ((event.target as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    }
    activePointersRef.current.delete(event.pointerId);

    if (isPanning && activePointersRef.current.size < 1) {
      setIsPanning(false);
      if (viewportRef.current) viewportRef.current.style.cursor = "grab";
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
      setInitialPanOffsetOnDrag({ ...panOffset }); // Use current panOffset
    }
  };

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      const isPinch = event.ctrlKey || event.metaKey;

      if (isPinch) event.preventDefault();

      const zoomFactor = isPinch ? 0.075 : 0.1;

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

      const sceneMouseX = (mouseX - panOffset.x) / zoom;
      const sceneMouseY = (mouseY - panOffset.y) / zoom;
      
      const newPanX = Math.min(
        Math.max(mouseX - sceneMouseX * clampedZoom, -clampedZoom * width! + 0.5 * width!),
        zoom * width! - 0.5 * width!,
      );
      const newPanY = Math.min(
        Math.max(mouseY - sceneMouseY * clampedZoom, -clampedZoom * height! + 0.5 * height!),
        zoom * height! - 0.5 * height!,
      );

      setZoom(clampedZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    },
    [zoom, panOffset, setZoom, setPanOffset, width, height],
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
      <Reset onResetViewAndItems={onResetViewAndItems} />
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
            className="absolute z-20 h-screen w-screen origin-center"
            animate={sceneControls}
          >
            {children}
          </motion.div>
        </div>
      </CanvasProvider>
    </>
  );
};

export default Canvas;

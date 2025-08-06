import React, {
  useRef,
  useEffect,
  forwardRef,
  useState,
  useCallback,
} from "react";
import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  type HTMLMotionProps,
  type PanInfo,
} from "framer-motion";
import { useCanvasContext } from "~/contexts/CanvasContext";
import { useMemoPoint } from "~/lib/canvas";

interface Point {
  x: number;
  y: number;
}

export interface DraggableProps extends HTMLMotionProps<"div"> {
  initialPos?: Point;
  shouldStopPropagation?: (e: React.PointerEvent) => boolean;
}

export const Draggable = forwardRef<HTMLDivElement, DraggableProps>(
  (props, ref) => {
    const {
      initialPos: passedPos,
      children,
      style,
      shouldStopPropagation = () => true,
      ...restProps
    } = props;

    const {
      scale: parentZoom,
      x: panOffsetX,
      y: panOffsetY,
      isResetting,
      maxZIndex,
      setMaxZIndex,
    } = useCanvasContext();

    const panOffset = useMemoPoint(panOffsetX.get(), panOffsetY.get());

    const defaultPos = useMemoPoint(0, 0);
    const initialPos = passedPos ?? defaultPos;

    const x = useMotionValue(initialPos.x);
    const y = useMotionValue(initialPos.y);

    const logicalPositionRef = useRef<Point>({ ...initialPos });
    const controls = useAnimationControls();

    const [zIndex, setZIndex] = useState(1);

    useEffect(() => {
      if (isResetting) {
        logicalPositionRef.current = { ...initialPos };
        void animate(x, initialPos.x, {
          duration: 0.3,
          type: "spring",
          damping: 14,
          stiffness: 120,
          mass: 1,
        });
        void animate(y, initialPos.y, {
          duration: 0.3,
          type: "spring",
          damping: 14,
          stiffness: 120,
          mass: 1,
        });
      }
    }, [initialPos, controls, isResetting, panOffset, x, y]);

    const handleDrag = (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo,
    ) => {
      controls.stop();
      const deltaParentX = info.delta.x / parentZoom.get();
      const deltaParentY = info.delta.y / parentZoom.get();

      logicalPositionRef.current.x += deltaParentX;
      logicalPositionRef.current.y += deltaParentY;

      x.set(logicalPositionRef.current.x);
      y.set(logicalPositionRef.current.y);

      if (zIndex < maxZIndex) {
        setZIndex(maxZIndex + 1);
        setMaxZIndex(maxZIndex + 1);
      }
    };

    return (
      <motion.div
        ref={ref}
        dragMomentum={false}
        drag
        animate={controls}
        onDrag={handleDrag}
        style={{
          ...style,
          x,
          y,
          zIndex,
        }}
        initial={{
          scale: 1,
          filter: "drop-shadow(0 0px 0px rgba(0, 0, 0, 0)) brightness(1)",
          position: "relative",
        }}
        onPointerDown={(e: React.PointerEvent) => {
          if (shouldStopPropagation?.(e)) {
            e.stopPropagation();
          }
        }}
        transition={{
          duration: 0.1,
          ease: "easeOut",
        }}
        {...restProps}
      >
        {children}
      </motion.div>
    );
  },
);

Draggable.displayName = "Draggable";

export interface DraggableImageProps extends DraggableProps {
  src: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  scale?: number;
}

function drawImageToCanvas(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
}

function getAlphaAtCoords(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement | null,
  img: HTMLImageElement | null,
): number {
  if (!canvas || !img) return 0;

  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  const rect = img.getBoundingClientRect();

  const x = ((clientX - rect.left) / rect.width) * img.naturalWidth;
  const y = ((clientY - rect.top) / rect.height) * img.naturalHeight;

  const alpha = ctx.getImageData(x, y, 1, 1).data[3] ?? 0;
  return alpha;
}

function isMouseOverImage(
  clientX: number,
  clientY: number,
  img: HTMLImageElement | null,
) {
  if (!img) return false;
  const rect = img.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function updateCursor(
  opaque: boolean,
  isMouseDown: boolean,
  img: HTMLImageElement | null,
) {
  let cursor = "url('customcursor.svg'), auto"; // default
  if (opaque) cursor = "grab";
  if (isMouseDown) cursor = "grabbing";
  if (img) img.style.cursor = cursor;
}

export function DraggableImage(props: DraggableImageProps) {
  const {
    src,
    alt,
    width,
    height,
    initialPos,
    animate,
    className,
    scale,
    ...restProps
  } = props;
  const imgRef = useRef<HTMLImageElement>(null);
  const [isOpaque, setIsOpaque] = useState(true); // default to true for better UX
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMouseDown = useRef(false);

  // create a invisible canvas element to check the alpha value of the image
  useEffect(() => {
    if (typeof window !== "undefined" && !canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    if (!img.complete) {
      img.onload = () => drawImageToCanvas(img, canvas);
    } else {
      drawImageToCanvas(img, canvas);
    }
    return () => {
      if (img) img.onload = null;
    };
  }, []);

  // handle global mouse move to update cursor and opacity
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (
        !isMouseDown.current &&
        isMouseOverImage(e.clientX, e.clientY, imgRef.current)
      ) {
        const alpha = getAlphaAtCoords(
          e.clientX,
          e.clientY,
          canvasRef.current,
          imgRef.current,
        );

        // checking alpha > n rather than 0 to not trigger on shadows and such
        const opaque = alpha > 128;

        setIsOpaque(opaque);
        updateCursor(opaque, false, imgRef.current);
      }
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isMouseDown.current = true;
    e.stopPropagation(); // Prevents the event from bubbling up
    updateCursor(true, true, imgRef.current);
  }, []);

  const handlePointerUp = () => {
    isMouseDown.current = false;
    updateCursor(isOpaque, false, imgRef.current);
  };

  const hoverScale = isOpaque ? (scale ?? 1) * 1.05 : (scale ?? 1);

  return (
    <Draggable
      initialPos={initialPos}
      className={className}
      drag={isOpaque}
      style={{
        height: 0,
      }}
      {...restProps}
    >
      <motion.img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        animate={animate}
        draggable="false"
        whileHover={{ scale: hoverScale }}
        style={{
          scale: scale ?? 1,
          pointerEvents: isOpaque ? "auto" : "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
    </Draggable>
  );
}

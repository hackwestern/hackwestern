import React, { useRef, useEffect, forwardRef, useState } from "react";
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
      zoom: parentZoom,
      panOffset,
      isResetting,
      maxZIndex,
      setMaxZIndex,
    } = useCanvasContext();

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
      const deltaParentX = info.delta.x / parentZoom;
      const deltaParentY = info.delta.y / parentZoom;

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

export const DraggableImage: React.FC<DraggableImageProps> = ({
  src,
  alt,
  width,
  height,
  initialPos,
  animate,
  className,
  scale,
  ...restProps
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isOpaque, setIsOpaque] = useState(true); // default to true for better UX
  const [isMouseDown, setIsMouseDown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // create a invisible canvas element to check the alpha value of the image
  useEffect(() => {
    if (typeof window !== "undefined" && !canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    if (!img.complete) {
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
      };
    } else {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
    }
    return () => {
      if (img) img.onload = null;
    };
  }, []);

  const checkAlpha = (e: React.PointerEvent) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const alpha =
      ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] ?? 0;

    // checking alpha > n rather than 0 to not trigger on shadows and such
    const opaque = alpha > 128;
    setIsOpaque(opaque);

    let cursor = "url('customcursor.svg'), auto"; // default

    // lowest-priority “grab”
    if (opaque) cursor = "grab";

    // “grabbing” overrides the previous rule
    if (e.type === "pointerdown" || isMouseDown) cursor = "grabbing";

    // highest-priority “grab” (must come last)
    if (e.type === "pointerup") cursor = "grab";

    img.style.cursor = cursor;
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (imgRef.current) {
      imgRef.current.style.cursor = "url('customcursor.svg'), auto";
    }
  };

  const hoverScale = isOpaque ? (scale ?? 1) * 1.05 : (scale ?? 1);

  return (
    <Draggable
      initialPos={initialPos}
      className={className}
      drag={isOpaque}
      shouldStopPropagation={() => isOpaque}
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
        }}
        onPointerDown={(e) => {
          setIsMouseDown(true);
          checkAlpha(e);
        }}
        onPointerUp={(e) => {
          setIsMouseDown(false);
          checkAlpha(e);
        }}
        onPointerMove={checkAlpha}
        onPointerLeave={(e) => {
          setIsMouseDown(false);
          handlePointerLeave(e);
        }}
        className="h-auto w-auto"
      />
    </Draggable>
  );
};

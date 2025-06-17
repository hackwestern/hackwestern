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
}

export const Draggable = forwardRef<HTMLDivElement, DraggableProps>(
  (props, ref) => {
    const { initialPos: passedPos, children, style, ...restProps } = props;

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
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ cursor: "url('/customcursor.svg'), grabbing" }}
        {...restProps}
      >
        {children}
      </motion.div>
    );
  },
);

Draggable.displayName = "Draggable";

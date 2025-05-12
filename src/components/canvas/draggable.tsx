import React, { useRef, useEffect, forwardRef } from "react";
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
    const {
      initialPos: passedPos,
      animate: animatePropFromUser,
      children,
      style,
      ...restProps
    } = props;

    const { zoom: parentZoom, panOffset } = useCanvasContext();

    const defaultPos = useMemoPoint(0, 0);
    const initialPos = passedPos ?? defaultPos;

    const x = useMotionValue(initialPos.x);
    const y = useMotionValue(initialPos.y);

    const logicalPositionRef = useRef<Point>({ ...initialPos });
    const controls = useAnimationControls();

    useEffect(() => {
      if (parentZoom === 1 && panOffset.x === 0 && panOffset.y === 0) {
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
    }, [initialPos, controls, parentZoom, panOffset, x, y]);

    const handleDrag = (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo,
    ) => {
      const deltaParentX = info.delta.x / parentZoom;
      const deltaParentY = info.delta.y / parentZoom;

      logicalPositionRef.current.x += deltaParentX;
      logicalPositionRef.current.y += deltaParentY;

      x.set(logicalPositionRef.current.x);
      y.set(logicalPositionRef.current.y);
    };

    const finalAnimate = animatePropFromUser ?? controls;

    return (
      <motion.div
        ref={ref}
        dragMomentum={false}
        drag
        animate={finalAnimate}
        onDrag={handleDrag}
        style={{
          ...style,
          x,
          y,
        }}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ cursor: "grabbing" }}
        {...restProps}
      >
        {children}
      </motion.div>
    );
  },
);

Draggable.displayName = "Draggable";

import React, { useRef, useEffect, forwardRef } from "react";
import {
  motion,
  useAnimationControls,
  type HTMLMotionProps,
  type PanInfo,
} from "framer-motion";
import { useCanvasContext } from "~/contexts/CanvasContext";

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
      initialPos = { x: 0, y: 0 },
      drag,
      onDrag: onDragPropFromUser,
      animate: animatePropFromUser,
      children,
      ...restProps
    } = props;

    const { zoom: parentZoom, panOffset } = useCanvasContext();

    const logicalPositionRef = useRef<Point>({ ...initialPos });
    const controls = useAnimationControls();

    useEffect(() => {
      if (parentZoom === 1 && panOffset.x === 0 && panOffset.y === 0) {
        logicalPositionRef.current = { ...initialPos };
        void controls.start({
          x: initialPos.x,
          y: initialPos.y,
        });
      }
    }, [initialPos, controls, parentZoom, panOffset]);

    const handleDrag = (
      event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo,
    ) => {
      const deltaParentX = info.delta.x / parentZoom;
      const deltaParentY = info.delta.y / parentZoom;

      logicalPositionRef.current.x += deltaParentX;
      logicalPositionRef.current.y += deltaParentY;

      controls.set({
        x: logicalPositionRef.current.x,
        y: logicalPositionRef.current.y,
      });

      if (onDragPropFromUser) {
        onDragPropFromUser(event, info);
      }
    };

    const isCustomDragActive = !!drag;

    const finalAnimate = animatePropFromUser ?? controls;

    return (
      <motion.div
        ref={ref}
        dragMomentum={false}
        drag={drag}
        animate={finalAnimate}
        onDrag={isCustomDragActive ? handleDrag : onDragPropFromUser}
        {...restProps}
      >
        {children}
      </motion.div>
    );
  },
);

Draggable.displayName = "Draggable";

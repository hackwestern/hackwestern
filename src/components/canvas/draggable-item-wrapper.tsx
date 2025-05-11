import { type FC, useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
interface Point { x: number; y: number; }

export interface CanvasItemData {
  id: string;
  type: 'item';
  initialPos: Point;
  component: React.ReactNode;
}

export interface PageItemData {
  id: string;
  type: 'page';
  initialPos: Point;
  size: { width: number; height: number };
  pageComponent: React.ReactNode;
}

export type MainCanvasElementData = CanvasItemData | PageItemData;

export interface DraggableItemWrapperProps {
  initialPos: Point;
  parentZoom: number;
  dragConstraintsRef?: React.RefObject<HTMLElement>;
  onDragUpdate?: (newPosition: Point) => void;
  isDraggable: boolean;
  children: React.ReactNode;
  className?: string;
}

const DraggableItemWrapper: FC<DraggableItemWrapperProps> = ({
  initialPos,
  parentZoom,
  dragConstraintsRef,
  onDragUpdate,
  isDraggable,
  children,
  className,
}) => {

  const positionRef = useRef<Point>({ ...initialPos });
  const controls = useAnimationControls();

  useEffect(() => {
    void controls.set({ x: initialPos.x, y: initialPos.y });
    positionRef.current = { ...initialPos };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className={`absolute ${isDraggable ? 'cursor-grab' : ''} ${className ?? ''}`}
      drag={isDraggable ? true : undefined} // Conditionally enable drag
      dragConstraints={isDraggable && dragConstraintsRef ? dragConstraintsRef : undefined}
      animate={controls}
      onDrag={isDraggable ? (event, info) => {
        const deltaParentX = info.delta.x / parentZoom; // Scale delta by parent's zoom
        const deltaParentY = info.delta.y / parentZoom;

        positionRef.current.x += deltaParentX;
        positionRef.current.y += deltaParentY;

        controls.set({
          x: positionRef.current.x,
          y: positionRef.current.y,
        });

        if (onDragUpdate) {
          onDragUpdate({ ...positionRef.current });
        }
      } : undefined}
      onPointerDown={isDraggable ? (e) => e.stopPropagation() : undefined}
      style={{
        pointerEvents: isDraggable ? 'auto' : 'auto',
      }}
    >
      {children}
    </motion.div>
  );
};

export default DraggableItemWrapper;
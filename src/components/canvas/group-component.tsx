// GroupComponent.tsx (Simplified from PageComponent)

import { motion, useAnimationControls } from "framer-motion";
import { useRef, useEffect, type FC } from "react";
import DraggableItemWrapper from "./draggable-item-wrapper"; // Assuming DraggableItemWrapper is in the same folder or path is adjusted

interface Point {
  x: number;
  y: number;
}

export interface GroupSubItemData {
  id: string;
  initialPosInGroup: Point;
  isDraggable: boolean;
  content: React.ReactNode;
}

interface GroupComponentProps {
  id: string;
  initialGroupPosOnCanvas: Point;
  canvasZoom: number;
  subItemsData: GroupSubItemData[];
  groupVisualClassName?: string;
  groupSize?: { width: number; height: number };
}

const GroupComponent: FC<GroupComponentProps> = ({
  id,
  initialGroupPosOnCanvas,
  canvasZoom,
  subItemsData,
  groupVisualClassName,
  groupSize,
}) => {
  const controls = useAnimationControls();
  const positionOnCanvasRef = useRef<Point>({ ...initialGroupPosOnCanvas });

  useEffect(() => {
    controls.set({
      x: initialGroupPosOnCanvas.x,
      y: initialGroupPosOnCanvas.y,
    });
    positionOnCanvasRef.current = { ...initialGroupPosOnCanvas };
  }, [initialGroupPosOnCanvas, controls]);

  const combinedClassName = `absolute ${groupVisualClassName ?? ""}`.trim();

  return (
    <motion.div
      className={combinedClassName}
      animate={controls}
      style={{
        width: groupSize?.width,
        height: groupSize?.height,
      }}
    >
      {subItemsData.map((item) => (
        <DraggableItemWrapper
          key={item.id}
          initialPos={item.initialPosInGroup}
          parentZoom={canvasZoom}
          isDraggable={item.isDraggable}
        >
          {item.content}
        </DraggableItemWrapper>
      ))}
      {groupVisualClassName && (
        <div className="absolute -top-5 left-0 text-xs text-gray-400 opacity-50">
          Group: {id}
        </div>
      )}
    </motion.div>
  );
};

export default GroupComponent;

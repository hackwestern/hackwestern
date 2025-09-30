import { type FC } from "react";
import { type SectionCoordinates } from "~/constants/canvas";
import { useCanvasContext } from "~/contexts/CanvasContext";
import Image from "next/image";

interface CanvasProps {
  children: React.ReactNode;
  offset?: SectionCoordinates;
  optimize?: boolean;
  imageFallback?: string;
}

export const CanvasComponent: FC<CanvasProps> = ({
  children,
  offset,
  optimize = true,
  imageFallback,
}) => {
  const { animationStage } = useCanvasContext();

  const margin = () => {
    if (!offset) {
      return { margin: "auto" };
    }

    const style: React.CSSProperties = {};

    if (offset.x != null) {
      style.marginLeft = offset.x + "px";
    } else {
      style.marginLeft = "auto";
      style.marginRight = "auto";
    }

    if (offset.y != null) {
      style.marginTop = offset.y + "px";
    } else {
      style.marginTop = "auto";
      style.marginBottom = "auto";
    }

    return style;
  };

  // TODO:
  if (optimize) {
    // check if component is inside of viewport, return null if not
  }

  return (
    <div
      className="absolute inset-0 z-30 flex"
      style={{
        ...margin(),
        width: offset?.width ? offset.width + "px" : "100vw",
        height: offset?.height ? offset.height + "px" : "100vh",
      }}
    >
      {animationStage >= 2 || !imageFallback ? (
        children
      ) : (
        <Image
          src={imageFallback}
          alt="Canvas Fallback"
          width={offset?.width ?? 1920}
          height={offset?.height ?? 1080}
          className="m-auto h-auto w-full object-contain"
        />
      )}
    </div>
  );
};

import { type FC } from "react";
import { type SectionCoordinates } from "~/constants/canvas";
import { useCanvasContext } from "~/contexts/CanvasContext";
import Image from "next/image";
import useWindowDimensions from "~/hooks/useWindowDimensions";

interface CanvasProps {
  children: React.ReactNode;
  offset?: SectionCoordinates;
  optimize?: boolean;
  // used for initial load on smaller screens in the mini-canvas
  // shows a static image instead of rendering the component because it's more performant
  imageFallback?: string;
}

export const CanvasComponent: FC<CanvasProps> = ({
  children,
  offset,
  optimize = true,
  imageFallback,
}) => {
  const { animationStage } = useCanvasContext();
  const { width } = useWindowDimensions();

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

  // don't show fallback for sufficiently large screens because there is a pixel shift that occurs
  // when switching from the image to the real component, and on larger screens this happens on screen
  // also unlikely to find a weaker device on a 1440p+ screen so performance is less of a concern
  const shouldShowFallback =
    animationStage < 2 && imageFallback && width < 2000;

  return (
    <div
      className="absolute inset-0 z-30 flex"
      style={{
        ...margin(),
        width: offset?.width ? offset.width + "px" : "100vw",
        height: offset?.height ? offset.height + "px" : "100vh",
      }}
    >
      {shouldShowFallback ? (
        <Image
          src={imageFallback}
          alt="Canvas Fallback"
          width={offset?.width ?? 1920}
          height={offset?.height ?? 1080}
          className="m-auto h-auto w-full object-contain"
        />
      ) : (
        children
      )}
    </div>
  );
};

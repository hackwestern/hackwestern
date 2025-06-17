import { memo, useMemo } from "react";
import useWindowDimensions from "~/hooks/useWindowDimensions";

const ELLIPSE_W = "550vh";
const ELLIPSE_H = "300vh";

type GridProps = {
  offsetVertical: number;
  offsetHorizontal: number;
  hasGradient: boolean;
  circleX?: string;
  circleY?: string;
};

export const Dots = () => (
  <div className="z-1 absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1px,transparent_1px)] opacity-50 [background-size:16px_16px]" />
);

export const Filter = () => (
  <div className="pointer-events-none absolute inset-0 z-20 h-full w-full bg-noise opacity-100 brightness-[105%] contrast-[170%] filter" />
);
export const Grid = memo(
  ({
    offsetVertical,
    offsetHorizontal,
    hasGradient,
    circleX,
    circleY,
  }: GridProps) => {
    const { height = 0, width = 0 } = useWindowDimensions();

    const { heightDelta, widthDelta } = useMemo(
      () => ({
        heightDelta: height * offsetVertical,
        widthDelta: width * offsetHorizontal,
      }),
      [height, width, offsetVertical, offsetHorizontal],
    );

    const gradientStyle = useMemo(() => {
      if (!hasGradient || !circleX || !circleY) return undefined;
      return {
        backgroundImage: `radial-gradient(ellipse ${ELLIPSE_W} ${ELLIPSE_H} at ${circleX} ${circleY}, var(--coral) 0%, var(--salmon) 40%, var(--lilac) 65%, var(--beige) 90%)`,
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
      };
    }, [hasGradient, circleX, circleY]);

    return (
      <div
        className="h-screen w-screen bg-beige"
        style={{
          position: "absolute",
          top: heightDelta,
          left: widthDelta,
          width: "100%",
          height: "100%",
        }}
      >
        {gradientStyle && (
          <div className="absolute inset-0 z-0" style={gradientStyle} />
        )}
        <Filter />
        <Dots />
      </div>
    );
  },
);
Grid.displayName = "Grid";

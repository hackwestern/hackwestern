import { motion } from "framer-motion";
import useWindowDimensions from "~/hooks/useWindowDimensions";

export const Grid = ({
  offsetVertical,
  offsetHorizontal,
  hasGradient,
  circleX,
  circleY,
}: {
  offsetVertical: number;
  offsetHorizontal: number;
  hasGradient: boolean;
  circleX?: string;
  circleY?: string;
}) => {
  const { height, width } = useWindowDimensions();

  const heightDelta = (height ?? 0) * offsetVertical;
  const widthDelta = (width ?? 0) * offsetHorizontal;

  const ellipseWidth = "550vh";
  const ellipseHeight = "300vh";

  return (
    <div>
      <motion.div
        className="h-screen w-screen bg-beige"
        style={{
          position: "absolute",
          top: heightDelta,
          left: widthDelta,
          width: "100%",
          height: "100%",
        }}
      >
        {hasGradient && ellipseHeight && ellipseWidth && circleX && circleY && (
          <div
            className="absolute inset-0 z-0 h-full w-full bg-hw-radial-gradient opacity-100"
            style={{
              backgroundImage: `radial-gradient(ellipse ${ellipseWidth} ${ellipseHeight} at ${circleX} ${circleY}, var(--coral) 0%, var(--salmon) 40%, var(--lilac) 65%, var(--beige) 90%)`,
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          ></div>
        )}
        <div className="z-1 absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1px,transparent_1px)] opacity-25 [background-size:16px_16px]"></div>
        <div className="absolute inset-0 z-0 h-full w-full bg-noise opacity-100 brightness-[110%] contrast-[170%] filter"></div>
      </motion.div>
    </div>
  );
};

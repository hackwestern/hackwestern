import { easeIn, motion } from "framer-motion";
import { useState, useEffect } from "react";

export const MAX_DIM_RATIO = { width: 0.8, height: 0.6 };

export const growTransition = {
  duration: 1,
  delay: 2,
  easeIn,
};

export const CanvasWrapper = ({ children }: { children: React.ReactNode }) => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    // calculate the initial 3:2 box size with margins (client-only)
    const calculateInitialSize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const maxWidth = vw * MAX_DIM_RATIO.width;
      const maxHeight = vh * MAX_DIM_RATIO.height;

      const aspectRatio = 3 / 2;

      // width or height as limiter
      if (maxWidth / aspectRatio <= maxHeight) {
        return { width: maxWidth, height: maxWidth / aspectRatio };
      } else {
        return { height: maxHeight, width: maxHeight * aspectRatio };
      }
    };

    setDimensions(calculateInitialSize());
  }, []);

  const gradientBgImage = dimensions
    ? `radial-gradient(ellipse ${dimensions.width * 3}px ${dimensions.height * 2}px at ${dimensions.width * 1.5}px ${dimensions.height}px, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`
    : undefined;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundImage: gradientBgImage }}
    >
      {dimensions && (
        <motion.div
          initial={{
            width: dimensions.width,
            height: dimensions.height,
          }}
          animate={{
            width: "100vw", // Expand beyond viewport for spill over
            height: "100vh", // Expand beyond viewport for spill over
          }}
          transition={growTransition}
          className="relative origin-top-left overflow-hidden rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
        >
          <div className="h-full w-full">{children}</div>
        </motion.div>
      )}
    </div>
  );
};

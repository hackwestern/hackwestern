import { easeIn, motion } from "framer-motion";
import { useState, useEffect } from "react";
import Image from "next/image";

export const MAX_DIM_RATIO = { width: 0.8, height: 0.5 };

export const growTransition = {
  duration: 1,
  delay: 4,
  easeIn,
};

export const CanvasWrapper = ({ children }: { children: React.ReactNode }) => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dots, setDots] = useState<string>("..");

  // add up to 4 dots, then go back down to 2
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length < 3) {
          return prevDots + ".";
        } else {
          return ".";
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

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
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundImage: gradientBgImage }}
    >
      <div className="absolute left-1/2 top-64 z-0 -translate-x-1/2 -translate-y-[200px] text-center">
        <Image
          src="/horse.svg"
          alt="Hack Western Logo"
          width={64}
          height={64}
          className="mx-auto mb-4"
        />
        <div className="font-jetbrains-mono font-semibold text-[#543C5AB2]">
          HACK WESTERN 12
        </div>
      </div>

      {dimensions && (
        <>
          <motion.div
            initial={{
              width: dimensions.width,
              height: dimensions.height,
              opacity: 1,
            }}
            animate={{
              opacity: 0,
            }}
            transition={{
              duration: 2,
              delay: 2,
            }}
            className="absolute left-1/2 top-1/2 z-20 origin-center -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-violet-300 shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          ></motion.div>
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
            className="absolute left-1/2 top-1/2 z-10 origin-center -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          >
            <div className="h-full w-full">{children}</div>
          </motion.div>
        </>
      )}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center font-jetbrains-mono font-semibold text-[#543C5AB2]">
        LOADING CANVAS{dots}
      </div>
    </div>
  );
};

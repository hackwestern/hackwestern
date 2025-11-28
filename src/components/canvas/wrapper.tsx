import { type Easing, motion, type MotionValue } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export const MAX_DIM_RATIO = { width: 0.8, height: 0.5 };

export const growTransition = {
  duration: 0.96,
  delay: 3.14,
  ease: [0.35, 0.1, 0.8, 1] as Easing,
};

const blurTransition = {
  duration: 0.85,
  delay: 1.25,
  ease: "easeIn" as Easing,
};

interface CanvasWrapperProps {
  children: React.ReactNode;
  /** Shared progress MV (0->1) for the grow animation */
  introProgress: MotionValue<number>;
  /** Callback when the grow (stage1) completes */
  onIntroGrowComplete?: () => void;
}

export const CanvasWrapper = ({
  children,
  introProgress,
  onIntroGrowComplete,
}: CanvasWrapperProps) => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dots, setDots] = useState<string>("..");
  const completedRef = useRef(false);

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
    ? `linear-gradient(to top, #FEB6AF 0%, var(--salmon) 15%, var(--beige) 50%`
    : undefined;

  const gradientCanvasBg = `radial-gradient(130.38% 95% at 50.03% 97.25%, #EFB8A0 0%, #EAD2DF 48.09%, #EFE3E1 100%)`;

  const stage1NotFinished = introProgress.get() !== 1;

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundImage: stage1NotFinished ? gradientBgImage : undefined,
        touchAction: "none",
        userSelect: "none",
        pointerEvents: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stage1NotFinished && (
        <div className="absolute left-1/2 top-64 z-0 grid -translate-x-1/2 -translate-y-[200px] place-items-center text-center">
          <Image
            src="/horse.svg"
            alt="Hack Western Logo"
            width={64}
            height={64}
            className="mb-4"
          />
          <div className="font-jetbrains-mono font-semibold text-[#543C5AB2]">
            HACK WESTERN 12
          </div>
        </div>
      )}

      {dimensions && (
        <>
          {/* Blurring mask box */}
          <motion.div
            initial={{
              width: dimensions.width,
              height: dimensions.height,
              opacity: 1,
              backgroundImage: gradientCanvasBg,
            }}
            animate={{
              opacity: 0,
              display: "none",
            }}
            transition={blurTransition}
            className="absolute left-1/2 top-1/2 z-20 origin-center -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg"
          />
          {/* Growing wrapper drives introProgress */}
          <motion.div
            initial={{
              width: dimensions.width,
              height: dimensions.height,
            }}
            animate={{
              width: "100vw",
              height: "100vh",
            }}
            transition={growTransition}
            onUpdate={(latest: { width?: number; height?: number }) => {
              if (completedRef.current) return;
              if (typeof latest.width === "number") {
                const w0 = dimensions.width;
                const w1 = window.innerWidth;
                const progress =
                  w1 === w0 ? 1 : (latest.width - w0) / (w1 - w0);
                const clamped = Math.min(Math.max(progress, 0), 1);
                introProgress.set(clamped);
              }
            }}
            onAnimationComplete={() => {
              if (!completedRef.current) {
                completedRef.current = true;
                introProgress.set(1);
                onIntroGrowComplete?.();
              }
            }}
            className="absolute left-1/2 top-1/2 z-10 origin-center -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg shadow-[0_20px_40px_rgba(103,86,86,0.15)]"
          >
            <div className="h-full w-full">{children}</div>
          </motion.div>
        </>
      )}
      {stage1NotFinished && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center font-jetbrains-mono font-semibold text-[#543C5AB2]">
          LOADING CANVAS{dots}
        </div>
      )}
    </motion.div>
  );
};

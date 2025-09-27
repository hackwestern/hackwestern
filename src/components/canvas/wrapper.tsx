import { type Easing, motion, type MotionValue } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export const MAX_DIM_RATIO = { width: 0.8, height: 0.5 };

export const growTransition = {
  duration: 0.75,
  delay: 2.65,
  ease: [0.35, 0.1, 0.8, 1] as Easing,
};

const blurTransition = {
  duration: 0.75,
  delay: 1,
  ease: "easeIn",
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
    ? `radial-gradient(ellipse ${dimensions.width * 3}px ${dimensions.height * 2}px at ${dimensions.width * 1.5}px ${dimensions.height}px, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`
    : undefined;

  // target viewport size (snapshot once; no responsive re-flow during intro)
  const targetViewport = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!dimensions) return;
    if (!targetViewport.current) {
      targetViewport.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
  }, [dimensions]);

  const targetWidth = targetViewport.current?.width;
  const targetHeight = targetViewport.current?.height;

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundImage: gradientBgImage,
        touchAction: "none",
        userSelect: "none",
        pointerEvents: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      initial={{ backdropFilter: "blur(20px)", opacity: 0 }}
      animate={{ backdropFilter: "blur(0px)", opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
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

      {dimensions && targetWidth != null && targetHeight != null && (
        <>
          {/* Blurring mask box */}
          <motion.div
            initial={{
              width: dimensions.width,
              height: dimensions.height,
              backdropFilter: "blur(20px)",
            }}
            animate={{
              backdropFilter: "blur(0px)",
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
              width: targetWidth,
              height: targetHeight,
            }}
            transition={growTransition}
            onUpdate={(latest: { width?: number; height?: number }) => {
              if (completedRef.current) return;
              if (typeof latest.width === "number") {
                const w0 = dimensions.width;
                const w1 = targetWidth;
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
            className="absolute left-1/2 top-1/2 z-10 origin-center -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          >
            <div className="h-full w-full">{children}</div>
          </motion.div>
        </>
      )}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center font-jetbrains-mono font-semibold text-[#543C5AB2]">
        LOADING CANVAS{dots}
      </div>
    </motion.div>
  );
};

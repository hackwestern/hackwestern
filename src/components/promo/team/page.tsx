import React from "react";
import { motion } from "framer-motion";
import { Bindings } from "./constants";

const maskImage =
  "radial-gradient(circle at center, transparent 12px, black 12px), linear-gradient(black, black)";

const maskSize = "30px 80px, calc(100% - 30px) 100%";

const maskRepeat = "repeat-y, no-repeat";

const pageHoleMask: React.CSSProperties = {
  maskImage,
  maskSize,
  maskRepeat,
  WebkitMaskImage: maskImage,
  WebkitMaskSize: maskSize,
  WebkitMaskRepeat: maskRepeat,
};

const frontPos = "0px 340px, 30px 0";

const frontPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: frontPos,
  WebkitMaskPosition: frontPos,
};

const backPos = "right 340px, left 0";

const backPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: backPos,
  WebkitMaskPosition: backPos,
};

const FrontHoles = () => (
  <>
    <div style={frontPageHoleMask} className="h-[723px] w-[18px] bg-beige" />
    <div
      style={{ transform: "rotateY(180deg)", ...frontPageHoleMask }}
      className="-ml-1 -mr-0.5 h-[723px] w-[18px] bg-beige"
    />
  </>
);

const BackHoles = () => (
  <>
    <div
      style={{ transform: "rotateY(180deg)", ...backPageHoleMask }}
      className="-mr-1 h-[723px] w-[18px] bg-beige"
    />
    <div style={backPageHoleMask} className="h-[723px] w-[18px] bg-beige" />
  </>
);

function Page({
  label,
  front,
  back,
  isFlipped,
  onFlipComplete,
  turnPageBackward,
  turnPageForward,
}: {
  label: string;
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlipComplete?: () => void;
  turnPageBackward: () => void;
  turnPageForward: () => void;
}) {
  return (
    <motion.div
      className="relative h-full w-full"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
      }}
      initial={false}
      // Animate based on the isFlipped prop
      animate={{ rotateY: isFlipped ? -180 : 0 }}
      transition={{
        duration: 0.7,
        ease: [0.645, 0.045, 0.355, 1.0], // Custom cubic-bezier for smoother motion
        type: "tween", // Try tween instead of keyframes
      }}
      onAnimationComplete={onFlipComplete}
    >
      {/* Front of the page */}
      <div
        className="absolute inset-0 my-8 ml-1 mr-6 flex overflow-hidden rounded-lg"
        style={{
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageForward}
      >
        <div className="pointer-events-none absolute inset-0 z-20 -ml-[535px]">
          <Bindings />
        </div>
        <FrontHoles />
        {front}
      </div>

      {/* Back of the page */}
      <div
        className="absolute inset-0 my-8 ml-1 mr-6 flex overflow-hidden rounded-lg"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageBackward}
      >
        {back}
        <BackHoles />
        <div className="pointer-events-none absolute inset-0 -mr-[36px] ml-[499px]">
          <Bindings />
        </div>
      </div>
    </motion.div>
  );
}

export default Page;

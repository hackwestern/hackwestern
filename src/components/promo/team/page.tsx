import React from "react";
import { motion } from "framer-motion";

const maskImage =
  "radial-gradient(circle at center, transparent 12px, black 12px), linear-gradient(black, black)";

const maskSize = "30px 61px, calc(100% - 30px) 100%";

const maskRepeat = "repeat-y, no-repeat";

const pageHoleMask: React.CSSProperties = {
  maskImage,
  maskSize,
  maskRepeat,
  WebkitMaskImage: maskImage,
  WebkitMaskSize: maskSize,
  WebkitMaskRepeat: maskRepeat,
};

const frontPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: "0px 91px, 30px 0",
  WebkitMaskPosition: "0px 91px, 30px 0",
};

const backPageHoleMask: React.CSSProperties = {
  ...pageHoleMask,
  maskPosition: "right 91px, left 0",
  WebkitMaskPosition: "right 91px, left 0",
};

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
      className="relative z-30 h-full w-full"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
      }}
      initial={false}
      // Animate based on the isFlipped prop
      animate={{ rotateY: isFlipped ? -180 : 0 }}
      transition={{ duration: 3, ease: "easeInOut" }}
      onAnimationComplete={onFlipComplete}
    >
      {/* Front of the page */}
      <div
        className="absolute inset-0 z-[30] my-8 ml-1 mr-6 flex overflow-hidden rounded-lg"
        style={{
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageForward}
      >
        <div
          style={frontPageHoleMask}
          className="z-0 h-[723px] w-[18px] bg-white"
        />
        <div
          style={{ transform: "rotateY(180deg)", ...frontPageHoleMask }}
          className="z-[30] -ml-1 -mr-0.5 h-[723px] w-[18px] bg-white"
        />
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
        <div
          style={{ transform: "rotateY(180deg)", ...backPageHoleMask }}
          className="z-[30] -mr-1 h-[723px] w-[18px] bg-white"
        />
        <div
          style={backPageHoleMask}
          className="z-0 h-[723px] w-[18px] bg-white"
        />
      </div>
    </motion.div>
  );
}

export default Page;

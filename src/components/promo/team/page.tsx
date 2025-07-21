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

const FrontHoles = () => (
  <>
    <div style={frontPageHoleMask} className="h-[723px] w-[18px] bg-gray-500" />
    <div
      style={{ transform: "rotateY(180deg)", ...frontPageHoleMask }}
      className="-ml-1 -mr-0.5 h-[723px] w-[18px] bg-red-500"
    />
  </>
);

const BackHoles = () => (
  <>
    <div
      style={{ transform: "rotateY(180deg)", ...backPageHoleMask }}
      className="-mr-1 h-[723px] w-[18px] bg-red-500"
    />
    <div style={backPageHoleMask} className="h-[723px] w-[18px] bg-gray-500" />
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
  zIndex,
}: {
  label: string;
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlipComplete?: () => void;
  turnPageBackward: () => void;
  turnPageForward: () => void;
  zIndex: number;
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
      transition={{ duration: 3, ease: "easeInOut" }}
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
      </div>
    </motion.div>
  );
}

export default Page;

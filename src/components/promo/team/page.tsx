import React from "react";
import { motion } from "framer-motion";
import { BackHoles, Bindings, FrontHoles } from "./constants";

function Label({
  label,
  offset,
  onClick,
}: {
  label: string;
  offset: number;
  onClick?: () => void;
}) {
  const labelClass = `flex h-[45px] items-center justify-center rounded-t-md border-t border-gray-200 bg-beige px-2 text-xs uppercase tracking-wider absolute -mt-2 text-medium hover:text-heavy hover:-mt-3 transition-all`;

  return (
    <>
      <div
        className={labelClass}
        style={{
          backfaceVisibility: "hidden",
          left: offset !== 0 ? `${offset}px` : "0",
          pointerEvents: "auto",
        }}
        onClick={onClick}
      >
        {label}
      </div>
      <div
        className={labelClass}
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          left: offset !== 0 ? `${offset}px` : "0",
          zIndex: 9999,
          pointerEvents: "auto",
        }}
        onClick={onClick}
      >
        <span style={{ display: "inline-block" }}>{label}</span>
      </div>
    </>
  );
}

function Page({
  label,
  labelOffset,
  front,
  back,
  isFlipped,
  onFlipComplete,
  turnPageBackward,
  turnPageForward,
}: {
  label: string;
  labelOffset: number;
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlipComplete?: () => void;
  turnPageBackward: () => void;
  turnPageForward: () => void;
}) {
  return (
    <motion.div
      className="relative h-full w-full cursor-pointer"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
      }}
      initial={false}
      // Animate based on the isFlipped prop
      animate={{ rotateY: isFlipped ? -180 : 0 }}
      transition={{
        duration: 0.5,
        ease: [0.645, 0.045, 0.355, 1.0], // Custom cubic-bezier for smoother motion
        type: "tween", // Try tween instead of keyframes
      }}
      onAnimationComplete={onFlipComplete}
    >
      <Label label={label} offset={labelOffset} />
      {/* Front of the page */}
      <div
        className="absolute inset-0 my-8 ml-1 mr-6 flex cursor-pointer overflow-hidden rounded-lg"
        style={{
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageForward}
      >
        <div className="pointer-events-none absolute inset-0 z-20 -ml-[535px]">
          <Bindings />
        </div>
        <FrontHoles />
        <div className="h-full w-full bg-beige p-8">{front}</div>
      </div>

      {/* Back of the page */}
      <div
        className="absolute inset-0 my-8 ml-1 mr-6 flex cursor-pointer overflow-hidden rounded-lg"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageBackward}
      >
        <div className="h-full w-full bg-beige p-8">{back}</div>
        <BackHoles />
        <div className="pointer-events-none absolute inset-0 -mr-[36px] ml-[499px]">
          <Bindings />
        </div>
      </div>
    </motion.div>
  );
}

export default Page;

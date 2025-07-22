import React, { useState } from "react";
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
  const labelClass = `flex h-[45px] items-center justify-center rounded-t-md border-t border-gray-200 bg-beige px-[8px] text-xs uppercase tracking-wider absolute -mt-[8px] text-medium hover:text-heavy hover:-mt-[12px] transition-all z-[10000]`;

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
  flipDuration,
  onFlipComplete,
  turnPageBackward,
  turnPageForward,
  onLabelClick,
}: {
  label: string;
  labelOffset: number;
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  flipDuration: number;
  onFlipComplete?: () => void;
  turnPageBackward: () => void;
  turnPageForward: () => void;
  onLabelClick?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="pointer-events-none relative h-[723px] w-[555px] cursor-pointer"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
      }}
      initial={false}
      // Animate based on the isFlipped prop
      animate={{ rotateY: isFlipped ? -180 : 0 }}
      transition={{
        duration: flipDuration / 1000, // Convert ms to seconds for framer-motion
        ease: [0.645, 0.045, 0.355, 1.0],
        type: "tween",
      }}
      onAnimationComplete={onFlipComplete}
    >
      <Label label={label} offset={labelOffset} onClick={onLabelClick} />
      {/* Front of the page */}
      <div
        className="pointer-events-auto absolute inset-0 my-[32px] ml-[4px] mr-[24px] flex cursor-pointer overflow-hidden rounded-lg"
        style={{
          backfaceVisibility: "hidden",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (back) turnPageForward();
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-20 -ml-[535px]">
          <Bindings />
        </div>
        <FrontHoles />
        <div className="h-full w-full bg-beige p-[32px] relative">
          {front}
          {/* Page curl effect */}
          <div 
            className="absolute bottom-0 right-0 pointer-events-none transition-all duration-500 ease-out"
            style={{
              width: isHovered ? '80px' : '0px',
              height: isHovered ? '80px' : '0px',
              background: 'linear-gradient(225deg, #f8f5f0 0%, #f2efe8 25%, #ede8e0 50%, #e8e3db 75%, #e0dbd3 100%)',
              clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)',
              boxShadow: isHovered 
                ? '-8px -8px 20px rgba(0,0,0,0.15), -4px -4px 12px rgba(0,0,0,0.1), -2px -2px 6px rgba(0,0,0,0.08)'
                : 'none',
              transform: isHovered ? 'rotate(0deg)' : 'rotate(0deg)',
              borderBottomRightRadius: '0px',
              opacity: isHovered ? 1 : 0,
            }}
          />
        </div>
      </div>
      {/* Back of the page */}
      <div
        className="pointer-events-auto absolute inset-0 my-[32px] ml-[4px] mr-[24px] flex cursor-pointer overflow-hidden rounded-lg"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}
        onClick={turnPageBackward}
      >
        <div className="h-full w-full bg-beige p-[32px]">{back}</div>
        <BackHoles />
        <div className="pointer-events-none absolute inset-0 -mr-[36px] ml-[499px]">
          <Bindings />
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(Page);
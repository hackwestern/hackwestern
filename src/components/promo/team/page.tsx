import React from "react";
import { motion } from "framer-motion";

function Page({
  label,
  front,
  back,
  isFlipped,
  onFlipComplete,
}: {
  label: string;
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlipComplete?: () => void;
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
      transition={{ duration: 0.5, ease: "easeInOut" }}
      onAnimationComplete={onFlipComplete}
    >
      {/* Front of the page */}
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: "hidden" }}
      >
        {front}
      </div>

      {/* Back of the page */}
      <div
        className="absolute inset-0"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}
      >
        {back}
      </div>
    </motion.div>
  );
}

export default Page;

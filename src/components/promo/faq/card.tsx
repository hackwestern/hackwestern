import { motion } from "framer-motion";
import React, { useState } from "react";

const Lines = React.memo(function Lines() {
  return (
    <div className="relative z-0">
      <div className="absolute left-0 right-0 mt-16 space-y-[19px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-full border-t border-[rgba(0,0,0,0.1)]" />
        ))}
      </div>
    </div>
  );
});

export const FAQCard = React.memo(function FAQCard({
  title,
  desc,
  className,
  rotation,
}: {
  title: string;
  desc: string;
  className?: string;
  rotation?: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      className={`w-2xl relative h-[255px] w-[315px] cursor-pointer text-medium transition-all hover:scale-[1.02] ${className}`}
      style={{ perspective: 1200 }}
      onClick={() => setFlipped(!flipped)}
      onKeyDown={(e) => e.key === " " && setFlipped(!flipped)}
      tabIndex={0}
    >
      <motion.div
        className="absolute inset-0 preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", rotate: rotation }}
      >
        {/* Front of the card */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-50 px-4 py-2 shadow-lg"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="relative h-full w-full">
            <Lines />
            <h2 className="font-jetbrainsmono relative z-10 mx-auto flex h-full w-2/3 items-center justify-center text-center text-xl font-medium">
              {title.toUpperCase()}
            </h2>
          </div>
        </div>
        {/* Back of the card */}
        <div
          className="absolute inset-0 bg-neutral-50 px-4 py-2 shadow-lg"
          style={{
            transform: "rotateY(180deg) translateZ(1px)",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="relative flex h-full w-full flex-col space-y-2 text-left">
            <Lines />
            <div className="z-10">
              <h2 className="font-jetbrainsmono text-md relative z-10 min-h-14 font-medium">
                {title.toUpperCase()}
              </h2>
              <p className="mt-0.5 font-figtree text-[12px] leading-[20px]">
                {desc}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </button>
  );
});

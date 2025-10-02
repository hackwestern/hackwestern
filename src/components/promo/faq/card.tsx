import { motion } from "framer-motion";
import React, { useState } from "react";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import Image from "next/image";

const Lines = React.memo(function Lines() {
  const { width } = useWindowDimensions();

  return (
    <div className="absolute z-0 sm:relative">
      {width > 640 ? (
        <div className="absolute left-0 right-0 mt-16 space-y-[19px] px-2 py-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-full border-t border-[rgba(0,0,0,0.1)]" />
          ))}
        </div>
      ) : (
        <Image
          src={"/images/promo/faq/note.png"}
          alt=""
          height={255}
          width={315}
        />
      )}
    </div>
  );
});

export const FAQCard = ({
  title,
  desc,
  className,
  rotation,
}: {
  title: string;
  desc: string;
  className?: string;
  rotation?: string;
}) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      className={`relative h-[255px] w-2xl w-[315px] cursor-pointer text-medium transition-all hover:scale-[1.02] ${className}`}
      style={{ perspective: 1200, willChange: flipped ? "transform" : "auto" }}
      onClick={() => setFlipped(!flipped)}
      onKeyDown={(e) => e.key === " " && setFlipped(!flipped)}
      tabIndex={0}
    >
      <motion.div
        className="absolute inset-0 preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          rotate: rotation,
          willChange: flipped ? "transform" : "auto"
        }}
      >
        {/* Front of the card */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-50 shadow-lg"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden"
          }}
        >
          <div className="relative h-full w-full">
            <Lines />
            <h2 className="font-jetbrainsmono relative z-10 mx-auto flex h-full w-2/3 items-center justify-center px-4 text-center text-xl font-medium">
              {title.toUpperCase()}
            </h2>
          </div>
        </div>
        {/* Back of the card */}
        <div
          className="absolute inset-0 bg-neutral-50 shadow-lg"
          style={{
            transform: "rotateY(180deg) translateZ(1px)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden"
          }}
        >
          <div className="relative flex h-full w-full flex-col space-y-2 text-left">
            <Lines />
            <div className="z-10">
              <h2 className="font-jetbrainsmono text-md relative z-10 min-h-14 px-4 pt-2 font-medium">
                {title.toUpperCase()}
              </h2>
              <p className="mt-0.5 px-4 py-2 font-figtree text-[12px] leading-[20px]">
                {desc}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </button>
  );
};

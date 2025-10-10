import React from "react";
import { motion, AnimatePresence } from "framer-motion";

type ApplyHeadingProps = {
  heading: string | null;
  subheading?: string | null;
  stepKey?: string | null | undefined;
};

const slideX = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3, ease: [0.37, 0.1, 0.6, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.37, 0.1, 0.6, 1] },
  },
};

export default function ApplyHeading({
  heading,
  subheading,
  stepKey,
}: ApplyHeadingProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey ?? "heading"}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={slideX}
        className="mb-2"
      >
        <h1 className="mb-2 font-dico text-2xl font-medium text-heavy">
          {heading}
        </h1>
        {subheading && (
          <h2 className="font-figtree text-sm text-medium">{subheading}</h2>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

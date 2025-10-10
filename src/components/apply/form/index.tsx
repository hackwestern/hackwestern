import React from "react";
import type { ApplyStep } from "~/constants/apply";
import { AvatarForm } from "./avatar-form";
import { BasicsForm } from "./basics-form";
import { InfoForm } from "./info-form";
import { ApplicationForm } from "./application-form";
import { LinksForm } from "./links-form";
import { AgreementsForm } from "./agreements-form";
import { OptionalForm } from "./optional-form";
import { CanvasForm } from "./canvas-form";
import { ReviewForm } from "./review-form";
import { AnimatePresence, motion } from "framer-motion";
import { usePendingNavigation } from "~/hooks/use-pending-navigation";

type ApplyFormProps = {
  step: ApplyStep | null;
};

const formFade = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.37, 0.1, 0.6, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: [0.37, 0.1, 0.6, 1] },
  },
};

export function ApplyForm({ step }: ApplyFormProps) {
  const { pending } = usePendingNavigation();

  // Render the active form inside AnimatePresence so when `step` changes
  // we get a brief crossfade. When `pending` is true (navigating away),
  // the current form will play its exit animation.
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step ?? "empty"}
        initial="initial"
        animate={pending ? "exit" : "animate"}
        exit="exit"
        variants={formFade}
        className="w-full"
      >
        {(() => {
          switch (step) {
            case "character":
              return <AvatarForm />;
            case "basics":
              return <BasicsForm />;
            case "info":
              return <InfoForm />;
            case "application":
              return <ApplicationForm />;
            case "links":
              return <LinksForm />;
            case "agreements":
              return <AgreementsForm />;
            case "optional":
              return <OptionalForm />;
            case "canvas":
              return <CanvasForm />;
            case "review":
              return <ReviewForm />;
            default:
              return <></>;
          }
        })()}
      </motion.div>
    </AnimatePresence>
  );
}

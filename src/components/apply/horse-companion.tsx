/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getHorse } from "~/constants/realms";
import { cn } from "~/lib/utils";

export interface HorseCompanionProps {
  horseId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  className?: string;
}

// Normalized display box every horse PNG is contained inside, so the
// different source aspect ratios (3:2, 4:3, 1:1, 5:7) all render at the
// same on-screen size without cropping or re-exporting the assets.
const BOX_W = 160;
const BOX_H = 160;

function buildGreeting(firstName?: string | null, lastName?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!name) return "Hello!! Excited to meet you! Let's get rolling!";
  return `Hi, I'm ${name}! Let's get this application rolling!`;
}

export function HorseCompanion({
  horseId,
  firstName,
  lastName,
  className,
}: HorseCompanionProps) {
  const horse = getHorse(horseId);
  const greeting = buildGreeting(firstName, lastName);

  return (
    <AnimatePresence mode="wait">
      {horse ? (
        <motion.div
          key={horse.id}
          className={cn(
            "pointer-events-none flex flex-col items-center gap-1",
            className,
          )}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Speech bubble above the horse — tail points down. */}
          <div className="relative max-w-[200px] rounded-xl bg-white/95 px-3 py-1.5 shadow-[0_4px_10px_rgba(4,34,57,0.18)]">
            <p className="font-figtree text-[11px] font-medium leading-snug text-heavy">
              {greeting}
            </p>
            <span
              aria-hidden
              className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white/95"
            />
          </div>
          {/* Fixed-size, bottom-aligned box: object-contain keeps every horse
              at the same visual footprint regardless of its source aspect. */}
          <div
            className="relative shrink-0"
            style={{ width: `${BOX_W}px`, height: `${BOX_H}px` }}
          >
            <img
              src={horse.asset}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-contain object-bottom drop-shadow-[0_6px_10px_rgba(4,34,57,0.3)]"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

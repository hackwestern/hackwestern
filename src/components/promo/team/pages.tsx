import React, { useState, useRef } from "react";
import Page from "./page";
import { PAGES } from "./teams";

const DEFAULT_FLIP_DURATION = 500; // Default speed in ms for a single flip
const TOTAL_JUMP_DURATION = 1000; // Total time in ms for a multi-page jump

const Pages = () => {
  const [turnedPages, setTurnedPages] = useState(0);
  const [flippingPage, setFlippingPage] = useState<number | null>(null);
  const [flipDuration, setFlipDuration] = useState(DEFAULT_FLIP_DURATION);
  const targetPage = useRef<number | null>(null);

  const totalPages = PAGES.length;

  const handleFlipComplete = () => {
    if (targetPage.current !== null) {
      if (turnedPages < targetPage.current) {
        setFlippingPage(turnedPages);
        setTurnedPages((prev) => prev + 1);
        return;
      } else if (turnedPages > targetPage.current) {
        setFlippingPage(turnedPages - 1);
        setTurnedPages((prev) => prev - 1);
        return;
      }
    }

    setFlippingPage(null);
    targetPage.current = null;
    setFlipDuration(DEFAULT_FLIP_DURATION); // Reset to default speed
  };

  const turnPageForward = () => {
    if (turnedPages >= totalPages) return;
    setFlipDuration(DEFAULT_FLIP_DURATION); // Ensure default speed
    setFlippingPage(turnedPages);
    setTurnedPages((prev) => prev + 1);
  };

  const turnPageBackward = () => {
    if (turnedPages <= 0) return;
    setFlipDuration(DEFAULT_FLIP_DURATION); // Ensure default speed
    setFlippingPage(turnedPages - 1);
    setTurnedPages((prev) => prev - 1);
  };

  const handleLabelClick = (index: number) => {
    if (index === turnedPages || flippingPage !== null) return;

    const numPagesToFlip = Math.abs(index - turnedPages);
    if (numPagesToFlip > 0) {
      // Calculate duration for each page to meet the total jump time
      setFlipDuration(TOTAL_JUMP_DURATION / numPagesToFlip);
    }

    targetPage.current = index;

    if (index > turnedPages) {
      setFlippingPage(turnedPages);
      setTurnedPages((prev) => prev + 1);
    } else {
      setFlippingPage(turnedPages - 1);
      setTurnedPages((prev) => prev - 1);
    }
  };

  return (
    <>
      {PAGES.map((page, index) => {
        const isFlipped = index < turnedPages;
        const isFlipping = flippingPage === index;

        let zIndex;
        if (isFlipping) {
          // The page currently flipping is always on top.
          zIndex = PAGES.length * 2 + 1;
        } else if (isFlipped) {
          // Flipped pages (left side) stack from bottom up.
          zIndex = index;
        } else {
          // Unflipped pages (right side) stack from top down.
          zIndex = PAGES.length * 2 - index;
        }

        return (
          <div
            key={index}
            className="pointer-events-none absolute left-0 top-0 h-full w-1/2"
            style={{
              transform: "translateX(100%)",
              perspective: 3200,
              zIndex,
            }}
          >
            <Page
              label={page.label}
              front={page.front}
              back={page.back}
              labelOffset={page.labelOffset}
              isFlipped={isFlipped}
              flipDuration={flipDuration}
              onFlipComplete={isFlipping ? handleFlipComplete : undefined}
              turnPageBackward={turnPageBackward}
              turnPageForward={turnPageForward}
              onLabelClick={() => handleLabelClick(index)}
            />
          </div>
        );
      })}
    </>
  );
};

export default Pages;

import React, { useState, useRef } from "react";
import Page from "./page";
import { PAGES } from "./teams";

const DEFAULT_FLIP_DURATION = 300; // Default speed in ms for a single flip
const TOTAL_JUMP_DURATION = 700; // Total time in ms for a multi-page jump
const DEBOUNCE_MS = DEFAULT_FLIP_DURATION / 2; // Debounce time for flipping actions

const totalPages = PAGES.length;

// Helpers: keep UI logic simple and declarative
const isPageActive = (
  index: number,
  turnedPages: number,
  flippingPage: number | null,
) => {
  // neighbouring pages and flipping pages are considered "active" and should be rendered
  return (
    flippingPage === index ||
    index === turnedPages + 1 ||
    index === turnedPages ||
    index === turnedPages - 1 ||
    index === turnedPages - 2
  );
};

const computeZIndex = (
  index: number,
  isFlipped: boolean,
  isFlipping: boolean,
  pagesCount: number,
) => {
  if (isFlipping) {
    // The page currently flipping is always on top.
    return pagesCount * 2 + 1;
  }
  if (isFlipped) {
    // Flipped pages (left side) stack from bottom up.
    return index;
  }
  // Unflipped pages (right side) stack from top down.
  return pagesCount * 2 - index;
};

const calculatePerPageDuration = (numPagesToFlip: number) =>
  Math.min(
    TOTAL_JUMP_DURATION / Math.max(1, numPagesToFlip),
    DEFAULT_FLIP_DURATION,
  );

const Pages = () => {
  const [turnedPages, setTurnedPages] = useState(1);
  const [flippingPage, setFlippingPage] = useState<number | null>(null);
  const [flipDuration, setFlipDuration] = useState(DEFAULT_FLIP_DURATION);
  const targetPage = useRef<number | null>(null);
  const lastFlipTime = useRef<number>(0);

  function handleFlipComplete() {
    const target = targetPage.current;
    if (target !== null) {
      if (turnedPages < target) {
        setFlippingPage(turnedPages);
        setTurnedPages((prev) => prev + 1);
        return;
      }
      if (turnedPages > target) {
        setFlippingPage(turnedPages - 1);
        setTurnedPages((prev) => prev - 1);
        return;
      }
    }

    // reset state when we've reached the target (or no target)
    setFlippingPage(null);
    targetPage.current = null;
    setFlipDuration(DEFAULT_FLIP_DURATION);
  }

  function tryDebounced(fn: () => void) {
    const now = Date.now();
    if (now - lastFlipTime.current < DEBOUNCE_MS) return;
    lastFlipTime.current = now;
    fn();
  }

  function turnPageForward() {
    tryDebounced(() => {
      if (turnedPages >= totalPages) return;
      setFlipDuration(DEFAULT_FLIP_DURATION);
      setFlippingPage(turnedPages);
      setTurnedPages((prev) => prev + 1);
    });
  }

  function turnPageBackward() {
    tryDebounced(() => {
      if (turnedPages <= 1) return;
      setFlipDuration(DEFAULT_FLIP_DURATION);
      setFlippingPage(turnedPages - 1);
      setTurnedPages((prev) => prev - 1);
    });
  }

  function handleClickLabel(index: number) {
    if (index === turnedPages || flippingPage !== null) return;

    const numPagesToFlip = Math.abs(index - turnedPages);
    setFlipDuration(calculatePerPageDuration(numPagesToFlip));

    targetPage.current = index;

    if (index > turnedPages) {
      setFlippingPage(turnedPages);
      setTurnedPages((prev) => prev + 1);
    } else {
      setFlippingPage(turnedPages - 1);
      setTurnedPages((prev) => prev - 1);
    }
  }

  return (
    <>
      {PAGES.map((page, index) => {
        const isFlipped = index < turnedPages;
        const isFlipping = flippingPage === index;
        const isActive = isPageActive(index, turnedPages, flippingPage);
        const zIndex = computeZIndex(
          index,
          isFlipped,
          isFlipping,
          PAGES.length,
        );

        return (
          <div
            key={index}
            className="pointer-events-none absolute left-0 top-0 h-[723px] w-[555px]"
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
              isActive={isActive}
              isSelected={index === turnedPages}
              flipDuration={flipDuration}
              onFlipComplete={isFlipping ? handleFlipComplete : undefined}
              turnPageBackward={turnPageBackward}
              turnPageForward={turnPageForward}
              onLabelClick={() => handleClickLabel(index)}
            />
          </div>
        );
      })}
    </>
  );
};

export default Pages;

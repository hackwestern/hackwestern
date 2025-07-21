import React, { useState } from "react";
import Page from "./page";
import { LeftCover, RightCover, Bindings } from "./constants";
import { PAGES } from "./teams";

function Book() {
  const [turnedPages, setTurnedPages] = useState(0);
  // 1. STATE TO TRACK THE ACTIVE PAGE
  // null when nothing is moving, or the index of the page that is currently flipping.
  const [flippingPage, setFlippingPage] = useState<number | null>(null);

  const totalPages = PAGES.length;

  const handleFlipComplete = () => {
    // 4. When the animation is done, reset the flipping page state.
    setFlippingPage(null);
  };

  const turnPageForward = () => {
    if (turnedPages >= totalPages) return;
    // 2. Set the active page *before* changing the turnedPages count.
    // The page that WILL flip is the one at the current `turnedPages` index.
    setFlippingPage(turnedPages);
    setTurnedPages((prev) => prev + 1);
  };

  const turnPageBackward = () => {
    if (turnedPages <= 0) return;
    // The page that WILL flip back is the one at `turnedPages - 1`.
    setFlippingPage(turnedPages - 1);
    setTurnedPages((prev) => prev - 1);
  };

  return (
    // Perspective is needed for the 3D effect on child elements
    <div className="relative h-[723px] w-[1110px]">
      {/* Container for all pages */}
      <div className="absolute h-full w-full">
        <LeftCover />
        {PAGES.map((page, index) => {
          const isFlipped = index < turnedPages;
          const isFlipping = flippingPage === index;

          let zIndex;
          if (isFlipping) {
            zIndex = 100; // Highest while flipping
          } else if (isFlipped) {
            zIndex = index; // Lower for already-flipped pages
          } else {
            zIndex = PAGES.length * 2 - index; // Much higher for unflipped pages
          }

          return (
            <div
              key={index}
              className="absolute left-0 top-0 h-full w-1/2"
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
                onFlipComplete={isFlipping ? handleFlipComplete : undefined}
                turnPageBackward={turnPageBackward}
                turnPageForward={turnPageForward}
              />
            </div>
          );
        })}
        <RightCover />
        <Bindings />
      </div>
    </div>
  );
}

export default Book;

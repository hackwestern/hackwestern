import React, { useState } from "react";
import Page from "./page";
import { PAGES } from "./teams";

const Pages = () => {
  const [turnedPages, setTurnedPages] = useState(0);
  const [flippingPage, setFlippingPage] = useState<number | null>(null);

  const totalPages = PAGES.length;

  const handleFlipComplete = () => {
    setFlippingPage(null);
  };

  const turnPageForward = () => {
    if (turnedPages >= totalPages) return;
    setFlippingPage(turnedPages);
    setTurnedPages((prev) => prev + 1);
  };

  const turnPageBackward = () => {
    if (turnedPages <= 0) return;
    setFlippingPage(turnedPages - 1);
    setTurnedPages((prev) => prev - 1);
  };

  const handleLabelClick = (index: number) => {
    if (index === turnedPages) return; // Already at this page
    setFlippingPage(index);
    setTurnedPages(index);
  };

  return (
    <>
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

import React, { useState } from "react";
import Page from "./page";
import { LeftCover, RightCover, Bindings } from "./constants";

const PAGES = [
  {
    front: (
      <div className="h-full w-full rounded-lg bg-stone-100 p-10 shadow-inner">
        <h1 className="text-3xl font-bold">A Guide to the Cosmos</h1>
        <p className="mt-4 text-lg">Page 1: The Cover</p>
        <p className="mt-20">Click the right side of the book to begin.</p>
      </div>
    ),
    back: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
        <h2 className="text-2xl font-semibold">Page 2: Introduction</h2>
        <p className="mt-4">
          In the beginning, there was... a lot of empty space.
        </p>
      </div>
    ),
  },
  {
    front: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
        <h2 className="text-2xl font-semibold">Page 3: The Stars</h2>
        <p className="mt-4">
          Stars are giant celestial bodies made mostly of hydrogen and helium.
        </p>
      </div>
    ),
    back: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
        <h2 className="text-2xl font-semibold">Page 4: The Planets</h2>
        <p className="mt-4">
          Our solar system has eight planets. Pluto is a dwarf planet.
        </p>
      </div>
    ),
  },
  {
    front: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
        <h2 className="text-2xl font-semibold">Page 5: The End?</h2>
        <p className="mt-4">The end of the book, but not the universe.</p>
      </div>
    ),
    back: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
        <h2 className="text-2xl font-semibold">The Back Cover</h2>
        <p className="mt-4">Click the left side to go back.</p>
      </div>
    ),
  },
  // Add as many pages as you like
];

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
            // The currently flipping page gets the highest z-index to fly over everything.
            zIndex = totalPages + 1;
          } else if (isFlipped) {
            // Flipped pages on the left stack up from the back.
            zIndex = index;
          } else {
            // Unflipped pages on the right stack up from the front.
            zIndex = totalPages - index;
          }

          return (
            <div
              key={index}
              className="absolute left-0 top-0 z-[100] h-full w-1/2"
              style={{
                // Position the pages in the right half of the container
                transform: "translateX(100%)",
                perspective: 3500,
                zIndex: zIndex,
              }}
            >
              <Page
                label="test"
                front={page.front}
                back={page.back}
                isFlipped={isFlipped}
                onFlipComplete={isFlipping ? handleFlipComplete : undefined}
                turnPageBackward={turnPageBackward}
                turnPageForward={turnPageForward}
                zIndex={zIndex}
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

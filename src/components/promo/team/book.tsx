import React, { useState } from "react";
import Page from "./page";

const PAGES = [
  {
    front: (
      <div className="h-full w-full bg-stone-100 p-10 shadow-inner">
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
    <div
      className="relative h-[723px] w-[1110px]"
    >
      {/* Container for all pages */}
      <div className="absolute h-full w-full">
        {/* The static left cover of the book */}
        <div className="absolute left-0 top-0 h-full w-1/2">
          <Left />
        </div>

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
              className="absolute left-0 top-0 h-full w-1/2"
              style={{
                // Position the pages in the right half of the container
                transform: "translateX(100%)",
                zIndex: zIndex,
                perspective: 3200,
              }}
            >
              <Page
                label="test"
                front={page.front}
                back={page.back}
                isFlipped={isFlipped}
                onFlipComplete={isFlipping ? handleFlipComplete : undefined}
              />
            </div>
          );
        })}

        {/* The static right cover of the book */}
        <div className="absolute right-0 top-0 h-full w-1/2">
          <Right />
        </div>
      </div>

      {/* Invisible Click Handlers */}
      <div
        className="absolute left-0 top-0 z-50 h-full w-1/2 cursor-pointer"
        onClick={turnPageBackward}
      />
      <div
        className="absolute right-0 top-0 z-50 h-full w-1/2 cursor-pointer"
        onClick={turnPageForward}
      />

      {/* Bindings on top of everything */}
      <div className="pointer-events-none absolute inset-0 z-[60] flex justify-center">
        <Bindings />
      </div>
    </div>
  );
}

function Left() {
  return (
    <svg
      width="555"
      height="723"
      viewBox="0 0 555 723"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_d_857_2218)">
        <path
          d="M4 22C4 10.9543 12.9543 2 24 2L543 2C547.418 2 551 5.58172 551 10V709C551 713.418 547.418 717 543 717H24C12.9543 717 4 708.046 4 697L4 22Z"
          fill="url(#paint0_linear_857_2218)"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_857_2218"
          x="0"
          y="0"
          width="555"
          height="723"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_857_2218"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_857_2218"
            result="shape"
          />
        </filter>
        <linearGradient
          id="paint0_linear_857_2218"
          x1="551"
          y1="359"
          x2="-496"
          y2="359"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8F57AD" />
          <stop offset="1" stopColor="#D19AEE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// using PNG for performance reasons
const Bindings = React.memo(function Bindings() {
  return (
    <div className="absolute flex flex-col items-center justify-center gap-8 pt-4">
      {Array.from({ length: 10 }).map((_, index) => (
        // DON'T USE NEXT IMAGE OR IT WILL "OPTIMIZE" THE PNG TOO SMALL
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src="/images/promo/team/binding.png"
          alt="Binding"
          width={60}
          draggable={false}
        />
      ))}
    </div>
  );
});

function Right() {
  return (
    <svg
      width="555"
      height="723"
      viewBox="0 0 555 723"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_d_857_2225)">
        <path
          d="M551 697C551 708.046 542.046 717 531 717L11.9999 717C7.58167 717 3.99994 713.418 3.99994 709L4.00001 10C4.00001 5.58174 7.58173 2.00002 12 2.00002L531 2.00006C542.046 2.00006 551 10.9543 551 22.0001L551 697Z"
          fill="url(#paint0_linear_857_2225)"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_857_2225"
          x="0"
          y="0"
          width="555"
          height="723"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_857_2225"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_857_2225"
            result="shape"
          />
        </filter>
        <linearGradient
          id="paint0_linear_857_2225"
          x1="3.99999"
          y1="360"
          x2="1051"
          y2="360"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8F57AD" />
          <stop offset="1" stopColor="#D19AEE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default Book;

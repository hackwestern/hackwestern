import Image from "next/image";
import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

// The landing hero, held still: its teal sky gradient with the noise tile on
// top, and the four mountain layers (src/components/promo/hero.tsx) anchored
// to the bottom. The sky stays the top half whatever shape the box is.
const SKY = [
  "linear-gradient(180deg,",
  "rgb(0, 52, 78) 0%,",
  "rgb(54, 122, 154) 40%,",
  "rgb(97, 158, 184) 66%,",
  "rgb(181, 217, 233) 100%)",
].join(" ");

const MOUNTAINS = [
  "/landing/promo/hero/mountain-4.webp",
  "/landing/promo/hero/mountain-3.webp",
  "/landing/promo/hero/mountain-2.webp",
  "/landing/promo/hero/mountain-1.webp",
] as const;

// The art is 2880 x 2550 and its peaks start 46% of the way down, so a
// full-width copy has its peaks 47.8% of the width above its bottom edge.
// Slide it down until the peaks sit halfway up the box (never up).
const PEAK_SHIFT = "translateY(max(0px, calc(47.8cqw - 50cqh)))";

/**
 * A box filled with the hero scene, children on top. Give it a height: it is
 * a size container, so `cqw` / `cqh` units inside it follow its own size.
 */
export function HeroScene({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden font-cossetteTexte [container-type:size]",
        className,
      )}
      style={{ background: SKY }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url("/landing/promo/sky-noise.webp")',
          backgroundSize: "640px 640px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 aspect-[2880/2550]"
        style={{ transform: PEAK_SHIFT }}
      >
        {MOUNTAINS.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={i === 0 || i === MOUNTAINS.length - 1}
            sizes="100vw"
            className="select-none object-cover"
            draggable={false}
          />
        ))}
      </div>
      <div className="relative z-10 flex size-full flex-col items-center">
        {children}
      </div>
    </div>
  );
}

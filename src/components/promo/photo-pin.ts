import type { CSSProperties } from "react";

/**
 * Helpers for desktop promo sections with a cover-fit photo background.
 * Sizes are designed at 1440 wide; wider screens grow sections at half the
 * rate of the width, and elements pinned to the photo stay on the same spot
 * of it.
 */

const DESIGN_WIDTH = 1440;

type CssVars = CSSProperties & Record<`--${string}`, string>;

/** A section's 1440 height, growing at half the rate of the width past 1440. */
export function halfRateHeight(px: number) {
  return `max(${px}px, calc(${px / 2}px + ${((px / DESIGN_WIDTH) * 50).toFixed(4)}vw))`;
}

export interface CoverPhoto {
  imageWidth: number;
  imageHeight: number;
  /** The section's height at the 1440 design width. */
  designHeight: number;
  /** Where the photo's box starts, in px from the section's top (negative = above). */
  top: number;
  /** How much taller the photo's box is than the section. */
  extraHeight: number;
  /** `object-position` on the vertical axis. */
  align: "top" | "center";
}

/**
 * The photo's rendered rect as CSS vars (--pw, --ph, --pl, --pt), mirroring
 * `object-fit: cover`. Set them on a section that is a size container
 * (`container-type: size`) so `cqw` / `cqh` measure the section.
 */
export function coverPhotoVars(photo: CoverPhoto): CssVars {
  const ratio = photo.imageWidth / photo.imageHeight;
  const boxHeight = `(100cqh + ${photo.extraHeight}px)`;
  return {
    "--pw": `max(100cqw, calc(${boxHeight} * ${ratio}))`,
    "--ph": `max(calc(${boxHeight}), calc(100cqw / ${ratio}))`,
    "--pl": "calc((100cqw - var(--pw)) / 2)",
    "--pt":
      photo.align === "top"
        ? `${photo.top}px`
        : `calc(${photo.top}px + (${boxHeight} - var(--ph)) / 2)`,
  };
}

/**
 * A point placed at (x, y) px in the 1440 design, as CSS vars --x / --y that
 * follow the same spot of the photo at any width.
 */
export function photoPoint(photo: CoverPhoto, x: number, y: number): CssVars {
  const ratio = photo.imageWidth / photo.imageHeight;
  const boxHeight = photo.designHeight + photo.extraHeight;
  const width = Math.max(DESIGN_WIDTH, boxHeight * ratio);
  const height = Math.max(boxHeight, DESIGN_WIDTH / ratio);
  const left = (DESIGN_WIDTH - width) / 2;
  const top =
    photo.align === "top" ? photo.top : photo.top + (boxHeight - height) / 2;
  const u = ((x - left) / width).toFixed(5);
  const v = ((y - top) / height).toFixed(5);
  return {
    "--x": `calc(var(--pl) + ${u} * var(--pw))`,
    "--y": `calc(var(--pt) + ${v} * var(--ph))`,
  };
}

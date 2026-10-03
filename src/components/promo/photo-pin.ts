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
  /** Where the photo's box starts at 1440, in px from the section's top
   *  (negative = above). The box ends at the section's bottom. */
  top: number;
  /** The same as a CSS length, when it grows with the width. */
  topCss?: string;
  /** `object-position` on the vertical axis. */
  align: "top" | "center";
}

/**
 * The photo's rendered height and top as CSS vars (--ph, --pt), mirroring
 * `object-fit: cover`. Set them on a section that is a size container
 * (`container-type: size`) so `cqw` / `cqh` measure the section.
 */
export function coverPhotoVars(photo: CoverPhoto): CssVars {
  const ratio = photo.imageWidth / photo.imageHeight;
  const top = photo.topCss ?? `${photo.top}px`;
  const boxHeight = `(100cqh - ${top})`;
  return {
    "--ph": `max(calc(${boxHeight}), calc(100cqw / ${ratio}))`,
    "--pt":
      photo.align === "top"
        ? top
        : `calc(${top} + (${boxHeight} - var(--ph)) / 2)`,
  };
}

/**
 * A point placed at (x, y) px in the 1440 design, as CSS vars --x / --y.
 * --x keeps its place in the centred 1440 column, scaled with --ui-scale like
 * the projects stage; --y follows the same spot of the photo at any width.
 */
export function photoPoint(photo: CoverPhoto, x: number, y: number): CssVars {
  const ratio = photo.imageWidth / photo.imageHeight;
  const boxHeight = photo.designHeight - photo.top;
  const height = Math.max(boxHeight, DESIGN_WIDTH / ratio);
  const top =
    photo.align === "top" ? photo.top : photo.top + (boxHeight - height) / 2;
  const v = ((y - top) / height).toFixed(5);
  return {
    "--x": `calc(50% + ${x - DESIGN_WIDTH / 2}px * var(--ui-scale, 1))`,
    "--y": `calc(var(--pt) + ${v} * var(--ph))`,
  };
}

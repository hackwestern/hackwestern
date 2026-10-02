import type { CSSProperties } from "react";

const DESIGN_WIDTH = 1440;
const DESIGN_STRIP_WIDTH = 1890;

const OVERHANG = DESIGN_STRIP_WIDTH / DESIGN_WIDTH;

const THICKNESS = 30;

/**
 * Desktop (lg+) geometry of a strip, in px: its box height and where its
 * centre line meets the left and right edges of the box. Constant at every
 * screen width, so a neighbouring section can tuck its edge under the tape.
 */
export function filmStripEdge(rotate: number) {
  const radians = (rotate * Math.PI) / 180;
  const tilt = Math.abs(Math.sin(radians)) * OVERHANG * 100;
  const rise = DESIGN_WIDTH * Math.tan(radians);
  const height = Number(tilt.toFixed(2)) * (DESIGN_WIDTH / 100) + THICKNESS;
  return { height, left: height / 2 - rise / 2, right: height / 2 + rise / 2 };
}

export function FilmStrip({
  rotate = 0,
  className = "",
}: {
  rotate?: number;
  className?: string;
}) {
  const radians = (rotate * Math.PI) / 180;
  const tilt = Math.abs(Math.sin(radians)) * OVERHANG * 100;
  // Desktop keeps the strip's rise across the screen at its 1440 design value,
  // so wider screens get a flatter angle instead of a taller strip.
  const rise = DESIGN_WIDTH * Math.tan(radians);

  return (
    <div
      aria-hidden
      className={`relative h-[calc(var(--tilt)*1vw+var(--thickness))] w-full overflow-hidden [container-type:inline-size] lg:h-[calc(var(--tilt)*14.4px+var(--thickness))] ${className}`}
      style={
        {
          "--tilt": tilt.toFixed(2),
          "--thickness": `${THICKNESS}px`,
          "--angle": `${rotate}deg`,
          "--rise": `${rise.toFixed(2)}px`,
        } as CSSProperties
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/promo/film-strip.svg"
        alt=""
        className="absolute left-1/2 top-1/2 max-w-none [transform:translate(-50%,-50%)_rotate(var(--angle))] lg:[transform:translate(-50%,-50%)_rotate(atan2(var(--rise),100cqw))]"
        style={{
          width: `${OVERHANG * 100}%`,
          height: `${THICKNESS}px`,
        }}
      />
    </div>
  );
}

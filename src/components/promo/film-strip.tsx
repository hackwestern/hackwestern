const DESIGN_WIDTH = 1440;
const DESIGN_STRIP_WIDTH = 1890;

const OVERHANG = DESIGN_STRIP_WIDTH / DESIGN_WIDTH;

const THICKNESS = 30;

export function FilmStrip({ rotate = 0 }: { rotate?: number }) {
  const tilt = Math.abs(Math.sin((rotate * Math.PI) / 180)) * OVERHANG * 100;

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height: `calc(${tilt.toFixed(2)}vw + ${THICKNESS}px)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/promo/film-strip.svg"
        alt=""
        className="absolute left-1/2 top-1/2 max-w-none"
        style={{
          width: `${OVERHANG * 100}%`,
          height: `${THICKNESS}px`,
          transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        }}
      />
    </div>
  );
}

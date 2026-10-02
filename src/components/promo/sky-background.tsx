import React from "react";

const DESIGN_WIDTH = 1440;
const DESIGN_SKY_HEIGHT = 12105;
const DESIGN_PAGE_HEIGHT = 5897;

const SKY_TO_PAGE_RATIO = DESIGN_SKY_HEIGHT / DESIGN_PAGE_HEIGHT;

const NOISE_TILE_RATIO = 921.6 / DESIGN_WIDTH;

const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SKY_GRADIENT = [
  "linear-gradient(178.45246986254318deg,",
  "rgb(0, 52, 78) 0.16018%,",
  "rgb(97, 158, 184) 8.4387%,",
  "rgb(181, 217, 233) 12.198%,",
  "rgb(117, 198, 199) 23.93%,",
  "rgb(36, 140, 185) 38.521%,",
  "rgb(164, 206, 224) 59.872%,",
  "rgb(101, 187, 210) 75.81%,",
  "rgb(29, 150, 202) 90.855%,",
  "rgb(71, 132, 158) 99.402%)",
].join(" ");

export function SkyBackground() {
  const skyRef = React.useRef<HTMLDivElement>(null);
  const noiseRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sky = skyRef.current;
    const noise = noiseRef.current;
    if (!sky || !noise) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let reduceMotion = motionQuery.matches;
    let frame = 0;
    let pageTravel = 0;
    let skyTravel = 0;
    let holds: { start: number; end: number }[] = [];

    function measure() {
      if (!sky || !noise) return;

      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      const viewport = window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      // Reduced motion collapses the sky to one screen so the whole gradient
      // is visible at rest, rather than freezing on its top sliver.
      const skyHeight = reduceMotion
        ? viewport
        : Math.max(pageHeight * SKY_TO_PAGE_RATIO, viewport);

      // A `data-sky-hold` element is a sticky scene whose bottom pins to the
      // viewport bottom. While it is pinned the sky stays still with it.
      holds = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sky-hold]"),
        (scene) => {
          const section = scene.parentElement ?? scene;
          const top = section.getBoundingClientRect().top + window.scrollY;
          return {
            start: top + Math.max(scene.offsetHeight - viewport, 0),
            end: top + section.offsetHeight - viewport,
          };
        },
      ).filter((hold) => hold.end > hold.start);
      const heldTravel = holds.reduce(
        (total, hold) => total + hold.end - hold.start,
        0,
      );

      pageTravel = Math.max(pageHeight - viewport - heldTravel, 0);
      skyTravel = Math.max(skyHeight - viewport, 0);

      sky.style.height = `${skyHeight}px`;

      const tile = window.innerWidth * NOISE_TILE_RATIO;
      noise.style.backgroundSize = `${tile}px ${tile}px`;

      render();
    }

    function render() {
      frame = 0;
      if (!sky) return;

      // Clamped both ends: iOS rubber-banding reports scrollY outside [0, max],
      // which would slide the sky off its container and expose the page canvas.
      const held = holds.reduce(
        (total, hold) =>
          total +
          Math.min(
            Math.max(window.scrollY - hold.start, 0),
            hold.end - hold.start,
          ),
        0,
      );
      const progress =
        pageTravel > 0
          ? Math.min(Math.max((window.scrollY - held) / pageTravel, 0), 1)
          : 0;

      sky.style.transform = `translate3d(0, ${-progress * skyTravel}px, 0)`;
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(render);
    }

    function onMotionChange() {
      reduceMotion = motionQuery.matches;
      measure();
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    motionQuery.addEventListener("change", onMotionChange);

    // Sections mount and images load after first paint; the page gets taller
    // and the mapping has to be recomputed or the sky drifts out of sync.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      motionQuery.removeEventListener("change", onMotionChange);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Mobile: one fixed image, no parallax */}
      <div className="absolute inset-0 block md:hidden">
        {/* md:hidden doesn't stop an <img> downloading, so from md up the
            source swaps in a 1px blank and the photo is never fetched */}
        <picture>
          <source media="(min-width: 768px)" srcSet={BLANK_PIXEL} />
          <img
            src="/landing/promo/mobile-bg.webp"
            alt=""
            className="h-full w-full object-cover"
          />
        </picture>
      </div>

      {/* Desktop: existing parallax sky */}
      <div
        ref={skyRef}
        className="absolute left-0 top-0 hidden h-screen w-full will-change-transform md:block"
        style={{ backgroundImage: SKY_GRADIENT }}
      >
        <div
          ref={noiseRef}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url("/landing/promo/sky-noise.png")',
            backgroundPosition: "top left",
          }}
        />
      </div>
    </div>
  );
}

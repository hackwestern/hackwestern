import dynamic from "next/dynamic";
import Image from "next/image";
import * as React from "react";
import {
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Window } from "~/components/internals/window";
import {
  closestProgress,
  coverRect,
  type CoverRect,
  FOREGROUND_PARALLAX,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  PIN_DATA,
  samplePath,
  type StoryPinData,
  WAYPOINTS,
  type Waypoint,
} from "./hero-path";
import { PromoNavbar } from "./navbar";

const PathEditor = dynamic(() => import("./path-editor"), { ssr: false });

const HOLD_SCREENS = 1.5;
// Mobile skips the extended "hold" almost entirely — the desktop
// value (plus SCENE_HEIGHT's own ~100svh) makes the whole hero a
// multi-screen scroll, which reads as excessively long on a small
// viewport. At ~0, total section height collapses to roughly
// SCENE_HEIGHT alone (one normal screen), so the section behaves
// like an ordinary hero rather than an extended scroll-jacked one.
const HOLD_SCREENS_MOBILE = 0;
// Matches the project's existing `lg` Tailwind breakpoint (see
// tailwind.config.ts) so "mobile" here means the same thing as
// elsewhere in the codebase (e.g. FilmStrip's `hidden lg:block`).
const MOBILE_BREAKPOINT_PX = 1024;
const SCENE_HEIGHT = `max(100svh, ${(IMAGE_HEIGHT / IMAGE_WIDTH) * 100}vw)`;
const BLEED = 240;
// With HOLD_SCREENS_MOBILE at ~0, there's no scroll buffer left
// for the full 240px bleed to sit comfortably within before the
// next section begins — on mobile it visibly collides with
// whatever follows the hero instead. Shrinking it (rather than
// removing it outright) still smooths the sticky-release edge
// without spilling into the next section.
const BLEED_MOBILE = 48;
const DOT = 3;
const PATH_SAMPLES = 200;
const PIN_ASPECT = 2.5;
const PIN_TIP = 0.97;
const WINDOW_GAP = 16;
const WINDOW_DESIGN_WIDTH = 1512;
const WINDOW_MIN_SCALE = 0.8;
const WINDOW_MAX_SCALE = 1.15;
const WINDOW_EDGE_MARGIN = 24;
const WINDOW_ANCHOR_SHIFT = { left: 0.1, center: 0.5, right: 0.9 } as const;

const MOUNTAIN_LAYERS = [
  { src: "/landing/promo/hero/mountain-4.webp", offset: 16 },
  { src: "/landing/promo/hero/mountain-3.webp", offset: 16 },
  { src: "/landing/promo/hero/mountain-2.webp", offset: 24 },
  { src: "/landing/promo/hero/mountain-1.webp", offset: FOREGROUND_PARALLAX },
] as const;

const BAYER = [
  [0, 128, 32, 160, 8, 136, 40, 168],
  [192, 64, 224, 96, 200, 72, 232, 104],
  [48, 176, 16, 144, 56, 184, 24, 152],
  [240, 112, 208, 80, 248, 120, 216, 88],
  [12, 140, 44, 172, 4, 132, 36, 164],
  [204, 76, 236, 108, 196, 68, 228, 100],
  [60, 188, 28, 156, 52, 180, 20, 148],
  [252, 124, 220, 92, 244, 116, 212, 84],
] as const;

// Tracks whether the viewport is below `breakpointPx`, via a
// matchMedia listener rather than a one-off window.innerWidth
// check — this reacts to resize/orientation changes live, not
// just at mount.
function useIsMobile(breakpointPx: number) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);

    const update = () => setIsMobile(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}

function useCoverRect(ref: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = React.useState<CoverRect | null>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () =>
      setRect(coverRect(element.clientWidth, element.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return rect;
}

function PathCanvas({
  progress,
  waypoints,
  bleed,
}: {
  progress: MotionValue<number>;
  waypoints: readonly Waypoint[];
  bleed: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const waypointsRef = React.useRef(waypoints);
  const invalidateRef = React.useRef<() => void>(() => undefined);
  const reduceMotion = useReducedMotion() ?? false;

  React.useEffect(() => {
    waypointsRef.current = waypoints;
    invalidateRef.current();
  }, [waypoints]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let currentProgress = progress.get();
    let mask: Float32Array | null = null;
    let maskProgress = -1;
    let rect = coverRect(1, 1);
    let frame = 0;
    let visible = false;
    let image = context.createImageData(1, 1);

    const resize = () => {
      const scene = canvas.parentElement;
      const sceneWidth = scene?.clientWidth ?? window.innerWidth;
      const sceneHeight = scene?.clientHeight ?? window.innerHeight;
      rect = coverRect(sceneWidth, sceneHeight);
      canvas.width = Math.ceil(sceneWidth / DOT);
      canvas.height = Math.ceil((sceneHeight + bleed) / DOT);
      canvas.style.height = `${sceneHeight + bleed}px`;
      image = context.createImageData(canvas.width, canvas.height);
      mask = null;
      schedule();
    };

    const buildMask = (value: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const next = new Float32Array(width * height);
      const sampleCount = Math.floor(PATH_SAMPLES * value);

      for (let step = 0; value > 0 && step <= sampleCount; step++) {
        const point = samplePath(
          waypointsRef.current,
          Math.min(step / PATH_SAMPLES, 1),
        );
        const cx = Math.round((rect.left + point.x * rect.width) / DOT);
        const cy = Math.round((rect.top + point.y * rect.height) / DOT);
        const radius = Math.ceil((point.w * rect.scale) / (DOT * 2));
        const radiusSquared = radius * radius;

        for (let dy = -radius; dy <= radius; dy++) {
          const row = cy + dy;
          if (row < 0 || row >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const distance = dx * dx + dy * dy;
            const column = cx + dx;
            if (distance > radiusSquared || column < 0 || column >= width) {
              continue;
            }
            const index = row * width + column;
            next[index] = Math.max(
              next[index] ?? 0,
              1 - distance / radiusSquared,
            );
          }
        }
      }

      mask = next;
      maskProgress = value;
    };

    const render = (time: number) => {
      const value = Math.round(currentProgress * 1000) / 1000;
      if (!mask || value !== maskProgress) buildMask(value);

      const data = image.data;
      data.fill(0);
      const breathe = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time / 700);

      for (let y = 0; y < canvas.height; y++) {
        const row = BAYER[y & 7]!;
        for (let x = 0; x < canvas.width; x++) {
          const proximity = mask?.[y * canvas.width + x] ?? 0;
          if (row[x & 7]! < 48 * proximity * breathe) {
            const index = (y * canvas.width + x) * 4;
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = 255;
          }
        }
      }

      context.putImageData(image, 0, 0);
    };

    const tick = (time: number) => {
      frame = 0;
      render(time);
      if (visible && !reduceMotion) frame = requestAnimationFrame(tick);
    };

    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(tick);
    }

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    invalidateRef.current = () => {
      mask = null;
      schedule();
    };
    resize();
    const unsubscribe = progress.on("change", (value) => {
      currentProgress = value;
      if (reduceMotion) schedule();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) schedule();
      else stop();
    });
    observer.observe(canvas);
    window.addEventListener("resize", resize);

    return () => {
      invalidateRef.current = () => undefined;
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      stop();
    };
  }, [progress, reduceMotion, bleed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 w-full [image-rendering:pixelated]"
    />
  );
}

function MountainLayer({
  src,
  offset,
  pan,
  priority,
}: {
  src: string;
  offset: number;
  pan: MotionValue<number>;
  priority: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const y = useTransform(pan, [0, 1], [0, reduceMotion ? 0 : offset]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ y }}
    >
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
    </motion.div>
  );
}

function MountainScene({ pan }: { pan: MotionValue<number> }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {MOUNTAIN_LAYERS.map((layer, index) => (
        <MountainLayer
          key={layer.src}
          src={layer.src}
          offset={layer.offset}
          pan={pan}
          priority={index === 0 || index === MOUNTAIN_LAYERS.length - 1}
        />
      ))}
    </div>
  );
}

function StoryPin({
  pin,
  rect,
  waypoints,
  pathProgress,
  interactive,
}: {
  pin: StoryPinData;
  rect: CoverRect;
  waypoints: readonly Waypoint[];
  pathProgress: MotionValue<number>;
  interactive: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  const pinWidth = pin.size * rect.scale;
  const pinHeight = pinWidth * PIN_ASPECT;
  const windowScale = Math.min(
    WINDOW_MAX_SCALE,
    Math.max(WINDOW_MIN_SCALE, rect.width / WINDOW_DESIGN_WIDTH),
  );
  const left = rect.left + pin.x * rect.width;
  const top = rect.top + pin.y * rect.height;
  const windowWidth = Math.round(pin.windowWidth * windowScale);
  const sceneWidth = rect.width + 2 * rect.left;
  const windowLeft = Math.min(
    Math.max(
      left - windowWidth * WINDOW_ANCHOR_SHIFT[pin.anchor ?? "center"],
      WINDOW_EDGE_MARGIN,
    ),
    sceneWidth - windowWidth - WINDOW_EDGE_MARGIN,
  );
  const start = closestProgress(waypoints, pin.x, pin.y);
  const reveal = [Math.max(0, start - 0.04), start];
  const opacity = useTransform(pathProgress, reveal, [0, 1]);
  const scale = useTransform(pathProgress, reveal, [0.88, 1]);
  const pointerEvents = useTransform(opacity, (value) =>
    interactive && value > 0.5 ? "auto" : "none",
  );

  return (
    <>
      <motion.button
        type="button"
        aria-label={open ? `Hide "${pin.title}"` : `Show "${pin.title}"`}
        onClick={() => setOpen((value) => !value)}
        className="absolute z-20 cursor-pointer"
        style={{
          left,
          top,
          x: "-50%",
          y: `-${PIN_TIP * 100}%`,
          opacity,
          scale,
          pointerEvents,
        }}
      >
        <Image
          src="/landing/promo/pin.svg"
          alt=""
          width={pinWidth}
          height={pinHeight}
        />
      </motion.button>

      {open && (
        <div
          className="absolute z-30"
          style={{
            left: windowLeft,
            top,
            transform: `translateY(calc(-100% - ${
              pinHeight * PIN_TIP + WINDOW_GAP * windowScale
            }px))`,
          }}
        >
          <motion.div
            style={{
              opacity,
              scale,
              pointerEvents,
              transformOrigin: `${left - windowLeft}px 100%`,
            }}
          >
            <Window
              title="You have a message"
              width={windowWidth}
              autoHeight
              draggable={false}
              onClose={() => setOpen(false)}
            >
              <div className="flex flex-col gap-2 py-1 text-left">
                <h2 className="font-cossetteTexte text-[clamp(18px,1.59vw,26px)] font-bold leading-tight tracking-[-0.02em] text-[#111]">
                  {pin.title}
                </h2>
                <p className="font-figtree text-[clamp(13px,1.06vw,17px)] leading-normal text-[#555]">
                  {pin.body}
                </p>
              </div>
            </Window>
          </motion.div>
        </div>
      )}
    </>
  );
}

function ForegroundStory({
  pan,
  pathProgress,
  editing,
  bleed,
}: {
  pan: MotionValue<number>;
  pathProgress: MotionValue<number>;
  editing: boolean;
  bleed: number;
}) {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const rect = useCoverRect(groupRef);
  const reduceMotion = useReducedMotion();
  const y = useTransform(
    pan,
    [0, 1],
    [0, reduceMotion ? 0 : FOREGROUND_PARALLAX],
  );
  const [waypoints, setWaypoints] = React.useState(WAYPOINTS);
  const [pins, setPins] = React.useState(PIN_DATA);
  const fullProgress = useTransform(pathProgress, () => 1);
  const progress = editing ? fullProgress : pathProgress;

  return (
    <motion.div
      ref={groupRef}
      className={editing ? "absolute inset-0 z-30" : "absolute inset-0 z-10"}
      style={{ y }}
    >
      <PathCanvas progress={progress} waypoints={waypoints} bleed={bleed} />
      {rect &&
        pins.map((pin) => (
          <StoryPin
            key={pin.title}
            pin={pin}
            rect={rect}
            waypoints={waypoints}
            pathProgress={progress}
            interactive={!editing}
          />
        ))}
      {editing && (
        <PathEditor
          waypoints={waypoints}
          pins={pins}
          onWaypointsChange={setWaypoints}
          onPinsChange={setPins}
        />
      )}
    </motion.div>
  );
}

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const [snapProgress, setSnapProgress] = React.useState(0.2);
  const [editing, setEditing] = React.useState(false);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);
  const holdScreens = isMobile ? HOLD_SCREENS_MOBILE : HOLD_SCREENS;
  const bleed = isMobile ? BLEED_MOBILE : BLEED;
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const pan = useTransform(
    scrollYProgress,
    [0, Math.max(snapProgress, 0.001)],
    [0, 1],
  );
  const pathProgress = useTransform(
    scrollYProgress,
    [snapProgress, 0.9],
    [0, 1],
  );

  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).has("pathEditor")
    ) {
      setEditing(true);
    }
  }, []);

  React.useEffect(() => {
    const measure = () => {
      const sceneHeight = sceneRef.current?.clientHeight ?? window.innerHeight;
      const viewportHeight = window.innerHeight;
      const totalScroll = sceneHeight + viewportHeight * (holdScreens - 1);

      setSnapProgress(
        totalScroll > 0
          ? Math.max(sceneHeight - viewportHeight, 0) / totalScroll
          : 0,
      );
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [holdScreens]);

  return (
    <>
      <section
        ref={sectionRef}
        id="hero"
        className="relative"
        style={{ height: `calc(${SCENE_HEIGHT} + ${holdScreens * 100}svh)` }}
      >
        <div
          ref={sceneRef}
          data-sky-hold
          className="sticky translate-y-[20px] overflow-hidden"
          style={{
            height: SCENE_HEIGHT,
            top: `calc(100svh - ${SCENE_HEIGHT})`,
          }}
        >
          {/* placeholder until links added */}
          <MountainScene pan={pan} />
          <PromoNavbar className="relative z-50 ml-[10%] mr-[10%]" />

          <div className="absolute left-[clamp(24px,11.11vw,160px)] top-[20%] z-20 flex max-w-[calc(100%_-_48px)] flex-col items-start gap-12">
            <div className="flex flex-col items-start gap-[30px] font-cossetteTexte">
              <div className="flex flex-wrap items-center gap-[14px] text-[clamp(16px,1.67vw,24px)] font-normal leading-normal tracking-[-0.03em] text-[#d0d6dd]">
                <p className="whitespace-nowrap">November 20 - 22, 2026</p>
                <span
                  aria-hidden
                  className="size-[6px] shrink-0 rounded-full bg-[#d0d6dd]"
                />
                <p className="whitespace-nowrap">In-person event</p>
              </div>

              <div className="flex flex-col items-start gap-3">
                <h1 className="whitespace-nowrap text-[clamp(40px,4.45vw,64px)] font-bold leading-[0.82] tracking-[-0.035em] text-[#f5f9ff] [text-shadow:3px_3px_0_rgba(35,83,108,0.55)]">
                  Hack Western 13
                </h1>
                <p className="text-[clamp(24px,2.13vw,30.72px)] font-normal leading-normal tracking-[-0.02em] text-highlight">
                  Discover the unknown
                </p>
              </div>
            </div>

            <button
              type="button"
              className="cursor-pixel-hover overflow-hidden rounded-full border border-[#969696] bg-[#cacaca] px-6 py-3 font-figtree text-base font-semibold leading-none text-[#313a45] shadow-[0_8px_12px_rgba(31,48,73,0.24),inset_0_-14px_10px_rgba(255,255,255,0.4)] transition-transform duration-100 active:translate-y-px active:scale-[0.98]"
            >
              Sign up for updates
            </button>
          </div>
          <ForegroundStory
            key={editing ? "editing" : "live"}
            pan={pan}
            pathProgress={pathProgress}
            editing={editing}
            bleed={bleed}
          />
        </div>
      </section>
    </>
  );
}

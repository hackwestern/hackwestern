import Image from "next/image";
import * as React from "react";
import {
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

const HOLD_SCREENS = 1.5;
const MACBOOK_PRO_PANEL_WIDTH = 3024;
const RETINA_SCALE = 2;
// Chrome lays out a 3024px Retina panel in 1512 CSS pixels. The live
// scene width still comes from the browser, so a 2560px Air resolves to
// 1280 CSS pixels and scales from this reference automatically.
const DESIGN_WIDTH = MACBOOK_PRO_PANEL_WIDTH / RETINA_SCALE;
const MIN_PATH_SCALE = 0.48;
const PATH_SHIFT = 100;
const PATH_SHIFT_CSS = "clamp(48px, 6.614vw, 100px)";
const BLEED = 240;
const DOT = 3;
const FOREGROUND_PARALLAX = 56;
const PATH_ROTATION = (-1 * Math.PI) / 180;
const PATH_ASPECT_RATIO = 1440 / 1290;
const PATH_PIVOT = { x: -0.12, y: 0.88 } as const;

const MOUNTAIN_LAYERS = [
  { src: "/landing/promo/hero/mountain-4.png", offset: 8 },
  { src: "/landing/promo/hero/mountain-3.png", offset: 20 },
  { src: "/landing/promo/hero/mountain-2.png", offset: 36 },
  { src: "/landing/promo/hero/mountain-1.png", offset: FOREGROUND_PARALLAX },
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

const WAYPOINTS = [
  { x: 1.05, y: 1.01, w: 190 },
  { x: 0.91, y: 0.98, w: 170 },
  { x: 0.79, y: 0.96, w: 150 },
  { x: 0.68, y: 0.94, w: 135 },
  { x: 0.57, y: 0.92, w: 120 },
  { x: 0.45, y: 0.9, w: 105 },
  { x: 0.33, y: 0.89, w: 90 },
  { x: 0.18, y: 0.89, w: 78 },
  { x: 0.02, y: 0.89, w: 70 },
  { x: -0.12, y: 0.88, w: 65 },
  { x: 0.03, y: 0.84, w: 62 },
  { x: 0.18, y: 0.835, w: 58 },
  { x: 0.35, y: 0.825, w: 52 },
  { x: 0.48, y: 0.8, w: 44 },
  { x: 0.57, y: 0.775, w: 36 },
  { x: 0.64, y: 0.75, w: 28 },
] as const;

const PIN_DATA = [
  {
    x: 0.982,
    y: 1.01,
    w: 64,
    title: "Create. Collaborate. Innovate.",
    body: "Collaborate in teams of up to four to create tech projects, while participating in workshops, learning from mentors, competing for prizes, and meeting like-minded hackers.",
    windowWidth: 500,
  },
  {
    x: 0.03,
    y: 0.87,
    w: 22,
    anchor: "left",
    title: "It's on us",
    body: "We cover food, travel, and lodging so you can focus on bringing your ideas to life!",
    windowWidth: 400,
  },
  {
    x: 0.48,
    y: 0.8,
    w: 18,
    title: "Build something unexpected",
    body: "Spend the weekend exploring an idea, learning new tools, and sharing what you made.",
    windowWidth: 320,
  },
] as const;

function catmullRom(
  before: number,
  from: number,
  to: number,
  after: number,
  t: number,
) {
  return (
    0.5 *
    (2 * from +
      (-before + to) * t +
      (2 * before - 5 * from + 4 * to - after) * t ** 2 +
      (-before + 3 * from - 3 * to + after) * t ** 3)
  );
}

function rotatePathPoint(x: number, y: number) {
  const dx = (x - PATH_PIVOT.x) * PATH_ASPECT_RATIO;
  const dy = y - PATH_PIVOT.y;
  const cosine = Math.cos(PATH_ROTATION);
  const sine = Math.sin(PATH_ROTATION);

  return {
    x: PATH_PIVOT.x + (dx * cosine - dy * sine) / PATH_ASPECT_RATIO,
    y: PATH_PIVOT.y + dx * sine + dy * cosine,
  };
}

function samplePath(t: number) {
  const last = WAYPOINTS.length - 1;
  const segment = Math.min(last - 1, Math.floor(t * last));
  const local = t * last - segment;
  const before = WAYPOINTS[Math.max(0, segment - 1)]!;
  const from = WAYPOINTS[segment]!;
  const to = WAYPOINTS[segment + 1]!;
  const after = WAYPOINTS[Math.min(last, segment + 2)]!;

  const point = rotatePathPoint(
    catmullRom(before.x, from.x, to.x, after.x, local),
    catmullRom(before.y, from.y, to.y, after.y, local),
  );

  return {
    ...point,
    w: Math.max(2, catmullRom(before.w, from.w, to.w, after.w, local)),
  };
}

function revealAt(x: number, y: number) {
  let closest = Infinity;
  let progress = 0;

  for (let step = 0; step <= 300; step++) {
    const t = step / 300;
    const point = samplePath(t);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < closest) {
      closest = distance;
      progress = t;
    }
  }

  return progress;
}

function PathCanvas({ progress }: { progress: MotionValue<number> }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let currentProgress = progress.get();
    let mask: Float32Array | null = null;
    let maskProgress = -1;
    let sceneHeight = 0;
    let pathScale = 1;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const scene = canvas.parentElement;
      sceneHeight = scene?.clientHeight ?? window.innerHeight;
      const sceneWidth = scene?.clientWidth ?? window.innerWidth;
      pathScale = Math.max(
        MIN_PATH_SCALE,
        Math.min(sceneWidth / DESIGN_WIDTH, 1),
      );
      canvas.width = Math.ceil(sceneWidth / DOT);
      canvas.height = Math.ceil((sceneHeight + BLEED) / DOT);
      canvas.style.height = `${sceneHeight + BLEED}px`;
      mask = null;
    };

    const buildMask = (value: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const next = new Float32Array(width * height);
      const sampleCount = Math.floor(160 * value);

      for (let step = 0; value > 0 && step <= sampleCount; step++) {
        const point = samplePath(Math.min(step / 160, 1));
        const cx = Math.round(point.x * width);
        const cy = Math.round(
          (point.y * sceneHeight - PATH_SHIFT * pathScale) / DOT,
        );
        const radius = Math.ceil((point.w * pathScale) / (DOT * 2));
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

    const draw = (time: number) => {
      if (visible) {
        const value = Math.round(currentProgress * 1000) / 1000;
        if (!mask || value !== maskProgress) buildMask(value);

        const image = context.createImageData(canvas.width, canvas.height);
        const breathe = 0.82 + 0.18 * Math.sin(time / 700);

        for (let y = 0; y < canvas.height; y++) {
          const row = BAYER[y & 7]!;
          for (let x = 0; x < canvas.width; x++) {
            const proximity = mask?.[y * canvas.width + x] ?? 0;
            if (row[x & 7]! < 48 * proximity * breathe) {
              const index = (y * canvas.width + x) * 4;
              image.data[index] = 255;
              image.data[index + 1] = 255;
              image.data[index + 2] = 255;
              image.data[index + 3] = 255;
            }
          }
        }

        context.putImageData(image, 0, 0);
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    const unsubscribe = progress.on("change", (value) => {
      currentProgress = value;
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 w-full [image-rendering:pixelated]"
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
  pathProgress,
}: {
  pin: (typeof PIN_DATA)[number];
  pathProgress: MotionValue<number>;
}) {
  const pinWidth = "w" in pin ? pin.w : 36;
  const pinHeight = pinWidth * 2.5;
  const position = rotatePathPoint(pin.x, pin.y);
  const top = `calc(${position.y * 100}% - ${PATH_SHIFT_CSS})`;
  const start = revealAt(position.x, position.y);
  const opacity = useTransform(
    pathProgress,
    [Math.max(0, start - 0.04), start],
    [0, 1],
  );
  const scale = useTransform(
    pathProgress,
    [Math.max(0, start - 0.04), start],
    [0.88, 1],
  );

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-20"
      style={{
        left: `${position.x * 100}%`,
        top,
        x: "-50%",
        y: "-97%",
        opacity,
        scale,
      }}
    >
      <Image
        src="/landing/promo/pin.svg"
        alt=""
        width={pinWidth}
        height={pinHeight}
      />
    </motion.div>
  );
}

function MountainDitherFade() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new window.Image();
    image.src = "/landing/promo/hero/mountain-1.png";

    const draw = () => {
      const width = window.innerWidth;
      const height = 120;
      const scale = width / image.naturalWidth;
      const sourceHeight = Math.min(
        image.naturalHeight,
        height / Math.max(scale, 0.001),
      );

      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(
        image,
        0,
        image.naturalHeight - sourceHeight,
        image.naturalWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );

      for (let y = 0; y < height; y += DOT) {
        for (let x = 0; x < width; x += DOT) {
          if (
            y / height >
            BAYER[(y / DOT) & 7]![Math.floor(x / DOT) & 7]! / 256
          ) {
            context.clearRect(x, y, DOT, DOT);
          }
        }
      }
    };

    image.addEventListener("load", draw);
    window.addEventListener("resize", draw);
    if (image.complete) draw();

    return () => {
      image.removeEventListener("load", draw);
      window.removeEventListener("resize", draw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="relative -mb-[60px] block h-[120px] w-full [image-rendering:pixelated]"
    />
  );
}

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const [snapProgress, setSnapProgress] = React.useState(0.2);
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
    const measure = () => {
      const sceneHeight = sceneRef.current?.clientHeight ?? window.innerHeight;
      const viewportHeight = window.innerHeight;
      const totalScroll = sceneHeight + viewportHeight * (HOLD_SCREENS - 1);

      setSnapProgress(
        totalScroll > 0
          ? Math.max(sceneHeight - viewportHeight, 0) / totalScroll
          : 0,
      );
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        id="hero"
        className="relative"
        style={{
          height: `calc(max(100svh, 89.583vw) + ${HOLD_SCREENS * 100}svh)`,
        }}
      >
        <div
          ref={sceneRef}
          className="sticky h-[max(100svh,89.583vw)] overflow-hidden"
          style={{ top: "calc(100svh - max(100svh, 89.583vw))" }}
        >
          <MountainScene pan={pan} />
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
          <PathCanvas progress={pathProgress} />
          {PIN_DATA.map((pin) => (
            <StoryPin key={pin.title} pin={pin} pathProgress={pathProgress} />
          ))}
        </div>
      </section>
      <MountainDitherFade />
    </>
  );
}

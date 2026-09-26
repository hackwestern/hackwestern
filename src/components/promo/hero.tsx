import Image from "next/image";
import * as React from "react";
import {
  motion,
  type MotionValue,
  useMotionTemplate,
  useScroll,
  useTransform,
} from "framer-motion";
import { Window } from "~/components/internals/window";

const PHOTO = "/landing/promo/hero-photo.jpg";
const IMG_W = 4152;
const IMG_H = 5536;
const PAN_END = 0.45;
const PATH_SHIFT = 100;
const BLEED = 240;
const DOT = 3;

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
  { x: 1.25, y: 1.25, w: 300 },
  { x: 0.62, y: 0.95, w: 100 },
  { x: 0.28, y: 0.88, w: 60 },
  { x: 0.06, y: 0.86, w: 40 },
  { x: -0.05, y: 0.88, w: 20 },
  { x: 0.2, y: 0.8, w: 24 },
  { x: 0.35, y: 0.77, w: 20 },
  { x: 0.5, y: 0.69, w: 4 },
] as const;

const PIN_DATA = [
  {
    x: 0.82,
    y: 0.93,
    w: 44,
    title: "Create. Collaborate. Innovate.",
    body: "Collaborate in teams of up to four to create tech projects, while participating in workshops, learning from mentors, competing for prizes, and meeting like-minded hackers.",
    windowWidth: 500,
  },
  {
    x: 0.09,
    y: 0.82,
    anchor: "left",
    title: "It's on us",
    body: "We cover food, travel, and lodging so you can focus on bringing your ideas to life!",
    windowWidth: 400,
  },
  {
    x: 0.47,
    y: 0.7,
    w: 24,
    title: "Build something unexpected",
    body: "Spend the weekend exploring an idea, learning new tools, and sharing what you made.",
    windowWidth: 320,
  },
] as const;

function samplePath(t: number) {
  const last = WAYPOINTS.length - 1;
  const segment = Math.min(last - 1, Math.floor(t * last));
  const local = t * last - segment;
  const from = WAYPOINTS[segment]!;
  const to = WAYPOINTS[segment + 1]!;
  const lerp = (a: number, b: number) => a + (b - a) * local;

  return {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    w: lerp(from.w, to.w),
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
    let viewportHeight = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      viewportHeight = window.innerHeight;
      canvas.width = Math.ceil(window.innerWidth / DOT);
      canvas.height = Math.ceil((viewportHeight + BLEED) / DOT);
      canvas.style.height = `${viewportHeight + BLEED}px`;
      mask = null;
    };

    const buildMask = (value: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const next = new Float32Array(width * height);
      const sampleCount = Math.floor(160 * value);

      for (let step = 0; step <= sampleCount; step++) {
        const point = samplePath(Math.min(step / 160, 1));
        const cx = Math.round(point.x * width);
        const cy = Math.round((point.y * viewportHeight - PATH_SHIFT) / DOT);
        const radius = Math.ceil(point.w / DOT);
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

function StoryPin({
  pin,
  pan,
  pathProgress,
  viewport,
}: {
  pin: (typeof PIN_DATA)[number];
  pan: MotionValue<number>;
  pathProgress: MotionValue<number>;
  viewport: { width: number; height: number };
}) {
  const pinWidth = "w" in pin ? pin.w : 36;
  const pinHeight = pinWidth * 2.5;
  const responsiveWidth =
    viewport.width < 700
      ? viewport.width - 24
      : viewport.width < 1200
        ? viewport.width * 0.38
        : pin.windowWidth;
  const windowWidth = Math.min(pin.windowWidth, responsiveWidth);
  const anchor =
    "anchor" in pin
      ? pin.anchor
      : pin.x * viewport.width + windowWidth / 2 > viewport.width - 12
        ? "right"
        : pin.x * viewport.width - windowWidth / 2 < 12
          ? "left"
          : "center";
  const x = anchor === "left" ? "-10%" : anchor === "right" ? "-100%" : "-50%";
  const top = useTransform(pan, (value) => {
    const scale = Math.max(viewport.width / IMG_W, viewport.height / IMG_H);
    const visibleFraction = viewport.height / (IMG_H * scale);
    const panShift = (1 / visibleFraction - 1) * (1 - value);
    return `calc(${(pin.y + panShift) * 100}% - ${PATH_SHIFT}px)`;
  });
  const start = revealAt(pin.x, pin.y);
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
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-20"
        style={{
          left: `${pin.x * 100}%`,
          top,
          x: "-50%",
          y: "-97%",
        }}
      >
        <Image
          src="/landing/promo/pin.svg"
          alt=""
          width={pinWidth}
          height={pinHeight}
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute z-30"
        style={{
          left: `${pin.x * 100}%`,
          top,
          x,
          y: `calc(-100% - ${pinHeight + 30}px)`,
          opacity,
          scale,
          transformOrigin: `bottom ${anchor}`,
        }}
      >
        <Window
          title="You have a message"
          width={windowWidth}
          autoHeight
          draggable={false}
          disableExpand
        >
          <div className="max-w-full px-2 py-1 text-left">
            <h2 className="mb-2 text-[clamp(18px,2vw,30px)] leading-tight">
              {pin.title}
            </h2>
            <p className="font-secondary text-[clamp(13px,1.3vw,18px)] leading-relaxed text-[#555]">
              {pin.body}
            </p>
          </div>
        </Window>
      </motion.div>
    </>
  );
}

function PhotoFade() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new window.Image();
    image.src = PHOTO;

    const draw = () => {
      const width = window.innerWidth;
      const height = 360;
      canvas.width = width;
      canvas.height = height;

      const scale = Math.max(width / IMG_W, height / IMG_H);
      const drawnWidth = IMG_W * scale;
      const drawnHeight = IMG_H * scale;
      context.clearRect(0, 0, width, height);
      context.drawImage(
        image,
        (width - drawnWidth) / 2,
        height - drawnHeight,
        drawnWidth,
        drawnHeight,
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
      className="relative -mb-[234px] block h-[360px] w-full"
    />
  );
}

export function Hero() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const [viewport, setViewport] = React.useState({ width: 1440, height: 900 });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const pan = useTransform(scrollYProgress, [0, PAN_END], [0, 1]);
  const pathProgress = useTransform(scrollYProgress, [PAN_END, 1], [0, 1]);
  const backgroundY = useTransform(pan, [0, 1], [0, 100]);
  const backgroundPosition = useMotionTemplate`center ${backgroundY}%`;

  React.useEffect(() => {
    const measure = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <>
      <section ref={sectionRef} id="hero" className="relative h-[600svh]">
        <div className="sticky top-0 h-[100svh]">
          <motion.div
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${PHOTO})`,
              backgroundPosition,
            }}
          />
          <PathCanvas progress={pathProgress} />
          {PIN_DATA.map((pin) => (
            <StoryPin
              key={pin.title}
              pin={pin}
              pan={pan}
              pathProgress={pathProgress}
              viewport={viewport}
            />
          ))}
        </div>
      </section>

      <PhotoFade />
    </>
  );
}

import * as React from "react";

/**
 * One-off celebration for the accepted dashboard (Figma 221:16802, "confetti
 * falls for acceptance"): ribbons burst in from both bottom corners, fly
 * across the screen, flutter down and clear after a few seconds. Skipped for
 * people who prefer reduced motion.
 */

const COLORS = [
  "#ef3d8f",
  "#f7c531",
  "#2fd3c9",
  "#7bd23f",
  "#ff5a36",
  "#6a5cf6",
];
const PIECES = 180;
const DURATION_MS = 6000;
const GRAVITY = 900; // px/s²
const DRAG = 0.6; // fraction of velocity kept per second

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  w: number;
  h: number;
  color: string;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function launch(width: number, height: number): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => {
    const fromLeft = i % 2 === 0;
    // Aim up and across, so each side's burst crosses the screen.
    const speed = rand(0.75, 1.35) * Math.hypot(width, height) * 0.9;
    const tilt = rand(50, 75) * (Math.PI / 180);
    return {
      x: fromLeft ? rand(-20, 40) : width - rand(-20, 40),
      y: height + rand(0, 40),
      vx: Math.cos(tilt) * speed * (fromLeft ? 1 : -1),
      vy: -Math.sin(tilt) * speed,
      angle: rand(0, Math.PI * 2),
      spin: rand(-8, 8),
      flip: rand(0, Math.PI * 2),
      flipSpeed: rand(6, 14),
      w: rand(8, 14),
      h: rand(18, 30),
      color: COLORS[i % COLORS.length]!,
    };
  });
}

export function Confetti() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pieces = launch(width, height);
    const start = performance.now();
    let last = start;
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      // Fade everything out over the last second.
      ctx.globalAlpha = Math.min(1, (DURATION_MS - elapsed) / 1000);

      const drag = Math.pow(DRAG, dt);
      for (const p of pieces) {
        p.vx *= drag;
        p.vy = p.vy * drag + GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        // Squash one axis to fake the ribbon turning over as it falls.
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (done) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}

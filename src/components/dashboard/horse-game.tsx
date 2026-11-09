/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { Window } from "~/components/internals/window";

/**
 * A Chrome dino-style runner starring the Hack Western horse, shown on the
 * submitted dashboard. Layout follows Figma frames 221:15930 (init) and
 * 221:17193 (game over). Positions are measured from the bottom of the
 * window's title bar.
 */

const WIDTH = 634;
const HEIGHT = 609;
const GROUND_Y = 411;

const HORSE_SRC = "/apply/realm/safari-1.png";
const HORSE_X = 36;
const HORSE_W = 178;
const HORSE_H = 119;

const HAY_SRC = "/dashboard/hay-bale.png";
const HAY_W = 101;
const HAY_H = 68;
// The bale's art sits a little below its box in the Figma.
const HAY_SINK = 11;

// px/s and px/s² — tuned so a jump clears a bale at the starting speed.
const START_SPEED = 360;
const MAX_SPEED = 780;
const ACCELERATION = 6;
const GRAVITY = 2400;
const JUMP_VELOCITY = 860;

// Pixels travelled per point, roughly Chrome's pace.
const DISTANCE_PER_POINT = 40;
const HI_SCORE_KEY = "hw13-horse-game-hi";

type Status = "idle" | "running" | "over";

type Obstacle = { x: number; scale: number };

type GameState = {
  horseY: number;
  velocity: number;
  speed: number;
  distance: number;
  nextSpawnIn: number;
  obstacles: Obstacle[];
  groundOffset: number;
  time: number;
};

const freshState = (): GameState => ({
  horseY: 0,
  velocity: 0,
  speed: START_SPEED,
  distance: 0,
  nextSpawnIn: 300,
  obstacles: [],
  groundOffset: 0,
  time: 0,
});

const pad = (n: number) => String(Math.floor(n)).padStart(5, "0");

function readHiScore() {
  try {
    return Number(window.localStorage.getItem(HI_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeHiScore(score: number) {
  try {
    window.localStorage.setItem(HI_SCORE_KEY, String(score));
  } catch {
    // storage blocked (private mode etc.) — the high score just won't stick
  }
}

/** Shrinks a box so transparent padding around the art doesn't count as a hit. */
function hitbox(x: number, y: number, w: number, h: number, inset: number) {
  return {
    left: x + w * inset,
    right: x + w * (1 - inset),
    top: y + h * inset,
    bottom: y + h,
  };
}

export function HorseGame() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const horseImg = React.useRef<HTMLImageElement | null>(null);
  const hayImg = React.useRef<HTMLImageElement | null>(null);
  const state = React.useRef<GameState>(freshState());
  const statusRef = React.useRef<Status>("idle");
  const overAt = React.useRef(0);

  const [status, setStatus] = React.useState<Status>("idle");
  const [score, setScore] = React.useState(0);
  const [hiScore, setHiScore] = React.useState(0);

  const changeStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = state.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Ground: a 2px line broken by gaps that scroll with the horse.
    ctx.fillStyle = "#000";
    const segment = 155;
    const gap = 25;
    const period = segment + gap;
    for (let x = -(s.groundOffset % period) + 28; x < WIDTH - 28; x += period) {
      const start = Math.max(x, 28);
      const end = Math.min(x + segment, WIDTH - 28);
      if (end > start) ctx.fillRect(start, GROUND_Y - 1, end - start, 2);
    }

    if (hayImg.current?.complete) {
      for (const o of s.obstacles) {
        const w = HAY_W * o.scale;
        const h = HAY_H * o.scale;
        ctx.drawImage(
          hayImg.current,
          o.x,
          GROUND_Y - h + HAY_SINK * o.scale,
          w,
          h,
        );
      }
    }

    if (horseImg.current?.complete) {
      const running = statusRef.current === "running";
      const onGround = s.horseY === 0;
      // A small gallop bob while running, and a nose-up tilt mid-jump.
      const bob = running && onGround ? Math.abs(Math.sin(s.time * 14)) * 3 : 0;
      const tilt = onGround
        ? 0
        : Math.max(-0.12, Math.min(0.08, -s.velocity / 6000));
      const cx = HORSE_X + HORSE_W / 2;
      const cy = GROUND_Y - s.horseY - bob - HORSE_H / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.drawImage(
        horseImg.current,
        -HORSE_W / 2,
        -HORSE_H / 2,
        HORSE_W,
        HORSE_H,
      );
      ctx.restore();
    }
  }, []);

  const endGame = React.useCallback(() => {
    const final = Math.floor(state.current.distance / DISTANCE_PER_POINT);
    overAt.current = performance.now();
    changeStatus("over");
    setHiScore((hi) => {
      if (final <= hi) return hi;
      writeHiScore(final);
      return final;
    });
  }, []);

  const tick = React.useCallback(
    (dt: number) => {
      const s = state.current;
      s.time += dt;
      s.speed = Math.min(MAX_SPEED, s.speed + ACCELERATION * dt);
      const dx = s.speed * dt;
      s.distance += dx;
      s.groundOffset += dx;

      if (s.horseY > 0 || s.velocity > 0) {
        s.velocity -= GRAVITY * dt;
        s.horseY = Math.max(0, s.horseY + s.velocity * dt);
        if (s.horseY === 0) s.velocity = 0;
      }

      for (const o of s.obstacles) o.x -= dx;
      s.obstacles = s.obstacles.filter((o) => o.x + HAY_W * o.scale > 0);

      s.nextSpawnIn -= dx;
      if (s.nextSpawnIn <= 0) {
        s.obstacles.push({ x: WIDTH, scale: 0.8 + Math.random() * 0.35 });
        // Leave at least one jump's worth of room, more as the horse speeds up.
        const minGap = s.speed * 0.9 + 120;
        s.nextSpawnIn = minGap + Math.random() * 420;
      }

      const horse = hitbox(
        HORSE_X,
        GROUND_Y - s.horseY - HORSE_H,
        HORSE_W,
        HORSE_H,
        0.22,
      );
      const hit = s.obstacles.some((o) => {
        const w = HAY_W * o.scale;
        const h = HAY_H * o.scale;
        const bale = hitbox(o.x, GROUND_Y - h, w, h, 0.15);
        return (
          horse.left < bale.right &&
          horse.right > bale.left &&
          horse.top < bale.bottom &&
          horse.bottom > bale.top
        );
      });

      setScore(Math.floor(s.distance / DISTANCE_PER_POINT));
      if (hit) endGame();
    },
    [endGame],
  );

  const start = React.useCallback(() => {
    state.current = freshState();
    setScore(0);
    changeStatus("running");
  }, []);

  const jump = React.useCallback(() => {
    const s = state.current;
    if (s.horseY === 0) s.velocity = JUMP_VELOCITY;
  }, []);

  /** Space, ↑, click and tap all go through here. */
  const handleAction = React.useCallback(() => {
    const current = statusRef.current;
    if (current === "idle") {
      start();
      jump();
    } else if (current === "running") {
      jump();
    } else if (performance.now() - overAt.current > 500) {
      // The pause stops a held jump key from skipping the game-over screen.
      start();
    }
  }, [jump, start]);

  // Load sprites, size the canvas for the display, and restore the high score.
  React.useEffect(() => {
    setHiScore(readHiScore());
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = WIDTH * dpr;
      canvas.height = HEIGHT * dpr;
    }
    const horse = new Image();
    horse.src = HORSE_SRC;
    horse.onload = draw;
    horseImg.current = horse;
    const hay = new Image();
    hay.src = HAY_SRC;
    hay.onload = draw;
    hayImg.current = hay;
    draw();
  }, [draw]);

  // Game loop — only runs while playing.
  React.useEffect(() => {
    if (status !== "running") {
      draw();
      return;
    }
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't teleport the horse into a bale.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      tick(dt);
      draw();
      if (statusRef.current === "running") frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [status, tick, draw]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      // Let focused buttons and fields keep their own Space behaviour.
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      e.preventDefault();
      if (!e.repeat || statusRef.current === "running") handleAction();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAction]);

  return (
    <Window
      fluid
      draggable={false}
      disableControls
      showDots
      title="Hack Western 13: Discover the Unknown"
      className="w-[634px]"
      contentClassName="overflow-hidden"
    >
      <div
        className="relative cursor-pointer select-none"
        style={{ width: WIDTH, height: HEIGHT }}
        role="application"
        aria-label="Horse runner game. Press space, the up arrow, or click to jump."
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          handleAction();
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: WIDTH, height: HEIGHT }}
        />

        <div className="absolute left-1/2 top-[82px] flex -translate-x-1/2 items-center gap-10 whitespace-nowrap text-center font-cossetteTexte text-base leading-[1.2] text-black">
          <p>HI</p>
          <p>{pad(hiScore)}</p>
          <p>{pad(score)}</p>
        </div>

        {status === "over" && (
          <>
            <p className="absolute left-1/2 top-[107px] -translate-x-1/2 whitespace-nowrap text-center font-cossetteTexte text-[50px] font-bold leading-[1.2] text-black">
              GAME OVER
            </p>
            <button
              type="button"
              onClick={start}
              className="absolute left-1/2 top-[177px] -translate-x-1/2 whitespace-nowrap font-cossetteTexte text-base leading-[1.2] text-black transition-colors hover:text-black/50"
            >
              Play again
            </button>
          </>
        )}
      </div>
    </Window>
  );
}

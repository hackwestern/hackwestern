import Image from "next/image";
import { type ReactNode, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";

/** Small clickable props on the landing page; clicks are remembered across visits. */

const CHANGE_EVENT = "hw-keepsake";

const storageKey = (id: number) => `hw-keepsake-${id}`;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function useKeepsake(id: number) {
  const clicked = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey(id)) === "true",
    () => false,
  );
  const markClicked = () => {
    localStorage.setItem(storageKey(id), "true");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [clicked, markClicked] as const;
}

// Xylophone-ish: a sine with a quiet, fast-fading 4th partial. Each step
// strikes one more note of a C major arpeggio, and the cloud reveal adds
// the octave. Built on demand, so no audio files to load.
const ARPEGGIO = [0, 4, 7, 12];
const C5 = 523.25;
const NOTE_GAP_S = 0.15;

let audio: AudioContext | null = null;
let revealPlayed = false;

function playArpeggio(noteCount: number) {
  const ctx = (audio ??= new AudioContext());
  const start = ctx.currentTime;

  ARPEGGIO.slice(0, noteCount).forEach((semitones, i) => {
    const freq = C5 * 2 ** (semitones / 12);
    const at = start + i * NOTE_GAP_S;

    for (const [ratio, peak, decay] of [
      [1, 0.25, 0.6],
      [3.93, 0.06, 0.15],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + decay);
    }
  });
}

/** The full arpeggio, once, and only after a step was clicked in this tab. */
export function playReveal() {
  if (!audio || revealPlayed) return;
  revealPlayed = true;
  playArpeggio(ARPEGGIO.length);
}

/**
 * Pops off the item just clicked, drifts the way to go next, and fades. A
 * small white arrow in a roomy box, so its soft warm glow has space to spread.
 */
const POP_PATHS = {
  // rises off the top of the item
  "up-above": "top-0 [--pop-from:-78%] [--pop-mid:-92%] [--pop-to:-104%]",
  // sinks off the bottom of the item or edge
  "down-below": "bottom-0 [--pop-from:78%] [--pop-mid:92%] [--pop-to:104%]",
  // sinks towards an edge from above it, stopping short of it
  "down-above": "top-0 [--pop-from:-130%] [--pop-mid:-116%] [--pop-to:-104%]",
};

function PopArrow({
  direction,
  side = direction === "up" ? "above" : "below",
  onDone,
}: {
  direction: "up" | "down";
  side?: "above" | "below";
  onDone: () => void;
}) {
  const glow = `pop-glow${useId()}`;

  return (
    <svg
      viewBox="0 0 100 110"
      aria-hidden
      onAnimationEnd={onDone}
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 h-auto w-11 animate-pop-arrow opacity-0",
        POP_PATHS[`${direction}-${side}` as keyof typeof POP_PATHS],
      )}
    >
      <defs>
        <filter
          id={glow}
          x="0"
          y="0"
          width="100"
          height="110"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="13" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.6" />
          </feComponentTransfer>
          <feComposite in2="SourceAlpha" operator="out" result="halo" />
          <feFlood floodColor="#fae86b" />
          <feComposite in2="halo" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M48.6 30.6a2 2 0 0 1 2.8 0l19.2 19.9a1.5 1.5 0 0 1-1.1 2.5H59v24a4 4 0 0 1-4 4H45a4 4 0 0 1-4-4V53H30.5a1.5 1.5 0 0 1-1.1-2.5Z"
        transform={direction === "down" ? "rotate(180 50 55)" : undefined}
        fill="white"
        filter={`url(#${glow})`}
      />
    </svg>
  );
}

// Wood and gold chest, drawn as two sticker-outlined layers so the lid can
// lift off the body with light spilling out of the gap.
const LID = "M6 46V26C6 15 26 10 60 10s54 5 54 16v20Z";
const BAND = "#7a4d02";
const RIVET = "#fff3b0";

/** White sticker border around whatever it's applied to. */
function StickerFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feMorphology
        in="SourceAlpha"
        operator="dilate"
        radius="3"
        result="grown"
      />
      <feFlood floodColor="white" />
      <feComposite in2="grown" operator="in" result="border" />
      <feMerge>
        <feMergeNode in="border" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

function Rivets({ points }: { points: [number, number][] }) {
  return points.map(([cx, cy]) => (
    <circle
      key={`${cx}-${cy}`}
      cx={cx}
      cy={cy}
      r="1.1"
      fill={RIVET}
      stroke={BAND}
      strokeWidth=".4"
    />
  ));
}

export function Chest({ className }: { className?: string }) {
  const [opened, open] = useKeepsake(1);
  const [popping, setPopping] = useState(false);
  const id = useId();
  const ref = (name: string) => `url(#${name}${id})`;

  return (
    <div className={cn("w-12 lg:w-20", className)}>
      {popping && <PopArrow direction="up" onDone={() => setPopping(false)} />}
      <button
        type="button"
        aria-label="Chest"
        onClick={() => {
          if (!opened) {
            playArpeggio(1);
            setPopping(true);
          }
          open();
        }}
        className={cn(
          "block w-full origin-bottom cursor-pixel-hover",
          !opened && "motion-safe:animate-wiggle",
        )}
      >
        <svg
          viewBox="0 0 120 100"
          overflow="visible"
          aria-hidden
          className={cn(
            "h-auto w-full",
            !opened && "motion-safe:animate-glow-pulse",
          )}
        >
          <defs>
            <linearGradient id={`goldV${id}`} x1="0" x2="1">
              <stop offset="0" stopColor="#b8790a" />
              <stop offset=".3" stopColor="#ffe27a" />
              <stop offset=".55" stopColor="#f5bf1d" />
              <stop offset="1" stopColor="#a86d05" />
            </linearGradient>
            <linearGradient id={`goldH${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffe27a" />
              <stop offset=".45" stopColor="#f5bf1d" />
              <stop offset="1" stopColor="#a86d05" />
            </linearGradient>
            <linearGradient id={`wood${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#93603a" />
              <stop offset="1" stopColor="#6b3d1c" />
            </linearGradient>
            <radialGradient id={`light${id}`}>
              <stop offset="0" stopColor="#fffbe0" />
              <stop offset=".35" stopColor="#ffd65a" stopOpacity=".9" />
              <stop offset="1" stopColor="#ffd65a" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`lid${id}`}>
              <path d={LID} />
            </clipPath>
            <StickerFilter id={`sticker${id}`} />
          </defs>

          <ellipse cx="60" cy="95" rx="50" ry="3.5" fill="#000" opacity=".3" />

          {/* one sticker border around body and lid together */}
          <g filter={ref("sticker")}>
            <rect
              x="6"
              y="46"
              width="108"
              height="46"
              rx="2"
              fill={ref("wood")}
            />
            <path d="M6 61h108M6 76h108" stroke="#4a2a12" strokeWidth=".8" />
            {[6, 33, 79, 105].map((x) => (
              <rect
                key={x}
                x={x}
                y="46"
                width={x === 6 || x === 105 ? 9 : 8}
                height="46"
                fill={ref("goldV")}
                stroke={BAND}
                strokeWidth=".6"
              />
            ))}
            <rect
              x="6"
              y="46"
              width="108"
              height="5"
              fill={ref("goldH")}
              stroke={BAND}
              strokeWidth=".6"
            />
            <rect
              x="6"
              y="87"
              width="108"
              height="5"
              fill={ref("goldH")}
              stroke={BAND}
              strokeWidth=".6"
            />
            <Rivets
              points={[
                [10.5, 58],
                [10.5, 80],
                [37, 58],
                [37, 80],
                [83, 58],
                [83, 80],
                [109.5, 58],
                [109.5, 80],
              ]}
            />
            {/* padlock, which stays on the body */}
            <path
              d="M56.5 61v-3a3.5 3.5 0 0 1 7 0v3"
              fill="none"
              stroke={ref("goldV")}
              strokeWidth="1.8"
            />
            <rect
              x="54.5"
              y="60"
              width="11"
              height="10"
              rx="1.5"
              fill={ref("goldH")}
              stroke={BAND}
              strokeWidth=".6"
            />
            <circle cx="60" cy="64" r="1.2" fill={BAND} />
            <path d="M60 64v3" stroke={BAND} strokeWidth="1" />
            {/* hinged along the back; lifts and tips back when opened */}
            <g
              className={cn(
                "origin-bottom transition-transform duration-700 [transform-box:fill-box] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                opened && "[transform:translateY(-22%)_scaleY(0.88)]",
              )}
            >
              <g clipPath={ref("lid")}>
                <path d={LID} fill={ref("wood")} />
                <path
                  d="M6 24c14-6 94-6 108 0M6 35h108"
                  fill="none"
                  stroke="#4a2a12"
                  strokeWidth=".8"
                />
                {[6, 33, 79, 105].map((x) => (
                  <rect
                    key={x}
                    x={x}
                    y="4"
                    width={x === 6 || x === 105 ? 9 : 8}
                    height="44"
                    fill={ref("goldV")}
                    stroke={BAND}
                    strokeWidth=".6"
                  />
                ))}
                <rect
                  x="6"
                  y="41"
                  width="108"
                  height="5"
                  fill={ref("goldH")}
                  stroke={BAND}
                  strokeWidth=".6"
                />
              </g>
              <path d={LID} fill="none" stroke={BAND} strokeWidth=".8" />
              <Rivets
                points={[
                  [10.5, 30],
                  [37, 25],
                  [83, 25],
                  [109.5, 30],
                ]}
              />
              {/* hasp, which goes up with the lid */}
              <rect
                x="56.5"
                y="38"
                width="7"
                height="18"
                rx="2"
                fill={ref("goldV")}
                stroke={BAND}
                strokeWidth=".6"
              />
              <rect x="58.8" y="50" width="2.4" height="4" rx="1" fill={BAND} />
            </g>
          </g>

          {/* light from inside, blooming out of the gap once the lid lifts */}
          <g
            className={cn(
              "transition-opacity duration-700",
              opened ? "opacity-100" : "opacity-0",
            )}
          >
            <ellipse cx="60" cy="40" rx="62" ry="26" fill={ref("light")} />
            <path
              d="M30 30l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM88 24l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM62 18l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"
              fill="#fffbe0"
              className="motion-safe:animate-pulse"
            />
          </g>
        </svg>
      </button>
    </div>
  );
}

type ArrowSpot = { x: number; y: number; side: "above" | "below" };

/**
 * Just outside the window `el` sits in, on the edge nearer to it, so the arrow
 * shows against the page instead of the window's light background.
 */
function outsideWindow(el: HTMLElement): ArrowSpot | null {
  const frame = el.closest("[data-window-frame]")?.getBoundingClientRect();
  if (!frame) return null;
  const item = el.getBoundingClientRect();
  const below = item.top + item.height / 2 > frame.top + frame.height / 2;
  return {
    x: item.left + item.width / 2 + window.scrollX,
    y: (below ? frame.bottom : frame.top) + window.scrollY,
    side: below ? "below" : "above",
  };
}

/** A step that only appears once the one before it has been found. */
function HiddenStep({
  step,
  arrow,
  arrowOutsideWindow = false,
  onFound,
  label,
  className,
  children,
}: {
  step: number;
  arrow: "up" | "down";
  arrowOutsideWindow?: boolean;
  onFound?: () => void;
  label: string;
  className?: string;
  children: (found: boolean) => ReactNode;
}) {
  const [unlocked] = useKeepsake(step - 1);
  const [found, markFound] = useKeepsake(step);
  const [popping, setPopping] = useState(false);
  const [arrowSpot, setArrowSpot] = useState<ArrowSpot | null>(null);

  if (!unlocked) return null;

  const done = () => {
    setPopping(false);
    setArrowSpot(null);
  };

  return (
    <div className={className}>
      {popping &&
        (arrowSpot ? (
          createPortal(
            <div
              className="pointer-events-none absolute z-50"
              style={{ left: arrowSpot.x, top: arrowSpot.y }}
            >
              <PopArrow direction={arrow} side={arrowSpot.side} onDone={done} />
            </div>,
            document.body,
          )
        ) : (
          <PopArrow direction={arrow} onDone={done} />
        ))}
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          if (!found) {
            playArpeggio(step);
            setArrowSpot(
              arrowOutsideWindow ? outsideWindow(event.currentTarget) : null,
            );
            setPopping(true);
            onFound?.();
          }
          markFound();
        }}
        className="block cursor-pixel-hover"
      >
        {children(found)}
      </button>
    </div>
  );
}

export function Knight({ className }: { className?: string }) {
  return (
    <HiddenStep
      step={2}
      arrow="down"
      arrowOutsideWindow
      label="Knight"
      className={className}
    >
      {(found) => (
        <Image
          src="/landing/promo/knight.webp"
          alt=""
          width={165}
          height={264}
          className={cn(
            "h-[56px] w-auto",
            !found && "motion-safe:animate-glow-pulse",
          )}
        />
      )}
    </HiddenStep>
  );
}

/** The nearest ancestor that actually scrolls (body on phones, html elsewhere). */
function scrollParent(el: Element) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    const scrolls = overflowY === "auto" || overflowY === "scroll";
    if (scrolls && node.scrollHeight > node.clientHeight) return node;
  }
  return document.documentElement;
}

/** Once the arrow has had a moment, brings the linked cloud to mid-screen. */
function scrollToSky() {
  window.setTimeout(() => {
    const sky = document.querySelector("[data-sky]");
    if (!sky) return;
    const { top, height } = sky.getBoundingClientRect();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    scrollParent(sky).scrollBy({
      top: top - (window.innerHeight - height) / 2,
      behavior: reduce.matches ? "auto" : "smooth",
    });
  }, 700);
}

export function Flag({ className }: { className?: string }) {
  const id = useId();

  return (
    <HiddenStep
      step={3}
      arrow="up"
      onFound={scrollToSky}
      label="Flag"
      className={className}
    >
      {(found) => (
        <svg
          viewBox="0 0 70 90"
          overflow="visible"
          aria-hidden
          className={cn(
            "block h-auto w-[60px] lg:w-[72px]",
            !found && "motion-safe:animate-glow-pulse",
          )}
        >
          <defs>
            <StickerFilter id={`flag-sticker${id}`} />
          </defs>
          <g filter={`url(#flag-sticker${id})`}>
            <rect
              x="6"
              y="6"
              width="4"
              height="82"
              rx="2"
              fill="#7a4a26"
              stroke="#4a2a12"
              strokeWidth=".6"
            />
            <circle
              cx="8"
              cy="5"
              r="3.2"
              fill="#f5bf1d"
              stroke="#7a4d02"
              strokeWidth=".6"
            />
            {/* the cloth (and the logo on it) waves from the pole */}
            <g className="origin-left [transform-box:fill-box] motion-safe:animate-flag-wave">
              <path
                d="M10 9c9-4 18 3 28 0s19-3 28 0v32c-9-3-18-3-28 0s-19 4-28 0Z"
                fill="#e1c8fa"
              />
              <path
                d="M10 35c9 4 19 3 28 0s19-3 28 0v6c-9-3-18-3-28 0s-19 4-28 0Z"
                fill="#c9a8ef"
              />
              <image
                href="/shared/horse.svg"
                x="28.4"
                y="11"
                width="19.1"
                height="28"
              />
            </g>
          </g>
        </svg>
      )}
    </HiddenStep>
  );
}

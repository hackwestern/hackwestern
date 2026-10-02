import Image from "next/image";
import { useId, useState, useSyncExternalStore } from "react";
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
function PopArrow({
  direction,
  onDone,
}: {
  direction: "up" | "down";
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
        direction === "up" ? "top-0 [--pop-dir:-1]" : "bottom-0 [--pop-dir:1]",
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
            {/* white sticker border around whatever it's applied to */}
            <filter
              id={`sticker${id}`}
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
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

export function Knight({ className }: { className?: string }) {
  const [chestOpened] = useKeepsake(1);
  const [clicked, markClicked] = useKeepsake(2);
  const [popping, setPopping] = useState(false);

  if (!chestOpened) return null;

  return (
    <div className={className}>
      {popping && (
        <PopArrow direction="down" onDone={() => setPopping(false)} />
      )}
      <button
        type="button"
        aria-label="Knight"
        onClick={() => {
          if (!clicked) {
            playArpeggio(2);
            setPopping(true);
          }
          markClicked();
        }}
        className="block cursor-pixel-hover"
      >
        <Image
          src="/landing/promo/knight.webp"
          alt=""
          width={165}
          height={264}
          className={cn(
            "h-[56px] w-auto",
            !clicked && "motion-safe:animate-glow-pulse",
          )}
        />
      </button>
    </div>
  );
}

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

/** Pops off the item just clicked, drifts the way to go next, and fades. */
function PopArrow({
  direction,
  onDone,
}: {
  direction: "up" | "down";
  onDone: () => void;
}) {
  return (
    <svg
      viewBox="0 0 44 50"
      aria-hidden
      onAnimationEnd={onDone}
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 h-auto w-8 animate-pop-arrow opacity-0 [filter:drop-shadow(0_0_5px_rgb(250_232_107))_drop-shadow(0_0_12px_rgb(250_232_107))]",
        direction === "up" ? "top-0 [--pop-dir:-1]" : "bottom-0 [--pop-dir:1]",
      )}
    >
      <path
        d="M22 3 41 23H30v24H14V23H3Z"
        transform={direction === "down" ? "rotate(180 22 25)" : undefined}
        fill="white"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const WOOD = "#8b5a2b";
const WOOD_LIGHT = "#a0682f";
const WOOD_GRAIN = "#6b4320";
const INK = "#3b2412";
const GOLD = "#d4a73a";
const LID = "M4 26V16C4 9 14 6 32 6s28 3 28 10v10Z";

export function Chest({ className }: { className?: string }) {
  const [opened, open] = useKeepsake(1);
  const [popping, setPopping] = useState(false);
  const lidClip = useId();

  return (
    <div className={cn("w-12 lg:w-[72px]", className)}>
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
          viewBox="0 0 64 56"
          overflow="visible"
          aria-hidden
          className={cn(
            "h-auto w-full",
            !opened && "motion-safe:animate-glow-pulse",
          )}
        >
          <defs>
            <clipPath id={lidClip}>
              <path d={LID} />
            </clipPath>
          </defs>

          {/* gold inside, hidden by the closed lid */}
          <rect x="7" y="17" width="50" height="10" fill="#ffd65a" />

          <rect
            x="4"
            y="25"
            width="56"
            height="27"
            rx="2"
            fill={WOOD}
            stroke={INK}
            strokeWidth="2"
          />
          <path d="M5 38h54" stroke={WOOD_GRAIN} strokeWidth="1.5" />
          <rect
            x="11"
            y="25"
            width="5"
            height="27"
            fill={GOLD}
            stroke={INK}
            strokeWidth="1.5"
          />
          <rect
            x="48"
            y="25"
            width="5"
            height="27"
            fill={GOLD}
            stroke={INK}
            strokeWidth="1.5"
          />

          {/* hinged at its back-left corner */}
          <g
            className={cn(
              "origin-bottom-left transition-transform duration-700 [transform-box:fill-box] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
              opened && "-rotate-12",
            )}
          >
            <g clipPath={`url(#${lidClip})`}>
              <rect x="4" y="6" width="56" height="20" fill={WOOD_LIGHT} />
              <path d="M4 21h56" stroke={WOOD_GRAIN} strokeWidth="1.5" />
              <rect x="11" y="4" width="5" height="22" fill={GOLD} />
              <rect x="48" y="4" width="5" height="22" fill={GOLD} />
            </g>
            <path
              d={LID}
              fill="none"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>

          <rect
            x="27"
            y="23"
            width="10"
            height="12"
            rx="1.5"
            fill="#f2c94c"
            stroke={INK}
            strokeWidth="1.5"
          />
          <circle cx="32" cy="28" r="1.6" fill={INK} />
          <path
            d="M32 29v3"
            stroke={INK}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
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

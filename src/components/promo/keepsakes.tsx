import Image from "next/image";
import { type CSSProperties, useState, useSyncExternalStore } from "react";
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

// Chest photo cut out as a sticker and split at the lid seam; the lid
// layer (and the hook hanging off it) swings up about the seam's left end.
const CHEST_SEAM = "52.66%";

export function Chest({ className }: { className?: string }) {
  const [opened, open] = useKeepsake(1);
  const [popping, setPopping] = useState(false);

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
        <span
          className={cn(
            "relative block",
            !opened && "motion-safe:animate-glow-pulse",
          )}
          style={{ "--seam": CHEST_SEAM } as CSSProperties}
        >
          {/* gold inside, showing through the gap once the lid lifts */}
          <span
            className={cn(
              "absolute inset-x-[18%] top-[var(--seam)] h-[16%] -translate-y-1/2 rounded-full bg-[#ffd65a] blur-[3px] transition-opacity duration-700",
              opened ? "opacity-100" : "opacity-0",
            )}
          />
          <Image
            src="/landing/promo/chest-body.webp"
            alt=""
            width={244}
            height={188}
            className="relative block h-auto w-full"
          />
          <Image
            src="/landing/promo/chest-lid.webp"
            alt=""
            width={244}
            height={188}
            className={cn(
              "absolute inset-0 h-auto w-full origin-[0%_var(--seam)] transition-transform duration-700 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
              opened && "-rotate-[10deg]",
            )}
          />
        </span>
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

import Head from "next/head";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

// Shared pieces of the venue screens (/broadcast and /broadcast/interview),
// from the design team's "Livestream Dashboard Final" Figma frames. Both are
// fixed 1920x1080 canvases, loaded by OBS as Browser Sources.

const WIDTH = 1920;
const HEIGHT = 1080;
const ASSETS = "/broadcast";

export const easternTime = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleString("en-US", { timeZone: "America/Toronto", ...options });

// Null until mounted, so server and client render the same markup.
export function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Shrinks the fixed canvas to fit smaller windows (OBS is exact).
function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(
        Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT),
      );
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

export function BroadcastCanvas({
  title,
  className,
  transparent = false,
  children,
}: {
  title: string;
  className?: string;
  /** Leaves the page see-through outside the canvas (OBS keys it out) */
  transparent?: boolean;
  children: React.ReactNode;
}) {
  const scale = useFitScale();
  return (
    <>
      <Head>
        <title>{`${title} | Hack Western 13`}</title>
        <meta name="robots" content="noindex" />
        {transparent && (
          <style>{"html, body { background: transparent !important; }"}</style>
        )}
      </Head>
      <div
        className={cn(
          "fixed inset-0 overflow-hidden",
          !transparent && "bg-[#042239]",
        )}
      >
        <div
          className={cn(
            "absolute left-1/2 top-1/2 overflow-hidden font-figtree",
            className,
          )}
          style={{
            width: WIDTH,
            height: HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

// The horse sticker is two stacked layers in the design
function Horse() {
  return (
    <div className="relative h-[58.781px] w-[38.723px] shrink-0">
      <div className="absolute inset-[-2.79%_-6.75%_-4.08%_-6.2%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="block size-full max-w-none"
          src={`${ASSETS}/horse-back.svg`}
        />
      </div>
      <div className="absolute inset-[0_-0.55%_0_0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="block size-full max-w-none"
          src={`${ASSETS}/horse-front.svg`}
        />
      </div>
    </div>
  );
}

// Glossy grey pill with the red live light ("Primary Button 2.0")
function LivePill({ parts }: { parts: string[] }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center gap-[10px] px-[24px] py-[12px]">
      <div className="absolute inset-0 overflow-clip rounded-full border border-[#b1b1b1]">
        <div className="absolute inset-0 rounded-full bg-[#cbcbcb]" />
        <div className="absolute left-[10.49px] right-[10.49px] top-[-1px] h-[19.173px] rounded-full bg-gradient-to-b from-[rgba(255,255,255,0.9)] to-[rgba(255,255,255,0)]" />
        <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_-17.23px_10.769px_0px_rgba(255,255,255,0.6)]" />
      </div>
      <div className="relative size-[17.993px] shrink-0">
        <div className="absolute inset-[0_-11.11%_-27.78%_-11.11%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="block size-full max-w-none"
            src={`${ASSETS}/live-dot.svg`}
          />
        </div>
      </div>
      <div className="relative flex items-center gap-[10px]">
        {parts.map((part, index) => (
          <span key={part} className="flex items-center gap-[10px]">
            {index > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="block size-[5px]"
                src={`${ASSETS}/separator-dot.svg`}
              />
            )}
            <span className="whitespace-nowrap text-[24px] font-semibold uppercase text-[#242424]">
              {part}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function BroadcastHeader({
  dark = false,
  pill,
}: {
  dark?: boolean;
  pill: string[];
}) {
  return (
    <div className="flex w-[1840px] items-center justify-between">
      <div className="flex items-center gap-[36px]">
        <Horse />
        <p className="flex items-baseline gap-[24px] whitespace-nowrap font-cossetteTexte text-[48px] font-bold leading-[58px] tracking-[-0.96px]">
          <span className={dark ? "text-white" : "text-[#042239]"}>
            Hack Western 13
          </span>
          <span className={dark ? "text-[#5aa1e8]" : "text-[#2e547a]"}>
            Discover the Unknown
          </span>
        </p>
      </div>
      <LivePill parts={pill} />
    </div>
  );
}

// "Window Asset 2.0": the grey title bar window from the design
export function BroadcastWindow({
  title,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-clip rounded-[5.998px] border border-[#9f9f9f]",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 top-[32.09px]",
          bodyClassName,
        )}
      >
        {children}
      </div>
      <div className="absolute left-[-1px] right-[-1px] top-[-0.91px] flex h-[33px] items-center justify-between border border-[#9f9f9f] px-[12px] py-[4px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
          src={`${ASSETS}/window-header.webp`}
        />
        <div className="absolute left-[-1px] top-[calc(50%+1px)] h-[17.993px] w-[277.556px] -translate-y-1/2">
          <div className="absolute inset-[-5.56%_0_0_0]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="block size-full max-w-none"
              src={`${ASSETS}/window-shade.svg`}
            />
          </div>
        </div>
        <div className="relative flex items-center gap-[6px]">
          {["light-1", "light-2", "light-3"].map((light) => (
            <div key={light} className="relative size-[14.394px] shrink-0">
              <div className="absolute inset-[0_-11.11%_-27.78%_-11.11%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="block size-full max-w-none"
                  src={`${ASSETS}/${light}.svg`}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="absolute inset-x-0 whitespace-nowrap text-center font-cossetteTexte text-[14px] text-[#626262]">
          {title}
        </p>
        <div className="w-[47px]" />
      </div>
    </div>
  );
}

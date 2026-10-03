import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

import { Window } from "~/components/internals/window";
import { FilmStrip } from "~/components/promo/film-strip";
import { Button } from "~/components/ui/button";

const ASSETS = "/landing/promo/404";

/**
 * Figma 779:3983 (mobile) / 776:3676 (desktop). The digits step down like the
 * design; sizes are vw of the 402 and 1440 frames.
 */
const DIGITS = [
  { char: "4", className: "" },
  {
    char: "0",
    className: "h-[66.17vw] w-[34.05vw] md:h-[40.14vw] md:w-[19.93vw]",
  },
  {
    char: "4",
    className: "h-[72.19vw] w-[32.98vw] md:h-[45.19vw] md:w-[19.31vw]",
  },
];

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page not found | Hack Western</title>
      </Head>
      <main className="relative h-[100svh] min-h-[600px] cursor-pixel-default overflow-hidden bg-[#dfe6ea]">
        <Image
          src={`${ASSETS}/background.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover"
        />

        <p
          aria-hidden
          className="pointer-events-none absolute left-[-0.43px] top-[20.9%] flex select-none items-start font-cossetteTexte text-[54.81vw] font-bold leading-[1.2] text-light/20 md:left-[39.1%] md:top-[10px] md:text-[32.08vw]"
        >
          {DIGITS.map((digit, index) => (
            <span
              key={index}
              className={`flex flex-col justify-end ${digit.className}`}
            >
              {digit.char}
            </span>
          ))}
        </p>

        <div className="absolute inset-x-0 top-0">
          <FilmStrip />
        </div>
        <div className="absolute inset-x-0 bottom-0 hidden md:block">
          <FilmStrip />
        </div>

        <Link
          href="/"
          aria-label="Hack Western home"
          className="absolute left-[28.9px] top-[20px] z-10 grid cursor-pixel-hover md:left-[52px] md:top-[70px]"
        >
          <span className="relative col-start-1 row-start-1 h-[44.49px] w-[29.31px] md:h-[60px] md:w-[39.526px]">
            <span className="absolute inset-[-3.08%_-6.32%_-4.35%_-6.6%]">
              <Image
                src={`${ASSETS}/sticker-shadow.svg`}
                alt=""
                width={45}
                height={64}
                className="block size-full max-w-none"
              />
            </span>
          </span>
          <Image
            src={`${ASSETS}/sticker.svg`}
            alt=""
            width={40}
            height={60}
            className="relative col-start-1 row-start-1 h-[44.49px] w-[29.31px] md:h-[60px] md:w-[39.526px]"
          />
        </Link>

        <h1 className="sr-only">404: This page could not be found</h1>

        <div className="absolute bottom-[74px] left-1/2 -translate-x-1/2 md:hidden">
          <LostWindow width={330} />
        </div>
        <div className="absolute left-[calc(50%-378px)] top-[calc(50%+173.83px)] hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <LostWindow width={382} />
        </div>
      </main>
    </>
  );
}

/** `Window` takes a pixel width, so each breakpoint renders its own copy. */
function LostWindow({ width }: { width: number }) {
  return (
    <Window title="This page could not be found" width={width} autoHeight>
      <div className="flex flex-col items-center gap-12 p-2">
        <p className="text-center font-cossetteTexte text-[48px] font-bold leading-[1.2] text-gray-5">
          Are you lost, adventurer?
        </p>
        <Button asChild variant="primary-2" size="lg" className="w-[215px]">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </Window>
  );
}

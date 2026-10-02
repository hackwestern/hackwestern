import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

import { Window } from "~/components/internals/window";
import { FilmStrip } from "~/components/promo/film-strip";
import { Button } from "~/components/ui/button";

const ASSETS = "/landing/promo/404";

/** Figma 776:3676. Digits step down like the design; sizes are vw of the 1440 frame. */
const DIGITS = [
  { char: "4", height: "auto", width: "auto" },
  { char: "0", height: "40.14vw", width: "19.93vw" },
  { char: "4", height: "45.19vw", width: "19.31vw" },
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
          className="pointer-events-none absolute left-[39.1%] top-[10px] flex select-none items-start font-cossetteTexte text-[32.08vw] font-bold leading-[1.2] text-light/20"
        >
          {DIGITS.map((digit, index) => (
            <span
              key={index}
              className="flex flex-col justify-end"
              style={{ height: digit.height, width: digit.width }}
            >
              {digit.char}
            </span>
          ))}
        </p>

        <div className="absolute inset-x-0 top-0">
          <FilmStrip />
        </div>
        <div className="absolute inset-x-0 bottom-0">
          <FilmStrip />
        </div>

        <Link
          href="/"
          aria-label="Hack Western home"
          className="absolute left-[52px] top-[70px] grid cursor-pixel-hover"
        >
          <span className="relative col-start-1 row-start-1 h-[60px] w-[39.526px]">
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
            className="relative col-start-1 row-start-1 h-[60px] w-[39.526px]"
          />
        </Link>

        <h1 className="sr-only">404: This page could not be found</h1>

        <div className="absolute left-[calc(50%-378px)] top-[calc(50%+173.83px)] -translate-x-1/2 -translate-y-1/2">
          <Window title="This page could not be found" width={382} autoHeight>
            <div className="flex flex-col items-center gap-12 p-2">
              <p className="text-center font-cossetteTexte text-[48px] font-bold leading-[1.2] text-gray-5">
                Are you lost, adventurer?
              </p>
              <Button
                asChild
                variant="primary-2"
                size="lg"
                className="w-[215px]"
              >
                <Link href="/">Return home</Link>
              </Button>
            </div>
          </Window>
        </div>
      </main>
    </>
  );
}

import Image from "next/image";
import { PreregistrationForm } from "~/components/preregistration-form";

export default function Home() {
  return (
    <main className="relative h-[100dvh] cursor-pixel-default overflow-hidden">
      {/* Sky-blue root background as a no-white fallback: the root element's
          background is the only one that propagates into the mobile
          browser-chrome / safe-area strips, so a solid colour here guarantees
          those strips never fall back to white. body is transparent so it
          doesn't paint over it. */}
      <style jsx global>{`
        html {
          background: #8fc0ee;
        }
        body {
          background: transparent;
        }
        /* Background layer stretched *past* every screen edge using negative
           safe-area insets. viewport-fit=cover exposes the insets; anchoring a
           fixed element to 0 stops at the safe area, leaving blue strips behind
           the notch / home-indicator / toolbar, so we pull each edge out by its
           inset to cover the whole physical screen. */
        .landing-bg-fill {
          position: fixed;
          top: calc(-1 * env(safe-area-inset-top, 0px));
          right: calc(-1 * env(safe-area-inset-right, 0px));
          bottom: calc(-1 * env(safe-area-inset-bottom, 0px));
          left: calc(-1 * env(safe-area-inset-left, 0px));
        }
      `}</style>
      {/* Full-screen background image, bled past every safe-area edge. */}
      <div className="landing-bg-fill pointer-events-none overflow-hidden">
        <Image
          src="/landing/home/background.webp"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>
      {/* Clouds + horse overlay, glued to the viewport. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="cloud-scroll-right absolute left-[-12vw] top-[10vh] w-[55vw]"
          aria-hidden="true"
        >
          <Image
            src="/landing/home/cloud1.webp"
            alt=""
            width={4096}
            height={1576}
            quality={65}
            className="h-auto w-full"
            sizes="55vw"
          />
          <Image
            src="/landing/home/cloud1.webp"
            alt=""
            width={4096}
            height={1576}
            quality={65}
            className="absolute right-[100vw] top-0 h-auto w-full"
            sizes="55vw"
          />
        </div>
        <div
          className="cloud-scroll-right-slow absolute bottom-[34vh] right-[calc(-8vw)] w-[63vw] md:bottom-[23vh]"
          aria-hidden="true"
        >
          <Image
            src="/landing/home/cloud2.webp"
            alt=""
            width={1724}
            height={570}
            quality={65}
            className="h-auto w-full"
            sizes="63vw"
          />
          <Image
            src="/landing/home/cloud2.webp"
            alt=""
            width={1724}
            height={570}
            quality={65}
            className="absolute right-[100vw] top-0 h-auto w-full"
            sizes="63vw"
          />
        </div>
        <Image
          src="/landing/home/tiny-horse.png"
          alt=""
          aria-hidden="true"
          width={45}
          height={34}
          className="absolute bottom-[16vh] left-[20vw] w-[22px]"
        />
      </div>
      <div className="absolute left-1/2 top-[44%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center md:top-[38%]">
        <div className="hero-text flex flex-col gap-1 font-cossetteTexte text-black sm:gap-1.5 md:gap-2 lg:gap-3 xl:gap-3.5">
          <div className="title-text">
            <span className="text-[64px] font-bold leading-[58px] tracking-[-0.03em] xl:text-[86.67px] xl:leading-[26px] xl:tracking-[-0.04em]">
              Hack Western&nbsp;
            </span>
            <span className="text-[43.33px] font-normal leading-[26px] tracking-[-0.05em]">
              13
            </span>
          </div>
          <div className="subtitle-text text-right">
            <p className="text-[43.33px] font-bold leading-[40px] tracking-[-0.05em] xl:leading-[26px]">
              Discover the unknown
            </p>
          </div>
        </div>
        <div className="info-text mt-[36px] flex flex-col gap-2 text-[20px] font-medium leading-[150%] text-[#2E547A] md:mt-[28px]">
          <div className="flex items-center gap-4">
            <img src="/landing/home/icons/retro-globe.svg" alt="globe icon" />
            <p>In-Person Event</p>
          </div>
          <div className="flex items-center gap-4">
            <img src="/landing/home/icons/retro-cal.svg" alt="calendar icon" />
            <p>November 20-22, 2026</p>
          </div>
        </div>
        <div className="mt-[28px] flex flex-col items-start gap-[11px] md:mt-[48px]">
          <PreregistrationForm />
          <a
            href="mailto:hello@hackwestern.me"
            className="cursor-pixel-hover text-[16px] font-medium text-[#2E547A]"
          >
            Interested in sponsoring?
          </a>
        </div>
      </div>
    </main>
  );
}

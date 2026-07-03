import { PreregistrationForm } from "~/components/preregistration-form";

export default function Home() {
  return (
    <main className="relative h-[100dvh] cursor-pixel-default overflow-hidden bg-[url('/landing/home/background.webp')] bg-cover bg-center bg-no-repeat">
      <div
        className="cloud-scroll-right pointer-events-none absolute left-[-12vw] top-[10vh] w-[55vw]"
        aria-hidden="true"
      >
        <img src="/landing/home/cloud1.webp" alt="" className="w-full" />
        <img
          src="/landing/home/cloud1.webp"
          alt=""
          className="absolute right-[100vw] top-0 w-full"
        />
      </div>
      <div
        className="cloud-scroll-right-slow pointer-events-none absolute bottom-[34vh] right-[calc(-8vw)] w-[63vw] md:bottom-[23vh]"
        aria-hidden="true"
      >
        <img src="/landing/home/cloud2.webp" alt="" className="w-full" />
        <img
          src="/landing/home/cloud2.webp"
          alt=""
          className="absolute right-[100vw] top-0 w-full"
        />
      </div>
      <img
        src="/landing/home/tiny-horse.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[16vh] left-[20vw] w-[22px] md:bottom-[14vh]"
      />
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

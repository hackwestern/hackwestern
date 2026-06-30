import PrimaryButton from "~/components/internals/primary-button";
import { Input } from "~/components/ui/input";

export default function Home() {
  return (
    <main className="relative h-screen cursor-pixel-default overflow-hidden bg-[url('/landing/home/background.webp')] bg-cover bg-center bg-no-repeat">
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
        className="cloud-scroll-right-slow pointer-events-none absolute bottom-[23vh] right-[calc(-8vw)] w-[63vw]"
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
        className="pointer-events-none absolute bottom-[14vh] left-[20vw] w-[22px]"
      />
      <div className="absolute left-1/2 top-[38%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div className="hero-text flex flex-col gap-3.5 font-cossetteTexte text-black">
          <div className="title-text flex items-baseline">
            <p className="text-[86.67px] font-bold leading-[26px] tracking-[-0.04em]">
              Hack Western&nbsp;
            </p>
            <p className="text-[43.33px] font-normal leading-[26px] tracking-[-0.05em]">
              13
            </p>
          </div>
          <div className="subtitle-text text-right">
            <p className="text-[43.33px] font-bold leading-[26px] tracking-[-0.05em]">
              Discover the unknown
            </p>
          </div>
        </div>
        <div className="info-text mt-[28px] flex flex-col gap-2 text-[20px] font-medium leading-[150%] text-[#2E547A]">
          <div className="flex items-center gap-4">
            <img src="/landing/home/icons/retro-globe.svg" alt="globe icon" />
            <p>In-Person Event</p>
          </div>
          <div className="flex items-center gap-4">
            <img src="/landing/home/icons/retro-cal.svg" alt="calendar icon" />
            <p>November 20-22, 2026</p>
          </div>
        </div>
        <div className="mt-[48px] flex flex-col items-start gap-[11px]">
          <div className="email-field flex items-center justify-center gap-[14px]">
            <Input
              className="h-[35px] w-[223px]"
              placeholder="Sign up for updates"
              variant="default"
            />
            <PrimaryButton className="h-[35px]" size="sm" direction="right">
              Submit
            </PrimaryButton>
          </div>
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

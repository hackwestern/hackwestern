import Image from "next/image";
import React from "react";
import { PreregistrationForm } from "~/components/preregistration-form";

export default function Home() {
  const [horseVisible, setHorseVisible] = React.useState(false);

  React.useEffect(() => {
  if (!horseVisible) return;

  const timer = setTimeout(() => {
    setHorseVisible(false);
  }, 3000);

  return () => clearTimeout(timer);
}, [horseVisible]);

  return (
    <main className="relative h-[100lvh] cursor-pixel-default overflow-hidden">
      <Image
        src="/landing/home/background.webp"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div
        className="cloud-scroll-right pointer-events-none absolute left-[-12vw] top-[10vh] w-[55vw]"
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
        className="cloud-scroll-right-slow pointer-events-none absolute bottom-[34vh] right-[calc(-8vw)] w-[63vw] md:bottom-[23vh]"
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
      
      <div className="group absolute bottom-[11vh] left-[20vw] ">
         <Image
        src="/landing/home/tiny-horse.png"
        alt=""
        aria-hidden="true"
        width={75}
        height={155}
        className="relative hover:cursor-telescope object-cover transition-opacity group-hover:opacity-0 z-10"
      />
        <Image
          src="/landing/home/purple-horse.png"
          alt=""
          aria-hidden="true"
          width={75}
          height={155}
          className="absolute inset-0 hover:cursor-telescope object-cover opacity-0 transition-opacity group-hover:opacity-100 z-10"
          onClick={() => setHorseVisible(true)}
        />
        <Image
          src="/landing/home/horse.png"
          alt=""
          aria-hidden="true"
          width={250}
          height={500}
          className={`absolute bottom-[35px] left-[20px] max-w-[250px] transition-opacity ease-in-out duration-500 ${
          horseVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
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

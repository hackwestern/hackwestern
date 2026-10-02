import Topbar from "~/components/live/topbar";
import { FilmStrip } from "~/components/promo/film-strip";
import { Hero } from "~/components/promo/hero";
import { PastProjects } from "~/components/promo/past-projects";
import { SkyBackground } from "~/components/promo/sky-background";
import { Button } from "~/components/ui/button";
import Image from "next/image";
import { Window } from "~/components/internals/window";
import { FaqColumn, FaqItem } from "~/components/live/faq";
import { PhotoGallery } from "~/components/live/photo-gallery";
import { WindowFolder } from "~/components/live/window-folder";
import { PROMO_FAQ } from "~/constants/faq";
import Waterfall from "~/components/live/waterfall";
import CloudDrift from "~/components/live/clouddrift";
import Cloud from "~/components/live/cloud";
import { useRef } from "react";

// ABOUT & FAQ TODO
// 4. check with "dear hackers" message
// 5. add "dither" on mobile FAQ

const SECTIONS = [
  { id: "hero", label: "Hero", height: 1290, tiltAfter: 0.4 },
  { id: "about", label: "About", height: 1109, tiltAfter: 3.5 },
  { id: "projects", label: "Projects", height: 1237, tiltAfter: 1.2 },
  { id: "sponsors", label: "Sponsors + FAQ", height: 1886, tiltAfter: 0 },
];

const mid = Math.ceil(PROMO_FAQ.length / 2);
const left = PROMO_FAQ.slice(0, mid);
const right = PROMO_FAQ.slice(mid);

/** Team photo cut-outs in the footer band, as % across the 1440 design frame. */
const TEAM_FIGURES = [
  { left: 0, top: 58.78 },
  { left: 8.87, top: 71.74 },
  { left: 17.04, top: 78.78 },
  { left: 34.09, top: 78.78 },
  { left: 42.95, top: 71.74 },
  { left: 68.18, top: 38.78 },
  { left: 85.22, top: 50.1 },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <main id="top" className="relative cursor-pixel-default">
      <SkyBackground />
      <FilmStrip />

      <Hero />

      <FilmStrip rotate={0.4} className="relative z-10" />

      <section
        id="about"
        style={{ minHeight: 1109 }}
        className="relative hidden sm:block"
      >
        <div
          ref={containerRef}
          className="absolute inset-x-0 -top-6 z-0"
          style={{
            bottom: "calc(-7.06vw - 15px)",
            clipPath: "polygon(0 0, 100% 0.7vw, 100% 100%, 0 calc(100% - 6vw))",
          }}
        >
          <Image
            src="/landing/home/about.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />

          <Waterfall
            containerRef={containerRef}
            backgroundSrc="/landing/home/about.png"
            objectPositionX="center"
            sourceLeft={670}
            sourceTop={1350}
            sourceWidth={400}
            sourceHeight={1200}
          />
        </div>

        {/* //   top="37%"
  //   left="26%"
  //   width="140px"
  //   height="52%" */}

        {/* insert waterfall */}
        <WindowFolder
          defaultOpen
          variant="labelled"
          label="A message to new hackers"
          className="absolute bottom-[120px] left-[100px]"
          windowTitle="A message to new hackers"
          windowProps={{
            width: 400,
            autoHeight: true,
            className: "isolate absolute right-[500px] top-[200px]",
          }}
        >
          <div className="p3 whitespace-pre-line font-figtree">
            {`Dear Hacker,

              Whether you’re an experienced hacker or have never touched a line of code, you belong at Hack Western.

              Since the start of Hack Western in 2014, our mission has been to build a welcoming and accessible environment for students from all backgrounds to learn, build, and pursue their dreams.

              If you've been wondering if you belong at a hackathon, YOU DO!

              Let us know if you have any concerns. We hope to see you there!

              Love,

              The Hack Western 13 Team`}
          </div>
        </WindowFolder>
        <WindowFolder
          defaultOpen
          variant="labelled"
          label="Impact"
          className="absolute bottom-[500px] left-[200px]"
          windowTitle="Last year's impact"
          windowProps={{
            autoHeight: true,
            className: "isolate absolute right-[300px] top-[550px]",
          }}
        >
          <div className="flex flex-col items-center gap-[28px] text-center">
            <div className="flex items-start gap-[64px]">
              <div className="flex flex-col items-center">
                <p className="font-cossetteTexte text-[47.917px] text-medium">
                  82
                </p>
                <p className="w-[78.52px] text-[14.4px] font-medium text-light">
                  Projects Submitted
                </p>
              </div>
              <div className="flex flex-col items-center">
                <p className="font-cossetteTexte text-[47.917px] text-medium">
                  320
                </p>
                <p className="text-[14.4px] font-medium text-light">
                  Participants
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="font-cossetteTexte text-[47.917px] text-medium">
                $10,000
              </p>
              <p className="text-[14.4px] font-medium text-light">in prizes</p>
            </div>
          </div>
        </WindowFolder>

        <WindowFolder
          defaultOpen
          variant="labelled"
          label="Exploration"
          className="absolute bottom-[300px] left-[80px]"
          windowTitle="A world of exploration"
          windowProps={{
            className: "isolate absolute right-[100px] top-[100px]",
          }}
        >
          <PhotoGallery
            images={[
              "/landing/home/gallery/placeholder-1.png",
              "/landing/home/gallery/placeholder-2.png",
              "/landing/home/gallery/placeholder-3.png",
              "/landing/home/gallery/placeholder-4.png",
            ]}
          />
        </WindowFolder>
      </section>
      <FilmStrip rotate={3.5} className="relative z-10" />

      <PastProjects />
      <FilmStrip rotate={1.2} className="relative z-10" />

      <section
        id="sponsors"
        className="relative flex min-h-[1880px] flex-col gap-12 overflow-hidden px-6 pb-16 pt-12
             [--photo-h:360px] [--photo-offset:150px]
             lg:block lg:min-h-[1790px] lg:p-0"
      >
        {/* CLOUDS */}
        <CloudDrift delay={0} duration={40} wait={50} className="top-[50px]">
          <Cloud variant="cloud10" className="hidden lg:block" />
        </CloudDrift>

        <CloudDrift delay={10} duration={40} wait={38} className="top-[200px]">
          <Cloud variant="cloud12" className="hidden lg:block" />
        </CloudDrift>

        <CloudDrift delay={20} duration={40} wait={30} className="top-[20px]">
          <Cloud variant="cloud13" className="hidden lg:block" />
        </CloudDrift>

        <CloudDrift delay={30} duration={40} wait={16} className="top-[300px]">
          <Cloud variant="cloud14" className="hidden lg:block" />
        </CloudDrift>

        {/* desktop background (unchanged, just hidden on mobile) */}
        <Image
          src="/landing/home/sponsor-bg.png"
          alt=""
          width={2880}
          height={2808}
          className="absolute -bottom-[0%] z-0 hidden h-auto w-full object-cover lg:block"
        />

        {/* mobile background */}
        <div aria-hidden className="lg:hidden">
          {/* green: unchanged position, from --photo-h to the bottom of the section */}
          <div className="absolute inset-x-0 bottom-0 top-[var(--photo-h)] z-0 bg-green-dark" />

          {/* photo: full height, no crop, pushed down by --photo-offset */}
          <div className="absolute inset-x-0 top-[var(--photo-offset)] z-0">
            <Image
              src="/landing/home/sponsor-bg.png"
              alt=""
              width={402}
              height={464}
              className="h-auto w-full"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 h-[15%] bg-gradient-to-b from-transparent to-green-dark" />
          </div>
        </div>

        <div className="contents lg:absolute lg:left-1/2 lg:block lg:w-[1120px] lg:-translate-x-1/2">
          {/* Title block */}
          {/* Page Title */}
          <div
            className="absolute left-6 right-6 top-[80px] flex flex-col items-start gap-[36px]
                lg:left-0 lg:right-auto lg:w-[488px]"
          >
            <div className="flex flex-col items-start gap-[18px]">
              <div className="flex flex-col items-start">
                {/* Line 1 */}
                <div className="relative">
                  <h2 className="font-cossetteTexte text-[24px] font-bold leading-[1.2] text-heavy lg:text-[36px]">
                    Sponsor a weekend of
                  </h2>
                  <h2
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(0,142,202,0.2) 24.444%, #008eca 65.273%)",
                    }}
                    className="pointer-events-none absolute inset-x-0 top-full -translate-y-[13px]
                              scale-y-[-1] select-none bg-clip-text font-cossetteTexte
                              text-[24px] font-bold leading-[1.2] text-transparent opacity-20 lg:text-[36px]"
                  >
                    Sponsor a weekend of
                  </h2>
                </div>

                {/* Line 2 */}
                <div className="relative">
                  <h2 className="font-cossetteTexte text-[24px] font-bold leading-[1.2] text-heavy lg:text-[36px]">
                    inspiration and creation
                  </h2>
                  <h2
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(0,142,202,0.2) 24.444%, #008eca 65.273%)",
                    }}
                    className="pointer-events-none absolute inset-x-0 top-full -translate-y-[13px]
                              scale-y-[-1] select-none bg-clip-text font-cossetteTexte
                              text-[24px] font-bold leading-[1.2] text-transparent opacity-20 lg:text-[36px]"
                  >
                    inspiration and creation
                  </h2>
                </div>
              </div>

              <p className="font-figtree text-[16px] font-medium text-medium">
                Interested in supporting the event?
              </p>
            </div>
            <a href="mailto:hello@hackwestern.com">
              <Button>
                <svg
                  viewBox="0 0 14 14"
                  fill="none"
                  className={"relative z-10 size-[14px]"}
                  aria-hidden="true"
                >
                  <rect
                    x="1"
                    y="2.5"
                    width="12"
                    height="9"
                    rx="1.2"
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                  <path
                    d="M1.5 3.2 7 7.5l5.5-4.3"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="relative z-10 pl-2">Get in touch</span>
              </Button>
            </a>
          </div>

          {/* MOBILE window */}
          <Window
            autoHeight
            width={382}
            title="Thank you to our sponsors"
            className="relative z-10 mt-[250px] w-full max-w-[382px] self-center lg:hidden"
          >
            <Image
              src="/landing/home/sponsors.png"
              alt="sponsors"
              width={382}
              height={400}
              className="h-auto w-full"
            />
          </Window>

          <section id="faq" className="relative scroll-mt-24">
            {/* FAQ */}
            <div className="relative z-10 flex w-full flex-col items-start gap-[24px] lg:absolute lg:left-0 lg:top-[900px] lg:gap-[64px]">
              <div className="flex w-full max-w-[488px] flex-col items-start gap-[18px]">
                <div className="relative">
                  <h2 className="font-cossetteTexte text-[24px] font-bold leading-[1.2] text-highlight lg:text-[36px]">
                    Frequently Asked Questions
                  </h2>
                  <h2
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(255,255,255,0.2) 24.444%, #ffffff 65.273%)",
                    }}
                    className="pointer-events-none absolute inset-x-0 top-full origin-top translate-y-[20px]
                   scale-y-[-1] select-none bg-clip-text font-cossetteTexte text-[24px]
                   font-bold leading-[1.2] text-transparent opacity-15
                   lg:translate-y-[30px] lg:text-[36px]"
                  >
                    Frequently Asked Questions
                  </h2>
                </div>

                <p className="font-figtree text-[16px] font-medium text-[#d0d6dd]">
                  Have another question? Reach out to us at{" "}
                  <a href="mailto:hello@hackwestern.com" className="underline">
                    hello@hackwestern.com
                  </a>
                </p>
              </div>

              {/* mobile: one column, one item open at a time */}
              <div className="flex w-full flex-col lg:hidden">
                <FaqColumn items={[...left, ...right]} />
              </div>

              {/* desktop: two columns, one item open per column */}
              <div className="hidden w-full items-start gap-[24px] lg:flex">
                <FaqColumn items={left} />
                <FaqColumn items={right} />
              </div>
            </div>
          </section>
        </div>
        {/* Sponsors window desktop*/}
        {/* this closes downwards...? */}
        <Window
          autoHeight
          width={700}
          title="Thank you to our sponsors"
          className="z-10 hidden lg:absolute lg:bottom-[55%] lg:left-[40%] lg:block"
        >
          <Image
            src="/landing/home/sponsors.png"
            alt="sponsors"
            width={1067}
            height={795}
          />
        </Window>
      </section>
      <FilmStrip rotate={0} />

      <div className="relative h-[295px] bg-black">
        {TEAM_FIGURES.map((figure) => (
          <div
            key={`${figure.left}-${figure.top}`}
            className="absolute h-[110px] w-[80px] rounded-sm bg-white/10"
            style={{ left: `${figure.left}%`, top: `${figure.top}px` }}
          />
        ))}
        <h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[clamp(2rem,7vw,100px)] text-white">
          Meet the Team
        </h2>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// PARKED: HW13 single-screen hero (horse, clouds, preregistration form).
// Restore by uncommenting everything below and deleting the Home above.
// ---------------------------------------------------------------------------
//
// import Image from "next/image";
// import React from "react";
// import { PreregistrationForm } from "~/components/preregistration-form";
//
// export default function Home() {
//   const BOUNCE_GAP_SECONDS = 8;
//   const horseRef = React.useRef<HTMLDivElement>(null);
//
//   const [horseVisible, setHorseVisible] = React.useState(false);
//   const [isBouncing, setIsBouncing] = React.useState(false);
//   const [isHovering, setIsHovering] = React.useState(false);
//
//   //click outside horse
//   React.useEffect(() => {
//     if (!horseVisible) return;
//
//     function handleClickOutside(e: MouseEvent) {
//       if (horseRef.current && !horseRef.current.contains(e.target as Node)) {
//         setHorseVisible(false);
//       }
//     }
//
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, [horseVisible]);
//
//   //timer for big horse
//   React.useEffect(() => {
//     if (!horseVisible) return;
//
//     setIsBouncing(false);
//
//     const timer = setTimeout(() => {
//       setHorseVisible(false);
//     }, 5000);
//
//     return () => clearTimeout(timer);
//   }, [horseVisible]);
//
//   //horse bouncing
//   React.useEffect(() => {
//     if (horseVisible) return;
//
//     const interval = setInterval(
//       () => setIsBouncing(true),
//       BOUNCE_GAP_SECONDS * 1000,
//     );
//     return () => clearInterval(interval);
//   }, [horseVisible]);
//
//   return (
//     <main className="relative h-[100lvh] cursor-pixel-default overflow-hidden">
//       <div
//         className="absolute bottom-0 h-auto min-h-full w-auto min-w-full "
//         style={{ aspectRatio: "4096 / 2560" }}
//       >
//         <Image
//           src="/landing/home/background.webp"
//           alt=""
//           fill
//           priority
//           className="object-cover object-center"
//           sizes="100vw"
//         />
//         {/* Pin the horse to the grass crest across aspect ratios. The bg is
//             object-cover (4096x2560, horizon at ~79.7% down), so its crop flips
//             between height- and width-driven; a fixed vh floated the horse into
//             the sky on short/landscape windows. This tracks the visible grass
//             band instead. See derivation: bottom = 0.54 * (visible grass band). */}
//         <div
//           ref={horseRef}
//           className="absolute left-[20vw] z-20"
//           style={{ bottom: "max(2vh, 27vh - 0.16 * max(62.5vw, 100vh))" }}
//         >
//           <div
//             className={`group relative ${
//               !horseVisible && isBouncing && !isHovering
//                 ? "animate-bounce-jump"
//                 : ""
//             } group-hover:[animation-play-state:paused]`}
//             onMouseEnter={() => setIsHovering(true)}
//             onMouseLeave={() => setIsHovering(false)}
//             onAnimationEnd={() => setIsBouncing(false)}
//           >
//             <Image
//               src="/landing/home/tiny-horse.webp"
//               alt=""
//               aria-hidden="true"
//               width={75}
//               height={155}
//               className="relative z-10 object-cover transition-opacity hover:cursor-telescope hover:opacity-0"
//             />
//             <Image
//               src="/landing/home/purple-horse.webp"
//               alt=""
//               aria-hidden="true"
//               width={75}
//               height={155}
//               className="absolute inset-0 z-10 object-cover opacity-0 transition-opacity hover:cursor-telescope hover:opacity-100"
//               onClick={() => setHorseVisible(true)}
//             />
//           </div>
//           <Image
//             src="/landing/home/horse.webp"
//             alt=""
//             aria-hidden="true"
//             width={250}
//             height={500}
//             className={`absolute bottom-[35px] left-[40px] max-w-[70px] transition-opacity duration-500 ease-in-out md:left-[20px] md:max-w-[250px] ${
//               horseVisible ? "opacity-100" : "pointer-events-none opacity-0"
//             }`}
//           />
//         </div>
//       </div>
//       <div
//         className="cloud-scroll-right cloud-scroll-right-from-left pointer-events-none absolute left-[-12vw] top-[10vh] w-[55vw]"
//         aria-hidden="true"
//       >
//         <Image
//           src="/landing/home/cloud1.webp"
//           alt=""
//           width={4096}
//           height={1576}
//           quality={65}
//           className="h-auto w-full"
//           sizes="55vw"
//         />
//         <Image
//           src="/landing/home/cloud1.webp"
//           alt=""
//           width={4096}
//           height={1576}
//           quality={65}
//           className="cloud-scroll-right-from-left-copy absolute top-0 h-auto w-full"
//           sizes="55vw"
//         />
//       </div>
//       <div
//         className="cloud-scroll-right-slow pointer-events-none absolute bottom-[34vh] right-[calc(-8vw)] w-[63vw] md:bottom-[23vh]"
//         aria-hidden="true"
//       >
//         <Image
//           src="/landing/home/cloud2.webp"
//           alt=""
//           width={1724}
//           height={570}
//           quality={65}
//           className="h-auto w-full"
//           sizes="63vw"
//         />
//         <Image
//           src="/landing/home/cloud2.webp"
//           alt=""
//           width={1724}
//           height={570}
//           quality={65}
//           className="absolute right-[100vw] top-0 h-auto w-full"
//           sizes="63vw"
//         />
//       </div>
//
//       <div className="absolute left-1/2 top-[44%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center md:top-[38%]">
//         <div className="hero-text flex flex-col gap-1 font-cossetteTexte text-black sm:gap-1.5 md:gap-2 lg:gap-3 xl:gap-3.5">
//           <div className="title-text">
//             <span className="text-[64px] font-bold leading-[58px] tracking-[-0.03em] xl:text-[86.67px] xl:leading-[26px] xl:tracking-[-0.04em]">
//               Hack Western&nbsp;
//             </span>
//             <span className="text-[43.33px] font-normal leading-[26px] tracking-[-0.05em]">
//               13
//             </span>
//           </div>
//           <div className="subtitle-text text-right">
//             <p className="text-[43.33px] font-bold leading-[40px] tracking-[-0.05em] xl:leading-[26px]">
//               Discover the unknown
//             </p>
//           </div>
//         </div>
//         <div className="info-text mt-[36px] flex flex-col gap-2 text-[20px] font-medium leading-[150%] text-[#2E547A] md:mt-[28px]">
//           <div className="flex items-center gap-4">
//             <img src="/landing/home/icons/retro-globe.svg" alt="globe icon" />
//             <p>In-Person Event</p>
//           </div>
//           <div className="flex items-center gap-4">
//             <img src="/landing/home/icons/retro-cal.svg" alt="calendar icon" />
//             <p>November 20-22, 2026</p>
//           </div>
//         </div>
//         <div className="mt-[28px] flex flex-col items-start gap-[11px] md:mt-[48px]">
//           <PreregistrationForm />
//           <a
//             href="mailto:hello@hackwestern.me"
//             className="cursor-pixel-hover text-[16px] font-medium text-[#2E547A]"
//           >
//             Interested in sponsoring?
//           </a>
//         </div>
//       </div>
//     </main>
//   );
// }

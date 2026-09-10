import { FilmStrip } from "~/components/promo/film-strip";
import { SkyBackground } from "~/components/promo/sky-background";

const SECTIONS = [
  { id: "hero", label: "Hero", height: 1290, tiltAfter: 0.4 },
  { id: "about", label: "About", height: 1109, tiltAfter: 3.5 },
  { id: "projects", label: "Projects", height: 1237, tiltAfter: 1.2 },
  { id: "sponsors", label: "Sponsors + FAQ", height: 1886, tiltAfter: 0 },
];

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
  return (
    <main id="top" className="relative cursor-pixel-default">
      <SkyBackground />

      <FilmStrip />
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <section
            id={section.id}
            className="flex items-center justify-center"
            style={{ minHeight: `${section.height}px` }}
          >
            <h2 className="text-[clamp(2.5rem,7vw,100px)] text-black">
              {section.label}
            </h2>
          </section>
          <FilmStrip rotate={section.tiltAfter} />
        </div>
      ))}
      <span id="faq" />

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

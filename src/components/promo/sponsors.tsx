import { CanvasComponent } from "../canvas/component";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Mail } from "lucide-react";
import { CopyCheck } from "lucide-react";
import { coordinates } from "~/constants/canvas";
import Image from "next/image";
import { SPONSORS, type SponsorLogoProps } from "~/constants/sponsors";

const SponsorLogo = ({
  src,
  alt,
  width,
  height,
  x,
  y,
  rotation,
  href,
}: SponsorLogoProps) => {
  return (
    <a
      className="absolute cursor-pointer"
      style={{
        transform: `rotate(${rotation}deg)`,
        left: x,
        top: y,
        width,
        height,
        willChange: "transform",
      }}
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
    >
      <Image
        src={src}
        alt={alt}
        width={width * 4}
        height={height * 4}
        draggable="false"
        className="hover:contrast-105 object-contain transition-all hover:scale-[1.01] hover:brightness-105"
      />
    </a>
  );
};

function Sponsors() {
  const [wide, setWide] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const handleClick = () => {
    if (isAnimating) return;
    setWide(true);
    setTimeout(() => setWide(false), 2000);
  };

  return (
    <CanvasComponent
      offset={coordinates.sponsors}
      imageFallback="/images/promo/sponsors.png"
    >
      <div className="mt-16 flex flex-col items-center justify-center space-y-4">
        <div className="flex origin-center scale-150 flex-col items-center justify-center space-y-8 transition-transform duration-300 ease-in-out">
          <div className="-mb-24 inline-flex w-[794px] flex-col items-center justify-start gap-4 px-4">
            {/* Our Sponsors Text Section */}
            <div className="inline-flex w-full max-w-full scale-[0.7] flex-col items-center justify-start gap-4 px-4 pb-0 sm:max-w-[794px] sm:scale-[0.85] sm:gap-6 sm:px-0 sm:pb-8 md:scale-[0.95] md:gap-8 md:pb-12 lg:scale-100">
              <div className="h-5 justify-start self-stretch text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
                Our sponsors
              </div>
              <div className="flex flex-col items-start justify-start gap-3 self-stretch">
                <div className="justify-start self-stretch text-center font-dico text-3xl font-medium text-indigo-950 sm:text-3xl md:text-4xl">
                  Our sponsors make Hack Western possible.
                </div>
                <div className="justify-start self-stretch text-center font-figtree text-sm font-medium text-zinc-500 sm:text-base">
                  Thank you to the organizations that support our mission.
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row">
            <div className="-mt-36 flex origin-center scale-[0.45] flex-row sm:-mt-20 sm:scale-[0.65] md:-mt-8 md:scale-[0.85] lg:mt-0 lg:scale-100">
              {/* Macbook */}
              <div className="relative z-10 h-[600px] w-[854.14px] origin-top-left -rotate-[1.771deg] rounded-3xl bg-gradient-to-b from-gray-200 to-zinc-400 shadow-[0px_3.8216559886932373px_7.643311977386475px_0px_rgba(0,0,0,0.25)] shadow-[inset_0px_-1.9108279943466187px_11.464967727661133px_0px_rgba(0,0,0,0.40)]">
                <div className="absolute left-[386.49px] top-[239.58px] h-36 w-24">
                  <motion.img
                    src="/hackwesternmaclogo.svg"
                    alt="hackwestern"
                    width={95.541}
                    height={144.834}
                    draggable="false"
                  />
                </div>
                {SPONSORS.map((sponsor, i) => (
                  <SponsorLogo key={i} {...sponsor} />
                ))}
              </div>

              {/* Notepad */}
              <div className="flex h-[380px] w-[400px] origin-top-left flex-col items-center">
                <div className="relative h-full w-full scale-110">
                  <motion.img
                    src="/notepad.svg"
                    alt="notepad"
                    width={440}
                    height={418}
                    draggable="false"
                  />
                  <div className="absolute inset-0 left-1/2 top-1/2 flex h-full w-[450px] -translate-x-1/2 -translate-y-1/2 rotate-[7.647deg] flex-col items-center justify-center gap-[29px] px-10">
                    <div className="space-y-2">
                      <div className="w-full text-center font-jetbrains-mono text-xl font-medium uppercase tracking-tighter text-[#3C204C]">
                        <span className="inline-block max-w-[350px] break-words">
                          SPONSOR A WEEKEND OF
                          <br />
                          INSPIRATION AND CREATION.
                        </span>
                      </div>
                      <div className="w-full max-w-[320px] justify-center break-words text-center font-figtree text-sm font-medium text-zinc-500">
                        Interested in supporting the event?
                      </div>
                    </div>
                    <div className="flex w-full justify-center">
                      <Button
                        variant={wide ? "apply" : "primary"}
                        size="default"
                        onClick={() => {
                          setWide(true);
                          handleClick();
                        }}
                        className={clsx(
                          "gap-2 transition-all duration-500",
                          wide ? "w-52" : "w-40",
                          wide && "!translate-y-[1px] shadow-none",
                        )}
                      >
                        {wide ? (
                          <CopyCheck className="h-5 w-5" />
                        ) : (
                          <Mail className="h-5 w-5" />
                        )}
                        {wide ? "Email copied!" : "Get in touch"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default Sponsors;

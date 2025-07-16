import { CanvasComponent } from "../canvas/canvas";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Mail } from "lucide-react";

function SponsorSection() {
  return (
    <CanvasComponent offset={{ x: "800px", y: "500px"}}>
    <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-12">

      {/* Our Sponsors Text Section */}
      <div className="inline-flex w-[794px] flex-col items-center justify-start gap-8 pb-12">
        <div className="h-5 justify-start self-stretch text-center font-['JetBrains_Mono'] text-base font-medium uppercase text-zinc-500">
          Our sponsors
        </div>
        <div className="flex flex-col items-start justify-start gap-3 self-stretch">
          <div className="justify-start self-stretch text-center font-['Dico'] text-4xl font-medium text-indigo-950">
            Our sponsors make Hack Western possible.
          </div>
          <div className="justify-start self-stretch text-center font-['Figtree'] text-base font-medium text-zinc-500">
            Thank you to the organizations that support our mission.
          </div>
        </div>
      </div>

      <div className="flex">

        {/* Macbook */}
        <div
          className="relative origin-top-left rounded-3xl bg-gradient-to-b from-gray-200 to-zinc-400 shadow-[0px_3.8216559886932373px_7.643311977386475px_0px_rgba(0,0,0,0.25)] shadow-[inset_0px_-1.9108279943466187px_11.464967727661133px_0px_rgba(0,0,0,0.40)] z-10 w-[854.14px] h-[600px] -rotate-[1.771deg]"
        >
          <div className="absolute left-[386.49px] top-[239.58px] h-36 w-24">
            <motion.img
              src="/hackwesternmaclogo.svg"
              alt="hackwestern"
              width={95.541}
              height={144.834}
              draggable="false"
            />
          </div>
          <div
            data-property-1="Default"
            className="absolute left-[29.33px] top-[49px] h-28 w-96 origin-top-left rotate-[1.77deg]"
          >
            <div className="absolute left-[1.13px] top-[16px] h-20 w-96"></div>
          </div>
        </div>

        {/* Notepad */}
        <div
          className="origin-top-left flex flex-col items-center w-[400px] h-[380px]"
        >
            <div className="relative w-full h-full scale-110">
            <motion.img
              src="/notepad.svg"
              alt="notepad"
              width={440}
              height={418}
              draggable="false"
            />
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-[29px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-[450px] px-10 rotate-[7.647deg]"
            >
              <div className="space-y-2">
                 <div
                  className="w-full text-center text-[#3C204C] font-jetbrains-mono text-xl font-medium tracking-tighter uppercase"
                >
                  <span className="inline-block max-w-[350px] break-words">
                    SPONSOR A WEEKEND OF<br />
                    INSPIRATION AND CREATION.
                  </span>
                </div>
                <div className="max-w-[320px] break-words w-full justify-center text-center font-figtree text-sm font-medium text-zinc-500">
                  Interested in supporting the event?
                </div>
              </div>
              <div className="flex w-full justify-center">
                <Button
                  variant="primary"
                  className="w-auto px-6 py-3 gap-2"
                  type="submit"
                >
                  <Mail className="h-5 w-5" />
                  Get in touch
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
    </CanvasComponent>
  );
}

export default SponsorSection;

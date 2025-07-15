import { CanvasComponent } from "../canvas/canvas";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "../ui/button";
import { Mail } from "lucide-react";

function SponsorSection() {
  return (
    <CanvasComponent offset={{ x: "800px", y: "500px"}}>
    <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-12">

      {/* Our Sponsors Text Section */}
      <div className="inline-flex w-[794px] flex-col items-center justify-start gap-6">
        <div className="h-5 justify-start self-stretch text-center font-['JetBrains_Mono'] text-base font-medium uppercase text-zinc-500">
          Our sponsors
        </div>
        <div className="flex flex-col items-start justify-start gap-3 self-stretch">
          <div className="justify-start self-stretch text-center font-['Dico'] text-3xl font-medium text-indigo-950">
            Our sponsors make Hack Western possible.
          </div>
          <div className="justify-start self-stretch text-center font-['Figtree'] text-base font-medium text-zinc-500">
            Thank you to the organizations that support our mission.
          </div>
        </div>
      </div>
      <div className="flex">
        {/* Macbook */}
        <div className="relative h-[626.11px] w-[872.27px] origin-top-left rotate-[-1.77deg] rounded-3xl bg-gradient-to-b from-gray-200 to-zinc-400 shadow-[0px_3.8216559886932373px_7.643311977386475px_0px_rgba(0,0,0,0.25)] shadow-[inset_0px_-1.9108279943466187px_11.464967727661133px_0px_rgba(0,0,0,0.40)]">
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
        <div className="inline-flex w-96 origin-top-left rotate-[7.65deg] flex-col items-center justify-start gap-7">
          <div className="relative">
            <motion.img
              src="/notepad.svg"
              alt="notepad"
              width={400}
              height={380}
              draggable="false"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-16 px-8">
              <div className="w-96 justify-start text-center font-['JetBrains_Mono'] text-2xl font-medium uppercase text-indigo-950">
                Sponsor a weekend of inspiration and creation.
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-start gap-2.5 self-stretch">
            <div className="w-96 justify-start text-center font-['Figtree'] text-base font-medium text-zinc-500">
              Interested in supporting the event?
            </div>
          </div>
          {/* <div className="relative h-4 w-4 overflow-hidden"></div> */}
          <Button
            variant="primary"
            className="w-40 gap-1 pb-1 pl-2 pr-2 pt-1"
            type="submit"
          >
            <Mail className="ml-2 h-6 w-6" />
            Get in touch
          </Button>
        </div>
      </div>

    </div>
    </CanvasComponent>
  );
}

export default SponsorSection;

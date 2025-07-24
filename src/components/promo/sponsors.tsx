import { CanvasComponent } from "../canvas/canvas";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Mail } from "lucide-react";
import { coordinates } from "~/constants/canvas";

function Sponsors() {
  return (
    <CanvasComponent offset={coordinates.sponsors}>
      <div className="mt-16 flex flex-col items-center justify-center space-y-4">
        <div className="flex origin-center scale-150 flex-col items-center justify-center space-y-8 transition-transform duration-300 ease-in-out">
          <div className="-mb-24 inline-flex w-[794px] flex-col items-center justify-start gap-4 px-4">
            {/* Our Sponsors Text Section */}
            <div className="inline-flex w-[794px] max-w-[794px] scale-[0.7] flex-col items-center justify-start gap-4 px-4 pb-0">
              <div className="h-5 justify-start self-stretch text-center font-jetbrains-mono text-base font-medium uppercase text-medium">
                Our sponsors
              </div>
              <div className="flex flex-col items-start justify-start gap-3 self-stretch">
                <div className="justify-start self-stretch text-center font-dico text-[24px] font-medium text-heavy">
                  Our sponsors make Hack Western possible.
                </div>
                <div className="justify-start self-stretch text-center font-figtree text-[16px] font-medium text-medium">
                  Thank you to the organizations that support our mission.
                </div>
              </div>
            </div>
          </div>

          <div className="flex scale-150 flex-row">
            <div className="flex origin-center scale-[0.45] flex-row">
              {/* Macbook */}
              <div className="relative z-10 h-[600px] w-[854.14px] origin-top-left -rotate-[1.771deg] rounded-3xl bg-gradient-to-b from-gray-200 to-zinc-400 shadow-[0px_3.82px_7.64px_0px_rgba(0,0,0,0.25)] shadow-[inset_0px_-1.91px_11.46px_0px_rgba(0,0,0,0.40)]">
                <div className="absolute left-[386.49px] top-[239.58px] h-[144px] w-[96px]">
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
                  className="absolute left-[29.33px] top-[49px] h-[112px] w-[384px] origin-top-left rotate-[1.77deg]"
                >
                  <div className="absolute left-[1.13px] top-[16px] h-[80px] w-[384px]"></div>
                </div>
              </div>

              {/* Notepad */}
              <div className="flex h-[380px] w-[400px] origin-top-left flex-col items-center">
                <div className="relative h-[418px] w-[440px] scale-[1.1]">
                  <motion.img
                    src="/notepad.svg"
                    alt="notepad"
                    width={440}
                    height={418}
                    draggable="false"
                  />
                  <div className="absolute inset-0 left-1/2 top-1/2 flex h-[418px] w-[450px] -translate-x-1/2 -translate-y-1/2 rotate-[7.647deg] flex-col items-center justify-center gap-[29px] px-10">
                    <div className="space-y-2">
                      <div className="w-[350px] text-center font-jetbrains-mono text-xl font-medium uppercase tracking-tighter text-[#3C204C]">
                        <span className="inline-block break-words">
                          SPONSOR A WEEKEND OF
                          <br />
                          INSPIRATION AND CREATION.
                        </span>
                      </div>
                      <div className="w-[320px] justify-center break-words text-center font-figtree text-sm font-medium text-zinc-500">
                        Interested in supporting the event?
                      </div>
                    </div>
                    <div className="flex w-full justify-center">
                      <Button
                        variant="primary"
                        className="w-auto gap-2 px-6 py-3"
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
        </div>
      </div>
    </CanvasComponent>
  );
}

export default Sponsors;

import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import { motion } from "framer-motion";
import Envelope from "./envelope";

function About() {
  return (
    <CanvasComponent offset={coordinates.about}>
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 pb-12 sm:space-y-8 md:space-y-12">
        <div className="flex origin-center scale-[0.7] flex-col items-center justify-center space-y-8 transition-transform duration-300 ease-in-out sm:scale-[0.85] md:scale-100 md:scale-[0.95] lg:scale-100">
          <div className="flex w-full max-w-full flex-col items-center justify-start gap-4 px-4 pb-0 sm:max-w-[794px] sm:gap-6 sm:px-0 sm:pb-8  md:gap-8 md:pb-12">
            <div className="h-5 text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
              About
            </div>
            <div className="text-center font-dico text-3xl font-medium text-indigo-950 sm:text-3xl md:text-4xl">
              Create. Collaborate. Innovate.
            </div>
          </div>
          <div className="grid origin-center scale-[0.85] grid-cols-2 grid-rows-2 flex-row gap-10 sm:-mt-20 sm:scale-[0.9] md:-mt-4 md:scale-[0.95] lg:mt-0 lg:scale-100">
            <div>
              <motion.img
                src="/photo.png"
                alt="hackwestern"
                width={375}
                height={250}
                draggable="false"
                style={{ rotate: "-5deg" }}
              />
            </div>
            <div className="relative flex w-fit max-w-xs rotate-[8deg] items-center justify-center bg-[url('/speech.svg')] bg-contain bg-center bg-no-repeat text-center">
              <div className="mb-2 p-12 font-figtree text-xs text-white sm:text-sm md:text-base lg:text-base">
                We cover food, travel, and lodging so you can focus on bringing
                your ideas to life!
              </div>
            </div>
            <div className="relative h-fit w-fit max-w-md -rotate-[2deg] rounded-sm bg-white shadow-md">
              <div className="absolute -left-[55px] -top-[45px] z-10 h-20 w-40">
                <motion.img src="/tape1.png" alt="tape1" draggable={false} />
              </div>
              <div className="flex flex-col items-center justify-center gap-x-8 gap-y-4 p-8">
                <div>
                  <motion.img
                    src="/people.svg"
                    alt="hackwestern"
                    width={150}
                    height={75}
                    draggable="false"
                  />
                </div>
                <div className="font-figtree text-sm text-medium">
                  Collaborate in teams of up to 4 to create tech projects, while
                  participating in workshops, learning from mentors, competing
                  for prizes, and meet like-minded hackers.
                </div>
                <div className="absolute -bottom-[10px] -right-[50px] z-10 h-20 w-40">
                  <motion.img src="/tape1.png" alt="tape1" />
                </div>
              </div>
            </div>
            <Envelope />
          </div>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default About;

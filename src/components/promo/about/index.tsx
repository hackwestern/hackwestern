import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import { motion } from "framer-motion";
import Envelope from "./envelope";
import { DraggableImage } from "~/components/canvas/draggable";

function About() {
  return (
    <CanvasComponent offset={coordinates.about}>
      <div className="flex h-screen flex-col items-center justify-center space-y-4 pb-12">
        <div className="flex origin-center flex-col items-center justify-center space-y-8 transition-transform duration-300 ease-in-out">
          <div className="relative">
            <div className="flex w-full max-w-full flex-col items-center justify-start gap-4 px-4 pb-0 pt-24">
              <div className="h-5 text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
                About
              </div>
              <div className="mb-12 text-center font-dico text-2xl font-medium text-indigo-950">
                Create. Collaborate. Innovate.
              </div>
              <div className="absolute -left-[200px] bottom-[50px]">
                <motion.img
                  src="/lightningdash.svg"
                  alt="Lightning Dash"
                  draggable="false"
                  style={{ rotate: "-5deg" }}
                />
              </div>
              <DraggableImage
                className="absolute -right-[320px] bottom-[350px]"
                key="lightbulb"
                src="/lightbulb.png"
                alt="Lightbulb"
                scale={0.25}
                animate={{
                  rotate: [2, -2],
                  transition: {
                    duration: 1,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  },
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-10">
            <div className="flex items-center justify-center gap-16">
              <div className="shrink-0">
                <motion.img
                  src="/photo.png"
                  alt="hackwestern"
                  width={375}
                  height={250}
                  draggable="false"
                  style={{ rotate: "-5deg" }}
                />
              </div>
              <div className="relative -mt-12 mb-24 flex w-fit max-w-xs rotate-[8deg] items-center justify-center bg-[url('/speech.svg')] bg-contain bg-center bg-no-repeat text-center">
                <div className="mb-2 p-12 font-figtree text-xs text-white sm:text-sm md:text-base lg:text-base">
                  We cover food, travel, and lodging so you can focus on
                  bringing your ideas to life!
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-10">
              <div className="relative mr-[75px] h-fit w-fit max-w-md shrink-0 -rotate-[2deg] rounded-sm bg-white shadow-md">
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
                    Collaborate in teams of up to 4 to create tech projects,
                    while participating in workshops, learning from mentors,
                    competing for prizes, and meet like-minded hackers.
                  </div>
                  <div className="absolute -bottom-[10px] -right-[50px] z-10 h-20 w-40">
                    <motion.img
                      src="/tape1.png"
                      alt="tape1"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <Envelope />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default About;

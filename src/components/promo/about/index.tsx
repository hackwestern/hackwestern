import { coordinates } from "~/constants/canvas";
import { motion } from "framer-motion";
import Envelope from "./envelope";
import { DraggableImage } from "~/components/canvas/draggable";
import { CanvasComponent } from "~/components/canvas/component";

function About() {
  return (
    <CanvasComponent offset={coordinates.about}>
      <div className="mt-8 flex flex-col items-center justify-center space-y-4 pb-12 sm:-mt-12">
        <div className="flex origin-center flex-col items-center justify-center transition-transform duration-300 ease-in-out">
          <div className="relative">
            <div className="flex w-full max-w-full flex-col items-center justify-start gap-4 px-4 pb-0 pt-24">
              <div className="h-5 text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
                About
              </div>
              <div className="mb-8 text-center font-dico text-2xl font-medium text-indigo-950">
                Create. Collaborate. Innovate.
              </div>
              <DraggableImage
                className="absolute -left-[600px] -bottom-[200px] w-36"
                key="pencils"
                src="/pencils.png"
                alt="Pencils"
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
              <DraggableImage
                className="absolute -right-[300px] bottom-[190px] w-24"
                key="lightbulb"
                src="/lightbulb.png"
                alt="Lightbulb"
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
               <DraggableImage
                className="absolute -right-[650px] -bottom-[400px] w-24"
                key="paintbrush"
                src="/paintbrush.png"
                alt="Paintbrush"
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
              <div className="relative flex w-fit max-w-xs rotate-[8deg] items-center justify-center text-center">
                <img src="/speech.svg" alt="" className="h-auto w-full" />
                <div className="absolute inset-[1/2] px-8 font-figtree text-white">
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
                      src="/people.png"
                      alt="hackwestern"
                      width={300}
                      height={150}
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
              <div className="shrink-0 pt-8">
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

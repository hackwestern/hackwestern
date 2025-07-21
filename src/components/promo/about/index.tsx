import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import { motion } from "framer-motion";
import Envelope from './envelope';

function About() {
  return (
    <CanvasComponent offset={coordinates.about}>
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 pb-12 sm:space-y-8 md:space-y-12">
        <div className="flex origin-center scale-[0.7] sm:scale-[0.85] md:scale-[0.95] lg:scale-100 flex-col items-center justify-center space-y-8 transition-transform duration-300 ease-in-out md:scale-100">
          <div className="flex flex-col w-full max-w-full items-center justify-start gap-4 px-4 pb-0 sm:max-w-[794px] sm:gap-6 sm:px-0 sm:pb-8  md:gap-8 md:pb-12">
            <div className="h-5 text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
              About
            </div>
            <div className="text-center font-dico text-3xl font-medium text-indigo-950 sm:text-3xl md:text-4xl">
              Create. Collaborate. Innovate.
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-10 origin-center scale-[0.85] flex-row sm:-mt-20 sm:scale-[0.9] md:-mt-4 md:scale-[0.95] lg:mt-0 lg:scale-100">
            <div>
              <motion.img
                src="/photo.png"
                alt="hackwestern"
                width={375}
                height={250}
                draggable="false"
                style= {{ rotate:"-5deg" }}
              />
            </div>
            <div className="relative rotate-[8deg] bg-[url('/speech.svg')] bg-no-repeat bg-contain bg-center flex items-center justify-center w-fit max-w-xs text-center">
              <div className="font-figtree text-white text-xs sm:text-sm md:text-base lg:text-base p-12 mb-2">
                We cover food, travel, and lodging so you can focus on bringing your ideas to life!
              </div>
            </div>
            <div className="relative bg-white -rotate-[2deg] w-fit h-fit max-w-md rounded-sm shadow-md">
              <div className="absolute z-10 -left-[55px] -top-[45px] w-40 h-20" >
                <motion.img 
                  src="/tape1.png" 
                  alt="tape1" 
                />
              </div>
              <div className="p-8 flex flex-col items-center justify-center gap-x-8 gap-y-4">
                <div>
                  <motion.img
                    src="/people.svg"
                    alt="hackwestern"
                    width={150}
                    height={75}
                    draggable="false"
                  />
                </div>
                <div className="font-figtree text-medium text-sm">
                  Collaborate in teams of up to 4 to create tech projects, while participating in workshops, learning from mentors, competing for prizes, and meet like-minded hackers.
                </div>
                <div className="absolute z-10 -bottom-[10px] -right-[50px] w-40 h-20">
                  <motion.img 
                    src="/tape1.png" 
                    alt="tape1" 
                  />
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

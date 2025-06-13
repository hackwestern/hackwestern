import { motion } from "framer-motion";
import { PreregistrationForm } from "../preregistration-form";
import { useRef } from "react";

function Hero() {
  const constraintRef = useRef(null);

  return (
    <div>
        <div className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100 z-0"></div>
        <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1px,transparent_1px)] opacity-25 [background-size:16px_16px] z-1"></div>
        <div className="absolute inset-0 h-full w-full bg-noise filter contrast-[170%] brightness-[110%] opacity-100 z-0"></div>
        <div ref={constraintRef}className="absolute inset-0 h-full w-full flex items-center justify-center z-2">
          <div className="flex flex-col items-center justify-center space-y-12 mb-[25vh]">
            <div>
              <motion.div
                key="hw-logo"
                animate={{
                  rotate: [2, -2],
                  transition: {
                    duration: 1,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  },
                }}
                drag
                dragConstraints={constraintRef}
              >
                <motion.img
                  src="/horse.svg"
                  alt="Hack Western Logo"
                  width={150}
                  height={150}
                  draggable="false"
                  className="h-auto w-auto"
                />
              </motion.div>
            </div>
            <div className="font-jetbrains-mono text-medium">
              NOV 31 - DEC 2, 2025
            </div>
            <div className="flex flex-col items-center justify-center font-dico text-heavy text-5xl">
              <div>Hack</div>
              <div>Western</div>
              <div>XII</div>
            </div>
            <div className="font-figtree text-medium text-sm">
              The world is your canvas.
            </div>
            <PreregistrationForm />
          </div>
        </div>
    </div>
  );
}

export default Hero;
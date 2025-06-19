import { motion } from "framer-motion";
import { PreregistrationForm } from "../preregistration-form";
import { Draggable } from "~/components/canvas/draggable";
import { CanvasComponent } from "../canvas/canvas";

function Hero() {
  return (
    <CanvasComponent>
      <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-12">
        <div className="z-10">
          <Draggable
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
          >
            <motion.img
              src="/horse.svg"
              alt="Hack Western Logo"
              width={150}
              height={150}
              draggable="false"
              className="h-auto w-auto"
            />
          </Draggable>
        </div>
        <div className="font-jetbrains-mono text-medium">
          NOV 21 - NOV 23, 2025
        </div>
        <div className="flex flex-col items-center justify-center font-dico text-5xl text-heavy">
          <div>Hack</div>
          <div>Western</div>
          <div>XII</div>
        </div>
        <div className="font-figtree text-sm text-medium">
          The world is your canvas.
        </div>
        <PreregistrationForm />
      </div>
    </CanvasComponent>
  );
}

export default Hero;

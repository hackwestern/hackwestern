import { motion } from "framer-motion";
import { PreregistrationForm } from "../preregistration-form";
import { Draggable } from "~/components/canvas/draggable";
import { CanvasComponent } from "../canvas/canvas";
import Image from "next/image";
import { useState } from "react";

function Hero() {
  const [hasBeenDragged, setHasBeenDragged] = useState(false);

  return (
    <CanvasComponent>
      <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-12">
        <div className="flex origin-center scale-75 flex-col items-center justify-center space-y-4 transition-transform duration-300 ease-in-out md:scale-100">
          <div className="flex flex-row">
            <Image
              src="/dragme.svg"
              alt="Drag Me!"
              className=" pointer-events-none opacity-0"
              width={80}
              height={80}
            />
            <Draggable
              key="hw-logo"
              onDragStart={() => setHasBeenDragged(true)}
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
                width={80}
                height={80}
                draggable="false"
                className="h-auto w-auto scale-[0.65] cursor-pointer"
              />
            </Draggable>
            <motion.div
              animate={{ opacity: hasBeenDragged ? 0 : 1 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <Image
                src="/dragme.svg"
                alt="Drag Me!"
                className="pointer-events-none -ml-2 pt-14"
                width={80}
                height={80}
              />
            </motion.div>
          </div>
          <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-6">
            <div className="font-jetbrains-mono text-medium">
              NOV 21 - NOV 23, 2025
            </div>
            <div className="flex flex-col items-center justify-center">
              <motion.img
                src="/hackwesterntitle.svg"
                alt="Hack Western XII"
                width={500}
                height={100}
                className="h-[180px] w-auto"
                draggable="false"
              />
            </div>
            <div className="text-md font-figtree text-medium">
              The world is your canvas.
            </div>
          </div>
          <PreregistrationForm />
        </div>
        <div className="h-[150px] sm:h-[80px]" />
      </div>
    </CanvasComponent>
  );
}

export default Hero;

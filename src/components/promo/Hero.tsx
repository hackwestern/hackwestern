import { motion } from "framer-motion";
import { PreregistrationForm } from "../preregistration-form";
import { Draggable } from "~/components/canvas/draggable";
import { CanvasComponent } from "../canvas/canvas";
import Image from "next/image";
import { useState } from "react";

function Hero() {
  const [clickedHorse, setClickedHorse] = useState<boolean>(false);

  const handleClickHorse = () => {
    setClickedHorse(true);
  }

  return (
    <CanvasComponent>
      <div className="my-auto flex flex-col items-center justify-center space-y-12 pb-12">
        <div className="flex flex-row">
        {!clickedHorse && <Image 
          src="/dragme.svg"
          alt="Drag Me!"
          className="opacity-0 pointer-events-none"
          width={100}
          height={100}
        />}
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
            width={100}
            height={100}
            draggable="false"
            className="h-auto w-auto scale-75"
            onClick={handleClickHorse}
          />
        </Draggable>
        {!clickedHorse && <Image 
          src="/dragme.svg"
          alt="Drag Me!"
          className="pointer-events-none"
          width={100}
          height={100}
        />}
        </div>
        <div className="font-jetbrains-mono text-medium">
          NOV 21 - NOV 23, 2025
        </div>
        <div className="flex flex-col items-center justify-center">
          <motion.img
            src="/hackwesterntitle.svg"
            alt="Hack Western XII"
            width={500}
            height={100}
            className="h-[150px] w-auto"
            draggable="false"
          />
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

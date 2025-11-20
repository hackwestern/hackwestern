import { motion } from "framer-motion";
import { DraggableImage } from "~/components/canvas/draggable";
import { CanvasComponent } from "../canvas/component";
import Image from "next/image";
import { useState } from "react";
import { coordinates } from "~/constants/canvas";
import { Button } from "../ui/button";
import Link from "next/link";

function Hero() {
  const [hasBeenDragged, setHasBeenDragged] = useState(false);

  return (
    <CanvasComponent offset={coordinates.home}>
      <div className="my-auto flex origin-center flex-col items-center justify-center space-y-12">
        <div className="flex origin-center scale-75 flex-col items-center justify-center space-y-4 transition-transform duration-300 ease-in-out md:scale-100">
          <div className="my-16 flex flex-row">
            <Image
              src="/dragme.svg"
              alt="Drag Me!"
              className=" pointer-events-none opacity-0"
              width={80}
              height={80}
            />
            <DraggableImage
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
              src="/horse.svg"
              alt="Hack Western Logo"
              className="m-4 mt-8 w-20"
            />
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
          <div className="my-auto flex scale-[0.85] flex-col items-center justify-center space-y-10 pb-4 sm:scale-100 sm:space-y-12">
            <div className="text-md font-jetbrains-mono text-medium">
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
            <div className="font-figtree text-lg font-medium text-medium">
              The world is your canvas.
            </div>
          </div>
          <Link href="/live" prefetch={true}>
            <Button className="w-48" variant="primary" size="lg">
              Dashboard
            </Button>
          </Link>
          <p className="pt-0.5 text-sm text-medium">applications closed!</p>
        </div>
        <div className="h-[150px] sm:h-[80px]" />
      </div>
    </CanvasComponent>
  );
}

export default Hero;

import { motion } from "framer-motion";
import { PreregistrationForm } from "../preregistration-form";
import { useRef } from "react";
import { Reset } from "~/components/canvas/reset";
import { Draggable } from "~/components/canvas/draggable";
import { Grid } from "~/components/canvas/grid";
import Canvas from "~/components/canvas/canvas";

function Hero() {
  const PAGESBEFORE = [
    <Grid
      key="grid-1"
      offsetVertical={-1}
      offsetHorizontal={-1}
      hasGradient={false}
    />,
    <Grid
      key="grid-2"
      offsetVertical={-1}
      offsetHorizontal={0}
      hasGradient={false}
    />,
    <Grid
      key="grid-3"
      offsetVertical={-1}
      offsetHorizontal={1}
      hasGradient={false}
    />,
    <Grid
      key="grid-4"
      offsetVertical={0}
      offsetHorizontal={-1}
      hasGradient={true}
      circleX="150vw"
      circleY="275vh"
    />,
  ];

  const PAGESAFTER = [
    <Grid
      key="grid-6"
      offsetVertical={0}
      offsetHorizontal={1}
      hasGradient={true}
      circleX="-50vw"
      circleY="275vh"
    />,
    <Grid
      key="grid-7"
      offsetVertical={1}
      offsetHorizontal={-1}
      hasGradient={true}
      circleX="150vw"
      circleY="175vh"
    />,
    <Grid
      key="grid-8"
      offsetVertical={1}
      offsetHorizontal={0}
      hasGradient={true}
      circleX="50vw"
      circleY="175vh"
    />,
    <Grid
      key="grid-9"
      offsetVertical={1}
      offsetHorizontal={1}
      hasGradient={true}
      circleX="-50vw"
      circleY="175vh"
    />,
  ];

  return (
    <div>
      <Canvas>
        {PAGESBEFORE}
        <div>
          <div
            className="absolute inset-0 z-0 h-full w-full bg-hw-radial-gradient opacity-100"
            style={{
              backgroundImage: `radial-gradient(ellipse 550vh 300vh at 50vw 275vh, var(--coral) 0%, var(--salmon) 40%, var(--lilac) 65%, var(--beige) 90%)`,
            }}
          ></div>
          <div className="z-1 absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1px,transparent_1px)] opacity-25 [background-size:16px_16px]"></div>
          <div className="absolute inset-0 z-0 h-full w-full bg-noise opacity-100 brightness-[110%] contrast-[170%] filter"></div>
          <div className="z-2 absolute inset-0 flex h-full w-full items-center justify-center">
            <div className="mb-[25vh] flex flex-col items-center justify-center space-y-12">
              <div>
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
                NOV 31 - DEC 2, 2025
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
          </div>
        </div>
        {PAGESAFTER}
      </Canvas>
    </div>
  );
}

export default Hero;

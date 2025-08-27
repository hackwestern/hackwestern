import { motion } from "framer-motion";
import Image from "next/image";
import React from "react";

export type CardStackProps = {
  isOpen?: boolean;
  names?: {
    image?: string;
    link?: string;
  }[];
  folder?: string;
};

export const CardStack = ({
  isOpen = false,
  names = [],
  folder,
}: CardStackProps) => {
  const rotations = [-15, 0, 15];
  const x_pos = [-40, 20, 80];
  const y_open = [-50, -60, -50];

  return (
    <div className="relative h-36 w-72">
      {names.map((name, i) => {
        const cleanName = name.image?.replace(/\.png$/, "");
        const rotation = rotations[i] ?? 0;
        const xBase = x_pos[i] ?? 0;
        const yBase = y_open[i] ?? 0;

        return (
          <motion.div
            key={name.image}
            className="group absolute left-0 top-0 ml-4 flex h-32 w-24 flex-col gap-y-1"
            style={{
              zIndex: 10 - i,
              transformOrigin: "center",
            }}
            initial={{
              y: 10,
              x: 25,
              opacity: 0.1,
              scale: 0.95,
              rotate: -20,
            }}
            animate={
              isOpen
                ? {
                    x: x_pos[i],
                    y: y_open[i],
                    opacity: 1,
                    scale: 1.3,
                    rotate: rotations[i],
                  }
                : {
                    y: 10,
                    opacity: 1,
                    scale: 0.95,
                    rotate: -20,
                  }
            }
            whileHover={{
              x:
                xBase +
                0 * Math.cos((rotation * Math.PI) / 180) +
                10 * Math.sin((rotation * Math.PI) / 180),
              y:
                yBase +
                0 * Math.sin((rotation * Math.PI) / 180) -
                10 * Math.cos((rotation * Math.PI) / 180),
              scale: 1.35,
              zIndex: 1000,
            }}
            transition={{
              delay: i * 0.05,
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <div className="flex items-center justify-center rounded-[4px] bg-[var(--text-heavy,#3C204C)] pb-1 pl-2 pr-2 pt-1 opacity-0 duration-300 group-hover:opacity-100 ">
              <span className="font-figtree text-[12px] font-light leading-none text-white">
                {cleanName}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border-4 border-gray-100 bg-white shadow-lg">
              <a href={name.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={`/projects/${folder}/${name.image}`}
                  alt={`Card image ${i}`}
                  width={100}
                  height={76}
                  className="object-cover"
                />
              </a>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

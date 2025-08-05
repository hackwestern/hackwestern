import { motion } from "framer-motion";
import Image from "next/image";
import React from "react";

export type CardStackProps = {
	isOpen?: boolean;
	names?: string[];
	folder?: string;
};

export const CardStack = ({ isOpen = false, names = [], folder }: CardStackProps) => {
	const rotations = [-10, 0, 10];
	const x_pos = [-40, 20, 80];
	const y_open = [-40, -60, -40]

	return (
		<div className="relative w-36 h-28">
			{names.map((name, i) => {
				const cleanName = name.replace(/\.png$/, "");
				return (
					<motion.div
						key={name}
						className="flex flex-col absolute top-0 left-0 w-16 h-15 gap-y-1"
						style={{
							zIndex: 10 - i,
							transformOrigin: "center",
						}}
						initial={{
							y: 10,
							x: 20,
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
						transition={{
							delay: i * 0.05,
							duration: 0.3,
							ease: [0.4, 0, 0.2, 1],
						}}
					>
						<div className="flex items-center justify-center pt-1 pb-1 pr-2 pl-2 rounded-[4px] bg-[var(--text-heavy,#3C204C)]">
							<span className="text-white font-figtree text-[7px] font-light leading-none">
								{cleanName}
							</span>
						</div>
						<div className="rounded-lg bg-white shadow-lg border-4 border-gray-100 overflow-hidden">
							<Image
								src={`/projects/${folder}/${name}`}
								alt={`Card image ${i}`}
								width={100}
								height={76}
								className="object-cover"
							/>
						</div>
					</motion.div>
				)
			}
			)}
		</div>
	);
};

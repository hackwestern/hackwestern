import Image from 'next/image'
import { motion } from "framer-motion";

type HeaderCardsProps = {
	isOpen?: boolean;
	names?: {
		image?: string;
		description?: string;
	}[]
	folder?: string[];
};

function HeaderCards({ isOpen = true, names = [], folder = [] }: HeaderCardsProps) {
	const rotations = [-16, 3.214, 22];
	const yOffsets = [-10, -60, 5];
	const zIndexes = [0, 40, 50];
	const xIndexes = [-20, 0, 20];

	return (
		<div className=" flex justify-center h-[800px] w-[1199px]">
			{names.map((name, i) => {
				const cleanName = name.image.replace(/\.png$/, "");
				const rotate = rotations[i % 3];
				const y = yOffsets[i % 3];
				const z = zIndexes[i % 3];
				const x = xIndexes[i % 3];
				return (
					<motion.div
						key={name.image}
						initial={{
							rotate,
							y,
							zIndex: z,
							x,
						}}
						whileHover="hover"
						variants={{
							hover: {}
						}}
						className="absolute group pointer-events-auto flex flex-col w-[369px] h-[292px] p-[11px] items-center rounded-2xl border border-gray-200 bg-white shadow-xl relative"
					>
						<motion.div
							className="relative w-full rounded overflow-hidden"
							variants={{
								hover: {
									height: 209,
									transition: { duration: 0.25 }
								}
							}}
							animate={{
								height: 230
							}}
						>
							<Image
								src={`/projects/${folder[i]}/${name.image}`}
								alt={cleanName}
								fill
								style={{ objectFit: "cover" }}
								className="bg-[lightgray]"
								priority
							/>
						</motion.div>
						<motion.span
							className="w-full text-center font-jetbrains-mono text-[16px] font-medium uppercase text-[color:var(--text-medium,#776780)] mt-[10px]"
							variants={{
								hover: {
									y: -5,
									transition: { duration: 0.25 }
								}
							}}
							initial={{
								y: 0
							}}
						>
							{cleanName}
						</motion.span>
						{isOpen && (
							<motion.p
								className="absolute bottom-0 left-2 right-2 text-center text-xs text-[color:var(--text-medium,#776780)]"
								variants={{
									hover: {
										opacity: 1,
										y: -10,
										transition: { duration: 0.25 }
									}
								}}
								initial={{
									opacity: 0,
									y: 0,
								}}
							>
								{name.description || "No description provided"}
							</motion.p>
						)}
					</motion.div>
				);
			})}
		</div>
	);
}

export default HeaderCards;

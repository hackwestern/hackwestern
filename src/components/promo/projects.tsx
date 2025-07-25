import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../canvas/canvas";
import { motion } from "framer-motion";

function Projects() {
	return (
		<CanvasComponent offset={coordinates.projects}>
			<div className="flex h-screen w-screen items-center justify-center">
				<div className="inline-flex w-[640px] flex-col items-center justify-center gap-6">
					<div className="justify-start self-stretch text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
						past projects
					</div>
					<div className="justify-start self-stretch text-center font-dico text-3xl font-medium text-indigo-950">
						The world is waiting for your creation.
					</div>
					<div className="justify-start self-stretch text-center font-figtree text-base font-medium text-zinc-500">
						Here are what other students like you have created at Hack Western.
					</div>
					<motion.img
						src="/PastProjectsBubble.svg"
						alt="Past Projects Bubbld"
						width={440}
						height={418}
						draggable="false"
					/>
					<div className="w-[640px] justify-start text-center font-['Figtree'] text-base font-medium text-zinc-500">
						Here are what other students like you have created at Hack Western.
					</div>
				</div>
			</div>
		</CanvasComponent>
	);
}

export default Projects;

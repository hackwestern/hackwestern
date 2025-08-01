import { CanvasComponent } from "../canvas/canvas";
import { coordinates } from "~/constants/canvas";
import { motion } from "framer-motion";
import FolderIcon from "../ui/FolderIcon";

function Projects() {
	return (
		<CanvasComponent offset={coordinates.projects}>
			<div className="flex flex-col w-[60rem] items-center">
				{/* Top projects */}
				<div className="flex">
					<div className="flex flex-col w-[380px] h-[300px] p-[12px] items-start gap-[14px] shrink-0 rounded-[16px] border-[rgba(119,103,128,0.10)] bg-[#FBFBFB] shadow-[0_8px_12px_0_rgba(119,115,149,0.25)]" />
				</div>

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
					</div>
				</div>

				{/* Folders */}
				<div className="flex h-44 w-200 shrink-0 justify-between w-[60rem]">
					<div className="self-end flex flex-col">
						<FolderIcon className="w-32" gradientId="red" />
						<span className="font-jetbrains-mono font-medium text-medium text-[12px] text-center mt-4 block">CREATIVE ARTS</span>
					</div>
					<div className="self-start">
						<FolderIcon className="w-32" gradientId="blue" />
						<span className="font-jetbrains-mono font-medium text-medium text-[12px] text-center mt-4 block">AI-POWERED</span>
					</div>
					<div className="self-end">
						<FolderIcon className="w-32" gradientId="green" />
						<span className="font-jetbrains-mono font-medium text-medium text-[12px] text-center mt-4 block">GAMES</span>
					</div>
					<div className="self-start">
						<FolderIcon className="w-32" gradientId="purple" />
						<span className="font-jetbrains-mono font-medium text-medium text-[12px] text-center mt-4 block">DELIGHTFUL DESIGN</span>
					</div>
					<div className="self-end">
						<FolderIcon className="w-32" gradientId="orange" />
						<span className="font-jetbrains-mono font-medium text-medium text-[12px] text-center mt-4 block">HARDWARE</span>
					</div>
				</div>
			</div>
		</CanvasComponent >
	);
}

export default Projects;

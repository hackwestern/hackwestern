import { CanvasComponent } from "../canvas/canvas";
import { coordinates } from "~/constants/canvas";
import { motion } from "framer-motion";
import { useState } from "react";
import { ProjectPreview } from "../ui/PreviewProjects";

function Projects() {
	const folderData = [
		{ label: "CREATIVE ARTS", gradientId: "red", align: "self-end", cards: ["Git-place.png", "Ghostwriter.png", "Dream Scape.png"] },
		{ label: "AI-POWERED", gradientId: "blue", align: "self-start", cards: ["Co:Herent.png", "Talk to Duckie.png", "Bravo Dispatch.png"] },
		{ label: "GAMES", gradientId: "green", align: "self-end", cards: ["Ar-cade.png", "PacRoyale.png", "Credit Crimes.png"] },
		{ label: "DELIGHTFUL DESIGN", gradientId: "purple", align: "self-start", cards: ["Genee.png", "Harbor-Ed.png", "Blocks.png"] },
		{ label: "HARDWARE HACKS", gradientId: "orange", align: "self-end", cards: ["infu.png", "SuperStage.png", "HoverTouch.png"] },
	];
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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
				<div className="flex h-44 w-[60rem] shrink-0 justify-between">
					{folderData.map((folder, index) => (
						<div
							key={folder.label}
							className={`${folder.align} flex flex-col items-center relative`}
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						>
							<ProjectPreview
								label={folder.label}
								gradientId={folder.gradientId}
								isOpen={hoveredIndex === index}
								cardNames={folder.cards}
								folder={folder.label}
							/>
						</div>
					))}
				</div>		</div>
		</CanvasComponent >
	);
}

export default Projects;
